"""Modo asistido: las páginas se abren en TU navegador predeterminado (con tu sesión) y la extensión Rastro (carpeta extension/) las lee.

Flujo:
  1. leer(url) deja la URL como tarea pendiente, respetando el ritmo del dominio.
  2. Si ninguna pestaña de Rastro está escuchando, se abre esa URL en el navegador como un enlace normal.
  3. La extensión lee la página y la manda a este servidor local (127.0.0.1); la respuesta le dice
     a qué URL ir después, así que se reutiliza siempre la misma pestaña.
  4. Si sale la verificación de Cloudflare, la extensión trae la pestaña delante, se avisa a la interfaz
     y se espera a que la resuelvas tú.
Solo se tocan pestañas abiertas por Rastro (marca #rastro=... en la URL), nunca tu navegación normal.
No hay automatización del navegador: no se usa Playwright ni se disimula nada.
"""
import asyncio
import concurrent.futures
import json
import os
import secrets
import threading
import time
import winreg
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Versión de la extensión que trae esta Rastro: si la instalada es otra, hay que volver a descargarla
VERSION_EXTENSION = json.loads((Path(__file__).parent.parent / "extension" / "manifest.json").read_text(encoding="utf8"))["version"]
PUERTO = 47321          # el mismo que usa extension/background.js
MARCA = "rastro"
REINTENTOS = 4
BACKOFF = 15            # segundos de la primera espera tras "demasiadas peticiones" (15, 30, 60, 120)
PERDIDA = 60            # si una página tomada no responde en este tiempo, se vuelve a abrir
SIN_EXTENSION = 20      # segundos sin noticias de la extensión antes de avisar (configurable en Opciones)


# Navegadores Chromium que admiten la extensión: trozo de su ProgId en el registro -> (nombre, página de extensiones)
COMPATIBLES = {"brave": ("Brave", "brave://extensions"), "chrome": ("Chrome", "chrome://extensions"),
               "msedge": ("Edge", "edge://extensions"), "opera": ("Opera", "opera://extensions"),
               "vivaldi": ("Vivaldi", "vivaldi://extensions")}


def navegador_usado():
    """Navegador predeterminado de Windows, donde se abren las páginas.
    Devuelve (nombre, página de extensiones), con página None si ese navegador no admite la extensión."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice") as k:
            progid = winreg.QueryValueEx(k, "ProgId")[0].lower()
    except OSError:
        progid = ""
    for clave, nav in COMPATIBLES.items():
        if clave in progid:
            return nav
    return ("Firefox" if "firefox" in progid else "desconocido", None)


def abrir_en_navegador(url):
    """Abre la URL en el navegador predeterminado, como si hicieras clic en un enlace."""
    os.startfile(url)


class Parado(Exception):
    """El usuario ha pulsado Parar."""


class Bloqueado(Exception):
    """El sitio ha bloqueado el acceso: no tiene sentido seguir insistiendo."""


class Dominio:
    """Límites de cortesía de un sitio: páginas a la vez y pausa mínima entre peticiones."""

    def __init__(self, nombre, pestanas=1, intervalo=1.5):
        self.nombre = nombre
        self.sem = asyncio.Semaphore(pestanas)
        self.intervalo = intervalo
        self.siguiente = 0.0
        self.lock = asyncio.Lock()
        self.libre = asyncio.Event()  # se cierra durante un backoff
        self.libre.set()
        self.bloqueado = None

    async def turno(self):
        await self.libre.wait()
        async with self.lock:
            ahora = time.monotonic()
            espera = max(0.0, self.siguiente - ahora)
            self.siguiente = max(ahora, self.siguiente) + self.intervalo
        if espera:
            await asyncio.sleep(espera)
        await self.libre.wait()


class _Manejador(BaseHTTPRequestHandler):
    nav = None  # se asigna al arrancar

    def do_POST(self):
        if self.path != "/pagina":
            self.send_error(404)
            return
        try:
            msg = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            resp = self.nav.recibir(msg)
            resp["ocultar"] = self.nav.ocultar  # la extensión lo recuerda para la próxima pestaña
        except Exception as e:  # nunca dejar a la extensión sin respuesta
            resp = {"esperar": True, "error": str(e)}
        cuerpo = json.dumps(resp).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, *a):
        pass


class Navegador:
    def __init__(self, cache, emitir, parar, refrescar=False, sin_extension=SIN_EXTENSION, ocultar=True):
        self.cache, self.emitir, self.parar, self.refrescar = cache, emitir, parar, refrescar
        self.sin_extension, self.ocultar = sin_extension, ocultar
        self.tarea = None            # {"token", "marcada", "tomada", "desde"}: la página que toca ahora
        self.esperando = {}          # token -> future con lo que mande la extensión
        self.ultimo_contacto = 0.0
        self.en_reto = False
        self.extension_ok = None
        self.extension_vieja = False
        self.cerrado = False

    async def __aenter__(self):
        self.loop = asyncio.get_running_loop()
        self.cambio = asyncio.Event()
        _Manejador.nav = self
        try:
            self.servidor = ThreadingHTTPServer(("127.0.0.1", PUERTO), _Manejador)
        except OSError:
            raise RuntimeError(f"El puerto {PUERTO} está ocupado. ¿Hay otra búsqueda de Rastro abierta?")
        self.servidor.daemon_threads = True
        threading.Thread(target=self.servidor.serve_forever, daemon=True).start()
        return self

    async def __aexit__(self, *exc):
        self.cerrado = True
        self.cambio.set()                  # las pestañas que esperan reciben "fin"
        await asyncio.sleep(0.5)
        await self.loop.run_in_executor(None, self.servidor.shutdown)
        self.servidor.server_close()

    # ---------- Lado de la extensión (hilos del servidor HTTP) ----------
    def recibir(self, msg):
        self.ultimo_contacto = time.monotonic()
        self.loop.call_soon_threadsafe(self._extension, True)
        if msg.get("v") != VERSION_EXTENSION and not self.extension_vieja:
            self.extension_vieja = True
            self.loop.call_soon_threadsafe(lambda: self.emitir("extension_vieja", instalada=msg.get("v"), nueva=VERSION_EXTENSION))
        tipo, token = msg.get("tipo"), msg.get("token")
        if tipo == "reto":
            self.loop.call_soon_threadsafe(self._reto, True)
            return {"esperar": True}       # la página se recarga sola cuando lo resuelves
        if tipo in ("datos", "limite", "bloqueado") and token:
            self.loop.call_soon_threadsafe(self._resolver, token, msg)
        if self.cerrado:
            return {"fin": True}
        fut = asyncio.run_coroutine_threadsafe(self._siguiente(), self.loop)
        try:
            url = fut.result(timeout=20)   # espera larga: menos de 30 s para no dormir a la extensión
        except concurrent.futures.TimeoutError:
            fut.cancel()
            return {"esperar": True}
        return {"url": url} if url else {"fin": True}

    async def _siguiente(self):
        while not self.cerrado:
            t = self.tarea
            if t and not t["tomada"]:
                t["tomada"], t["desde"] = True, time.monotonic()
                return t["marcada"]
            self.cambio.clear()
            await self.cambio.wait()
        return None

    def _resolver(self, token, msg):
        fut = self.esperando.pop(token, None)
        if fut and not fut.done():
            fut.set_result(msg)
        self._reto(False)

    def _reto(self, activo):
        if activo != self.en_reto:
            self.en_reto = activo
            self.emitir("captcha", activo=activo)

    def _extension(self, ok):
        if ok != self.extension_ok:
            self.extension_ok = ok
            self.emitir("extension", ok=ok)

    def _abrir(self, url):
        """La extensión esconde la pestaña en una ventana minimizada; "abierta" avisa para que Rastro vuelva delante."""
        abrir_en_navegador(url)
        self.emitir("abierta", ocultar=self.ocultar)

    # ---------- Lado de los adaptadores ----------
    async def dormir(self, segundos):
        """Espera interrumpible por Parar."""
        try:
            await asyncio.wait_for(self.parar.wait(), timeout=segundos)
        except asyncio.TimeoutError:
            return
        raise Parado

    async def leer(self, url, dom):
        """Devuelve lo que la extensión extrae de url (dict). Usa la caché si está fresca."""
        if not self.refrescar and (c := self.cache.get(url)) is not None:
            return c
        for intento in range(REINTENTOS + 1):
            if self.parar.is_set():
                raise Parado
            if dom.bloqueado:
                raise Bloqueado(dom.bloqueado)
            async with dom.sem:
                await dom.turno()
                r = await self._pedir(url)
            if r["tipo"] == "datos":
                self.cache.set(url, r["datos"])
                return r["datos"]
            if r["tipo"] == "bloqueado":
                dom.bloqueado = f"{dom.nombre} ha bloqueado el acceso. Espera un rato antes de volver a intentarlo."
                raise Bloqueado(dom.bloqueado)
            # "limite": demasiadas peticiones -> todo el dominio espera y se reintenta
            espera = BACKOFF * 2 ** intento
            dom.libre.clear()
            self.emitir("espera", dominio=dom.nombre, segundos=espera)
            try:
                await self.dormir(espera)
            finally:
                dom.libre.set()
                self.emitir("espera", dominio=dom.nombre, segundos=0)
        raise RuntimeError(f"{dom.nombre} sigue pidiendo ir más despacio; prueba más tarde")

    async def _pedir(self, url):
        token = secrets.token_hex(6)
        fut = self.loop.create_future()
        self.esperando[token] = fut
        marcada = f"{url}#{MARCA}={token}"
        self.tarea = t = {"token": token, "marcada": marcada, "tomada": False, "desde": 0.0}
        self.cambio.set()
        try:
            while True:
                ahora = time.monotonic()
                if not t["tomada"] and ahora - self.ultimo_contacto > 10:
                    # Ninguna pestaña de Rastro escuchando: se abre una nueva con esta página
                    self._abrir(marcada)
                    t["tomada"], t["desde"] = True, ahora
                elif t["tomada"] and not self.en_reto and ahora - t["desde"] > PERDIDA:
                    self._abrir(marcada)  # la pestaña se cerró o se quedó colgada
                    t["desde"] = ahora
                if t["tomada"] and not self.en_reto and ahora - max(t["desde"], self.ultimo_contacto) > self.sin_extension:
                    if self.extension_ok is None:
                        # Nunca ha contestado: no está instalada o se ha quitado. Se para todo.
                        self._extension(False)
                        self.parar.set()
                        raise Parado
                    self._extension(False)
                try:
                    return await asyncio.wait_for(asyncio.shield(fut), timeout=2)
                except asyncio.TimeoutError:
                    pass
                if self.parar.is_set():
                    raise Parado
        finally:
            self.esperando.pop(token, None)
            if self.tarea is t:
                self.tarea = None
