"""Adaptadores de tienda. Para añadir un sitio nuevo, crea un módulo con una clase como Cardmarket y regístrala aquí.

Contrato de un adaptador:
    sitio: str                    # clave usada en la lista de tiendas ("cardmarket")
    dominio: str                  # dominio al que se aplican los límites de cortesía
    pestanas: int, intervalo: float   # páginas a la vez y pausa mínima en ese dominio
    enlace(tienda, nombre=None) -> str
    async buscar(nav, dom, tienda, cartas, generales, emitir) -> None   # usa await nav.leer(url, dom)
        cartas: [{"id", "nombre", "filtros"}]   generales: filtros comunes (idioma, estado, foil, max...)
        Debe emitir: plan(modo, total), progreso(hecho, total), resultado(id, filas) por carta, o no_tienda.
        Cada fila: nombre, edicion, idioma, estado, extras, precio (texto), precio_num, cantidad (int), comentario.
"""
from .cardmarket import Cardmarket

ADAPTADORES = {a.sitio: a for a in (Cardmarket(),)}
POR_DEFECTO = "cardmarket"


def resolver(tienda):
    """'MiTienda' -> (Cardmarket, 'MiTienda');  'otrositio:Pepe' -> (OtroSitio, 'Pepe')."""
    sitio, _, usuario = tienda.rpartition(":")
    return ADAPTADORES[sitio or POR_DEFECTO], usuario
