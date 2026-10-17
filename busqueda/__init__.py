"""Orquestador: lanza todas las tiendas a la vez; las páginas las abre tu navegador y las lee la extensión (modo asistido).

El ritmo real lo marcan los límites de cada dominio (ver navegador.Dominio), no el número de tiendas.
Uso:
    control = lanzar(cartas, tiendas, generales, emitir, datos_dir)
    control.parar()
emitir(tipo, **datos) recibe: abierta, extension_vieja, plan, progreso, resultado, no_tienda, tienda_fin, espera, captcha, extension, error, fin.
"""
import asyncio
import threading
from pathlib import Path

from .cache import Cache
from .navegador import Bloqueado, Dominio, Navegador, Parado
from .tiendas import resolver


class Control:
    def __init__(self):
        self.loop = None
        self.evento = None

    def parar(self):
        if self.loop and self.evento:
            self.loop.call_soon_threadsafe(self.evento.set)


def lanzar(cartas, tiendas, generales, emitir, datos_dir, refrescar=False, opciones=None):
    control = Control()
    threading.Thread(target=lambda: asyncio.run(_principal(control, cartas, tiendas, generales, emitir, datos_dir, refrescar, opciones or {})),
                     daemon=True).start()
    return control


async def _principal(control, cartas, tiendas, generales, emitir, datos_dir, refrescar, op):
    control.loop, control.evento = asyncio.get_running_loop(), asyncio.Event()
    cache = Cache(Path(datos_dir) / "cache.sqlite", float(op.get("cache_horas", 6)) * 3600)
    trabajos = [(t, *resolver(t)) for t in tiendas]
    dominios = {}
    for _, ad, _ in trabajos:
        dominios.setdefault(ad.dominio, Dominio(ad.dominio, ad.pestanas, max(ad.intervalo, float(op.get("pausa", 0)))))
    avisados = set()

    async def tienda(nombre, ad, usuario):
        em = lambda tipo, **d: emitir(tipo, tienda=nombre, **d)
        try:
            await ad.buscar(nav, dominios[ad.dominio], usuario, cartas, generales, em)
        except Parado:
            pass
        except Bloqueado as e:
            if ad.dominio not in avisados:  # un solo aviso por dominio
                avisados.add(ad.dominio)
                emitir("error", texto=str(e))
        except Exception as e:  # una tienda que falla no detiene a las demás
            em("error", texto=f"{nombre}: {str(e).splitlines()[0]}")
        em("tienda_fin")

    try:
        async with Navegador(cache, emitir, control.evento, refrescar, float(op.get("espera_extension", 20)),
                             bool(op.get("ocultar", True))) as nav:
            await asyncio.gather(*(tienda(*t) for t in trabajos))
    except Exception as e:
        emitir("error", texto=str(e))
    finally:
        cache.cerrar()
        emitir("fin")


PRUEBA = "https://www.cardmarket.com/es/Magic"


def probar(datos_dir, emitir, ocultar=True, segundos=90):
    """Abre una página de Cardmarket en el navegador y dice si la extensión ha contestado (bloqueante)."""
    async def _probar():
        cache = Cache(Path(datos_dir) / "cache.sqlite")
        try:
            async with Navegador(cache, emitir, asyncio.Event(), refrescar=True, sin_extension=segundos, ocultar=ocultar) as nav:
                try:
                    await asyncio.wait_for(nav.leer(PRUEBA, Dominio("cardmarket.com")), segundos)
                except Exception:
                    pass  # captcha, límite o bloqueo también prueban que la extensión responde
                return "vieja" if nav.extension_vieja else nav.extension_ok is True
        finally:
            cache.cerrar()
    return asyncio.run(_probar())
