"""Actualización automática del .exe desde las Releases de GitHub.

Al arrancar, Rastro mira la última Release de REPO. Si su etiqueta (v1.2.0) es mayor que VERSION, baja el
archivo Rastro.exe adjunto, lo pone en lugar del actual y se reinicia. Windows no deja borrar un .exe en uso,
pero sí renombrarlo: el viejo pasa a Rastro.old.exe y se borra en el siguiente arranque.
Solo actúa en el .exe (PyInstaller); desde el código fuente no hace nada.

Para publicar una versión: sube VERSION, crea el .exe con build.bat y haz una Release en GitHub con la
etiqueta vX.Y.Z y el archivo Rastro.exe adjunto.
"""
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

VERSION = "1.6.0"
REPO = "u0f/Rastro"  # "usuario/repositorio" de GitHub; vacío = no se buscan actualizaciones
ARCHIVO = "Rastro.exe"

EXE = Path(sys.executable)
VIEJO = EXE.with_name(EXE.stem + ".old.exe")


def _num(v):
    return tuple(int(x) for x in v.lstrip("vV").split(".") if x.isdigit())


def buscar():
    """(versión, url de descarga) si hay una Release más nueva que esta, si no None.
    Lanza OSError si no se puede consultar GitHub (sin conexión, sin Releases…)."""
    if not getattr(sys, "frozen", False) or not REPO:
        return None
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/releases/latest",
                                 headers={"Accept": "application/vnd.github+json", "User-Agent": "Rastro"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            rel = json.load(r)
    except ValueError as e:
        raise OSError("respuesta no válida de GitHub") from e
    url = next((a["browser_download_url"] for a in rel.get("assets", []) if a["name"] == ARCHIVO), None)
    if url and _num(rel.get("tag_name", "")) > _num(VERSION):
        return rel["tag_name"].lstrip("vV"), url


def instalar(url):
    """Baja el .exe nuevo, lo cambia por el actual y lo abre. Quien llama debe cerrar la app después."""
    nuevo = EXE.with_name(EXE.stem + ".new.exe")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Rastro"}), timeout=120) as r:
        nuevo.write_bytes(r.read())
    if nuevo.stat().st_size < 1_000_000:  # una descarga cortada no puede sustituir al .exe bueno
        nuevo.unlink()
        raise OSError("descarga incompleta")
    VIEJO.unlink(missing_ok=True)
    EXE.rename(VIEJO)
    try:
        nuevo.rename(EXE)
    except OSError:
        VIEJO.rename(EXE)
        raise
    # Instancia independiente: que no reutilice la carpeta temporal de este proceso (PyInstaller onefile)
    subprocess.Popen([str(EXE)], env={**os.environ, "PYINSTALLER_RESET_ENVIRONMENT": "1"})


def limpiar():
    """Borra el .exe de la versión anterior, si quedó de una actualización."""
    try:
        VIEJO.unlink(missing_ok=True)
    except OSError:
        pass  # aún se está cerrando; se borrará la próxima vez
