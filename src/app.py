"""Rastro: ventana de escritorio (pywebview: WebView2 en Windows, WebKit en Mac). La interfaz vive en ui/, la búsqueda en busqueda/."""
import base64
import csv
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import urllib.request
from pathlib import Path

import bottle  # el servidor de pywebview (dependencia suya)
import webview

import actualizar
import busqueda
import ia
import juez
from busqueda.navegador import abrir, navegador_usado
from busqueda.tiendas import resolver

AQUI = Path(__file__).parent
MAC = sys.platform == "darwin"
DATOS = (Path.home() / "Library/Application Support" if MAC else Path(os.environ.get("LOCALAPPDATA", Path.home()))) / "Rastro"
ESTADO = DATOS / "estado.json"
juez.CARPETA = DATOS / "reglas"
FOTOS = DATOS / "fotos"
SERVIDOR_FOTOS = "https://marketplace-article-scans.s3.cardmarket.com/"

ventana = None


def delante():
    """Trae Rastro por encima del navegador, que se pone delante al abrirle una URL."""
    ventana.on_top = True
    ventana.on_top = False


def a_js(tipo, **datos):
    """Envía un evento de la búsqueda a la interfaz (window.onMotor)."""
    if tipo == "abierta":  # se da tiempo a que la extensión esconda la pestaña
        if datos.get("ocultar"):
            threading.Timer(1.5, delante).start()
        return
    ventana.evaluate_js(f"onMotor({json.dumps({'tipo': tipo, **datos}, ensure_ascii=False)})")


class Api:
    """Métodos accesibles desde JS como window.pywebview.api.<nombre>."""

    def __init__(self):
        self._control = None

    def cargar_estado(self):
        return ESTADO.read_text(encoding="utf8") if ESTADO.exists() else None

    def guardar_estado(self, datos):
        ESTADO.write_text(datos, encoding="utf8")

    def enlaces(self, tiendas):
        """Enlace al stock de cada tienda, según su adaptador."""
        return {t: resolver(t)[0].enlace(resolver(t)[1]) for t in tiendas}

    def buscar_tiendas(self, cartas, tiendas, generales, refrescar=False, opciones=None):
        """cartas: [{id, nombre, filtros}]. opciones: las de la ventana Opciones. Los resultados llegan a JS como eventos onMotor."""
        if self._control:
            return False

        def emitir(tipo, **datos):
            if tipo == "fin":
                self._control = None
            a_js(tipo, **datos)

        self._control = busqueda.lanzar(cartas, tiendas, generales, emitir, DATOS, refrescar, opciones)
        return True

    def parar_busqueda(self):
        if self._control:
            self._control.parar()

    def _foto(self, url, grande):
        """Descarga (o lee de caché) la foto de un artículo. Su servidor solo la entrega a quien viene de
        cardmarket.com (protección contra el uso en otras webs), así que se pide indicando esa procedencia."""
        if not url.startswith(SERVIDOR_FOTOS):
            return None
        url = url.split("?")[0]
        if grande:
            url = re.sub(r"t(\.\w+)$", r"\1", url)  # 123t.jpg es la miniatura; 123.jpg, la foto completa
        if Path(url).suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            return None  # solo imágenes: el archivo se abre con el programa asociado a su extensión
        ruta = FOTOS / (hashlib.sha1(url.encode()).hexdigest()[:16] + Path(url).suffix)
        if not ruta.exists():
            FOTOS.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(url, headers={"Referer": "https://www.cardmarket.com/"})
            with urllib.request.urlopen(req, timeout=20) as r:
                ruta.write_bytes(r.read())
        return ruta

    def foto_miniatura(self, url):
        """Miniatura como data: URI para la vista previa."""
        ruta = self._foto(url, grande=False)
        return f"data:image/jpeg;base64,{base64.b64encode(ruta.read_bytes()).decode()}" if ruta else None

    def abrir_foto(self, url):
        """Foto a tamaño completo, abierta en el visor de imágenes predeterminado."""
        ruta = self._foto(url, grande=True)
        if ruta:
            abrir(ruta)

    def descargar_extension(self):
        """Copia la extensión a la carpeta que elija el usuario (dentro del .exe el navegador no puede cargarla).
        Devuelve la ruta donde ha quedado, o None si cancela."""
        elegida = ventana.create_file_dialog(webview.FileDialog.FOLDER)
        if not elegida:
            return None
        destino = Path(elegida[0] if isinstance(elegida, (list, tuple)) else elegida) / "Rastro-extension"
        shutil.copytree(AQUI / "extension", destino, dirs_exist_ok=True)
        abrir(destino)
        return str(destino)

    def navegador(self):
        nombre, extensiones = navegador_usado()
        return {"nombre": nombre, "extensiones": extensiones}

    def copiar(self, texto):
        """Al portapapeles. (Los navegadores no abren su página de extensiones si se la pasas desde fuera: hay que pegarla.)"""
        if MAC:
            subprocess.run("pbcopy", input=texto.encode("utf8"))
        else:
            subprocess.run("clip", input=texto.encode("utf-16-le"), creationflags=subprocess.CREATE_NO_WINDOW)

    def probar_extension(self, ocultar=True):
        """Primeros pasos: comprueba que la extensión del navegador responde."""
        if self._control:
            return False
        return busqueda.probar(DATOS, a_js, ocultar)

    def importar_moxfield(self, enlace):
        """Mazo público de Moxfield como {nombre, formato, texto}; el texto es una decklist con secciones.
        Se pide desde aquí porque la API de Moxfield no admite peticiones desde la interfaz (CORS)."""
        m = re.search(r"moxfield\.com/decks/([\w-]+)", enlace)
        if not m:
            return None
        req = urllib.request.Request(f"https://api2.moxfield.com/v3/decks/all/{m.group(1)}",
                                     headers={"User-Agent": "Mozilla/5.0 Rastro", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                d = json.load(r)
        except OSError:
            return {"error": "No se pudo abrir ese mazo de Moxfield. ¿Es público y el enlace está bien?"}
        secciones = {"Commander": ["commanders"], "Deck": ["mainboard"], "Sideboard": ["sideboard", "companions"]}
        texto = []
        for titulo, tableros in secciones.items():
            lineas = [f'{c["quantity"]} {c["card"]["name"]} ({c["card"]["set"].upper()})'
                      for t in tableros for c in d["boards"].get(t, {}).get("cards", {}).values()]
            if lineas:
                texto += [titulo, *lineas, ""]
        return {"nombre": d.get("name", ""), "formato": d.get("format", ""), "texto": "\n".join(texto)}

    def buscar_combos(self, cuerpo):
        """Combos de Commander Spellbook para un mazo ({commanders: [{card}], main: [{card}]}).
        Desde aquí porque su API no acepta peticiones desde la interfaz (CORS)."""
        req = urllib.request.Request("https://backend.commanderspellbook.com/find-my-combos",
                                     data=json.dumps(cuerpo).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "Accept": "application/json",
                                              "User-Agent": "Rastro"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)["results"]
        except (OSError, ValueError):
            return None

    def reglas_actualizar(self):
        """Al abrir Rastro con la IA activada: descarga las Comprehensive Rules si hay unas nuevas."""
        return juez.actualizar()

    def reglas_estado(self):
        return juez.estado()

    def juez_preguntar(self, pregunta, historial=None):
        """Preguntar al juez: una duda de reglas con su historial reciente (ver juez.py)."""
        return juez.preguntar(pregunta, historial)

    def ia_estado(self):
        """Comprobación rápida (sin gastar uso) antes de abrir una tarea de IA: instalado, sesión y cuenta."""
        return ia.estado()

    def ia_probar(self):
        """Opciones: comprueba que el comando claude existe, tiene sesión y responde."""
        return ia.probar()

    def ia_pedir(self, tarea, mazo, formato, indicaciones="", objetivo=None, total=None, contexto="", comandantes=None):
        """Mazos: una tarea de IA (ver ia.TAREAS). Bloquea hasta que claude responde; pywebview lo llama en otro hilo."""
        return ia.pedir(tarea, mazo, formato, indicaciones, objetivo, total, contexto, comandantes)

    def ia_cancelar(self):
        ia.cancelar()

    def version(self):
        return actualizar.VERSION

    def comprobar_actualizacion(self):
        """Botón de Opciones: busca ya una versión nueva y, si la hay, la instala y reinicia."""
        return comprobar_actualizacion(self)

    def vaciar_cache(self):
        if self._control:
            return False
        try:
            (DATOS / "cache.sqlite").unlink(missing_ok=True)
        except OSError:  # otra copia de Rastro la tiene abierta
            return False
        return True

    def exportar_csv(self, filas):
        """filas: lista de listas ya ordenadas por la interfaz; la primera es la cabecera."""
        ruta = ventana.create_file_dialog(webview.FileDialog.SAVE, save_filename="ofertas_rastro.csv",
                                          file_types=("CSV (*.csv)",))
        if not ruta:
            return False
        ruta = ruta[0] if isinstance(ruta, (list, tuple)) else ruta
        with open(ruta, "w", newline="", encoding="utf-8-sig") as fh:
            csv.writer(fh, delimiter=";").writerows(filas)
        return True

    def exportar_tiendas(self, tiendas):
        """Guarda la lista de tiendas como texto, una por línea."""
        ruta = ventana.create_file_dialog(webview.FileDialog.SAVE, save_filename="tiendas_rastro.txt",
                                          file_types=("Texto (*.txt)",))
        if not ruta:
            return False
        ruta = ruta[0] if isinstance(ruta, (list, tuple)) else ruta
        Path(ruta).write_text("\n".join(tiendas) + "\n", encoding="utf-8")
        return True

    def importar_tiendas(self):
        """Texto de un archivo elegido por el usuario, o None si cancela."""
        ruta = ventana.create_file_dialog(webview.FileDialog.OPEN, file_types=("Texto (*.txt;*.csv)", "Todos (*.*)"))
        return Path(ruta[0]).read_text(encoding="utf-8-sig", errors="replace") if ruta else None


def comprobar_actualizacion(api):
    """Al arrancar (y desde Opciones): si hay una Release nueva en GitHub, se instala y Rastro se reinicia solo.
    Devuelve el resultado para Opciones: fuente, error, al_dia, ocupado o actualizando."""
    actualizar.limpiar()
    if not getattr(sys, "frozen", False):
        return {"estado": "fuente"}
    try:
        hay = actualizar.buscar()
    except OSError:
        return {"estado": "error"}
    if not hay:
        return {"estado": "al_dia"}
    version, url = hay
    if api._control:  # nunca en mitad de una búsqueda
        return {"estado": "ocupado", "version": version}

    def instalar():
        a_js("actualizando", version=version)
        try:
            actualizar.instalar(url)
        except OSError:
            a_js("actualizando", version=version, error=True)
            return
        ventana.destroy()
    threading.Thread(target=instalar, daemon=True).start()
    return {"estado": "actualizando", "version": version}


if __name__ == "__main__":
    DATOS.mkdir(parents=True, exist_ok=True)
    api = Api()
    ventana = webview.create_window("Rastro", str(AQUI / "ui" / "index.html"), js_api=api,
                                    width=1440, height=900, min_size=(720, 560), background_color="#0b0e14")
    # pywebview sirve ui/ siempre en el mismo puerto: si otra copia de Rastro lo ocupa, esta mostraría su interfaz.
    puerto = None
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", 42001)) == 0:
            with socket.socket() as libre:
                libre.bind(("127.0.0.1", 0))
                puerto = libre.getsockname()[1]
    # pywebview sirve ui/ con bottle.static_file, que pierde su Cache-Control: sin él, WebView2 y WebKit pueden seguir
    # usando archivos viejos tras actualizar. Con no-cache el navegador pregunta siempre (304 si no ha cambiado).
    servir = bottle.static_file

    def sin_cache(*args, **kwargs):
        r = servir(*args, **kwargs)
        r.set_header("Cache-Control", "no-cache")
        return r
    bottle.static_file = sin_cache
    # Lo que WebView2 guardó antes sin esa cabecera lo seguiría dando por bueno: al cambiar de versión se vacía una vez
    version = DATOS / "ui.version"
    if not version.exists() or version.read_text(encoding="utf8") != actualizar.VERSION:
        for carpeta in ("Cache", "Code Cache"):
            shutil.rmtree(DATOS / "webview" / "EBWebView" / "Default" / carpeta, ignore_errors=True)
        version.write_text(actualizar.VERSION, encoding="utf8")
    # Perfil persistente: WebView2 guarda en disco la caché HTTP (imágenes de Scryfall incluidas).
    webview.start(comprobar_actualizacion, (api,), private_mode=False, storage_path=str(DATOS / "webview"), http_port=puerto)
