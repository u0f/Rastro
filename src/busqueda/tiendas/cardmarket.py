"""Adaptador de Cardmarket: stock de un usuario en /<juego>/Users/<tienda>/Offers/Singles.

Cardmarket no tiene API abierta ni búsqueda por lista, y Cloudflare exige navegador real:
las páginas se abren en tu navegador y las lee la extensión Rastro (modo asistido).
Por eso, para cada tienda elige el camino con menos páginas:
  - inventario: si todo su stock (con los filtros generales) ocupa menos páginas que cartas buscamos,
    se lee entero (20 artículos por página) y se cruza en local;
  - por carta: si no, una consulta filtrada por nombre para cada carta.
"""
import asyncio
import html
import re
from urllib.parse import urlencode

BASE = "https://www.cardmarket.com"
JUEGO = "Magic"
IDIOMAS = {"en": 1, "fr": 2, "de": 3, "es": 4, "it": 5, "zh": 6, "ja": 7, "pt": 8, "ru": 9, "ko": 10, "zh-tw": 11}
NOMBRES_IDIOMA = dict(zip(IDIOMAS, ["English", "French", "German", "Spanish", "Italian", "S-Chinese",
                                    "Japanese", "Portuguese", "Russian", "Korean", "T-Chinese"]))
ESTADOS = {"MT": 1, "NM": 2, "EX": 3, "GD": 4, "LP": 5, "PL": 6, "PO": 7}
NOMBRES_ESTADO = {"Mint", "Near Mint", "Excellent", "Good", "Light Played", "Played", "Poor"}
SINO = {"si": "Y", "sí": "Y", "no": "N"}

# La lectura de la página la hace la extensión (extension/content.js, función extraer).


def precio_num(p):
    m = re.search(r"[\d.,]+", p)
    return float(m.group().replace(".", "").replace(",", ".")) if m else 0.0


def cara(nombre):
    """Cardmarket y Scryfall nombran las cartas dobles 'A // B'; se compara la cara frontal."""
    return nombre.split(" // ")[0].strip().lower()


def lista_idiomas(f):
    return [i.strip().lower() for i in f.get("idioma", "").split(",") if i.strip().lower() in IDIOMAS]


def parametros(f):
    """Filtros que Cardmarket aplica en servidor."""
    q = {}
    if idiomas := lista_idiomas(f):
        q["idLanguages"] = ",".join(str(IDIOMAS[i]) for i in idiomas)
    if f.get("estado", "").upper() in ESTADOS:
        q["condition"] = ESTADOS[f["estado"].upper()]
    for clave, param in (("foil", "isFoil"), ("firmada", "isSigned"), ("alterada", "isAltered")):
        if v := SINO.get(f.get(clave, "").lower()):
            q[param] = v
    for clave, param in (("min", "minPrice"), ("max", "maxPrice")):
        if f.get(clave):
            q[param] = str(f[clave]).replace(".", ",")
    return q


def limpiar(filas, nombre, f):
    """Filas que son exactamente esa carta y cumplen los filtros que se aplican en local."""
    idiomas = {NOMBRES_IDIOMA[i] for i in lista_idiomas(f)}
    edicion = f.get("edicion", "").lower()
    maximo = float(str(f["max"]).replace(",", ".")) if f.get("max") else None
    res = []
    for r in filas:
        if cara(r["nombre"]) != cara(nombre):
            continue
        if edicion and edicion not in r["edicion"].lower():
            continue
        idioma = next((l for l in r["labels"] if l in NOMBRES_IDIOMA.values()), "")
        if idiomas and idioma not in idiomas:
            continue
        p = precio_num(r["precio"])
        if not p:  # sin precio visible (p. ej. el vendedor no envía a tu país): no se puede comprar
            continue
        if maximo is not None and p > maximo:
            continue
        extras = [l for l in r["labels"][2:] if l not in NOMBRES_IDIOMA.values() and l not in NOMBRES_ESTADO and l != r["estado"]]
        # Si el vendedor subió una foto del artículo, Cardmarket la pone como <img src=...> en un tooltip
        foto = next((m.group(1) for l in extras if (m := re.search(r'src="([^"]+)"', l))), "")
        extras = [l for l in extras if "<" not in l]
        res.append({"nombre": r["nombre"], "edicion": r["edicion"], "idioma": idioma, "estado": r["estado"],
                    "extras": ", ".join(extras), "foto": html.unescape(foto), "precio": r["precio"], "precio_num": p,
                    "cantidad": int(re.sub(r"\D", "", r["cantidad"]) or 1), "comentario": r["comentario"]})
    return sorted(res, key=lambda r: r["precio_num"])


class Cardmarket:
    sitio = "cardmarket"
    dominio = "cardmarket.com"
    pestanas = 1       # una sola pestaña de Rastro en tu navegador
    intervalo = 1.5    # y al menos 1,5 s entre el inicio de dos páginas

    def url(self, tienda, q=None, pagina=1):
        q = dict(q or {})
        if pagina > 1:
            q["site"] = pagina
        return f"{BASE}/en/{JUEGO}/Users/{tienda}/Offers/Singles" + (f"?{urlencode(q)}" if q else "")

    def enlace(self, tienda, nombre=None):
        return self.url(tienda, {"name": nombre.split(" // ")[0]} if nombre else None)

    async def _todas(self, nav, dom, tienda, q, primera=None, al_pagina=None):
        """Filas de todas las páginas de una consulta."""
        datos = primera or await nav.leer(self.url(tienda, q), dom)
        filas = list(datos["filas"])
        if al_pagina:
            al_pagina(1, datos["paginas"])
        for pagina in range(2, datos["paginas"] + 1):
            filas += (await nav.leer(self.url(tienda, q, pagina), dom))["filas"]
            if al_pagina:
                al_pagina(pagina, datos["paginas"])
        return filas

    async def buscar(self, nav, dom, tienda, cartas, generales, emitir):
        base = parametros(generales)
        primera = await nav.leer(self.url(tienda, base), dom)
        if f"/users/{tienda.lower()}/" not in primera["url_final"].lower():
            emitir("no_tienda")
            return

        # Cartas con foil propio necesitan su propia consulta; el resto vale para el modo inventario
        propias = [c for c in cartas if "foil" in c["filtros"]]
        comunes = [c for c in cartas if "foil" not in c["filtros"]]
        consultas = {}  # (nombre, parámetros) -> [cartas]
        for c in propias + comunes:
            q = {**base, **parametros({k: v for k, v in c["filtros"].items() if k == "foil"}), "name": c["nombre"].split(" // ")[0]}
            consultas.setdefault(tuple(sorted(q.items())), []).append(c)
        inventario = primera["paginas"] <= len({cara(c["nombre"]) for c in comunes})

        hecho = 0
        if inventario:
            total = primera["paginas"] + len({k for k, cs in consultas.items() if any(c in propias for c in cs)})
        else:
            total = len(consultas)
        emitir("plan", modo="inventario" if inventario else "carta", total=total, stock=primera["hits"])

        def avanzar(n=1):
            nonlocal hecho
            hecho += n
            emitir("progreso", hecho=hecho, total=total)

        def publicar(cs, filas):
            for c in cs:
                emitir("resultado", id=c["id"], filas=limpiar(filas, c["nombre"], {**generales, **c["filtros"]}),
                       enlace=self.enlace(tienda, c["nombre"]))

        if inventario:
            stock = await self._todas(nav, dom, tienda, base, primera, lambda p, n: avanzar())
            publicar(comunes, stock)
            consultas = {k: [c for c in cs if c in propias] for k, cs in consultas.items()}
            consultas = {k: cs for k, cs in consultas.items() if cs}

        async def una(clave, cs):
            filas = await self._todas(nav, dom, tienda, dict(clave))
            publicar(cs, filas)
            avanzar()

        # Las consultas de la tienda se lanzan juntas; el límite del dominio decide el ritmo real
        await asyncio.gather(*(una(k, cs) for k, cs in consultas.items()))
