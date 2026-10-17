"""Dibuja el logo de Rastro (una carta dorada y el rastro de maná que lleva a ella) y genera:
assets/logo.png, assets/logo.ico (icono del .exe), ui/logo.png y los iconos de la extensión.
Uso: py assets/logo.py   (necesita Pillow)"""
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).parent
S = 1024  # se dibuja grande y se reduce: bordes suaves en todos los tamaños


def logo():
    im = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, S - 1, S - 1), radius=S * .22, fill="#11151d", outline="#343d4f", width=S // 64)

    # Carta dorada, inclinada
    carta = Image.new("RGBA", (S, S))
    c = ImageDraw.Draw(carta)
    w, h, cx, cy = S * .42, S * .56, S * .62, S * .40
    x0, y0 = cx - w / 2, cy - h / 2
    c.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=S * .045, fill="#d9a94e")
    m = S * .04
    c.rounded_rectangle((x0 + m, y0 + m, x0 + w - m, y0 + h * .55), radius=S * .02, fill="#1a1408")
    c.rounded_rectangle((x0 + m, y0 + h * .63, x0 + w - m, y0 + h * .69), radius=S * .015, fill="#8a6a2c")
    c.rounded_rectangle((x0 + m, y0 + h * .75, x0 + w * .7, y0 + h * .81), radius=S * .015, fill="#8a6a2c")
    im.alpha_composite(carta.rotate(-14, resample=Image.BICUBIC, center=(cx, cy)))

    # Rastro: tres gotas de maná que llevan a la carta
    for (x, y, r, color) in ((.13, .89, .04, "#4b8fe2"), (.25, .845, .05, "#e45b43"), (.385, .78, .06, "#3ea96c")):
        d.ellipse((S * (x - r), S * (y - r), S * (x + r), S * (y + r)), fill=color)
    return im


if __name__ == "__main__":
    im = logo()
    raiz = AQUI.parent
    im.resize((512, 512), Image.LANCZOS).save(AQUI / "logo.png")
    im.resize((256, 256), Image.LANCZOS).save(raiz / "ui" / "logo.png")
    im.save(AQUI / "logo.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    (raiz / "extension" / "iconos").mkdir(exist_ok=True)
    for n in (16, 32, 48, 128):
        im.resize((n, n), Image.LANCZOS).save(raiz / "extension" / "iconos" / f"{n}.png")
