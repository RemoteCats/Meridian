#!/usr/bin/env python3
"""Cut the supplied logo sheet into the three files the site uses.

The sheet arrives as flat artwork on white: a gold building mark, MERIDIAN in
near-black, CONSTRUCTIONS in gold underneath. The site needs it keyed out of
that white, in two colourways, and the mark on its own for the nav.

Three things happen here:

  1. The white is keyed out rather than cropped, so the logo sits on the nav,
     the footer and anything else without a white box around it.
  2. The gold is lifted to the site's construction yellow. The drawn gold is a
     dark bronze that disappears against the near-black surfaces the logo
     actually sits on; the yellow is the same one the buttons and the CTA band
     use, so the logo belongs to the palette rather than arriving from a
     different brand.
  3. The near-black type is repainted to paper for the dark colourway, and
     left alone for the light one.

Only run when the logo sheet changes:  python3 scripts/make-brand.py
Needs Pillow (pip install Pillow); nothing else in the build depends on it,
which is why it is not an npm script.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(HERE, '..', 'public', 'assets', 'brand')
SOURCE = os.path.join(BRAND, 'meridian-logo-source.webp')

# Construction yellow, the same value as --meridian-flare in the stylesheet,
# and the paper the dark colourway's type is set in.
YELLOW = (255, 200, 8)
YELLOW_DEEP = (226, 160, 0)   # the gold's own shadows, kept one step down
PAPER = (247, 245, 239)
INK = (16, 18, 21)


def keyed(img):
    """White out, everything else kept with its own alpha.

    Alpha is how far the pixel is from white; colour is then un-premultiplied
    so a thin gold stroke that was blended into the white page comes back at
    full strength instead of washed out.
    """
    img = img.convert('RGB')
    w, h = img.size
    out = Image.new('RGBA', (w, h))
    src = img.load()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            a = 255 - min(r, g, b)
            if a <= 4:
                dst[x, y] = (0, 0, 0, 0)
                continue
            f = a / 255.0
            un = lambda c: max(0, min(255, int(round((c - 255 * (1 - f)) / f))))
            dst[x, y] = (un(r), un(g), un(b), a)
    return out


def is_gold(r, g, b):
    """Gold on this sheet: warm, with red clearly ahead of blue."""
    return r - b > 40 and r >= g >= b


def recolour(img, gold=YELLOW, gold_deep=YELLOW_DEEP, type_colour=None):
    """Repaint the gold, and optionally the near-neutral type."""
    img = img.copy()
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_gold(r, g, b):
                # Keep the stroke's own shading: the darker the drawn gold, the
                # closer it stays to the deep end of the new yellow.
                lift = min(1.0, max(0.0, (r - 140) / 50.0))
                px[x, y] = (
                    int(gold_deep[0] + (gold[0] - gold_deep[0]) * lift),
                    int(gold_deep[1] + (gold[1] - gold_deep[1]) * lift),
                    int(gold_deep[2] + (gold[2] - gold_deep[2]) * lift),
                    a,
                )
            elif type_colour is not None and max(r, g, b) - min(r, g, b) < 26:
                px[x, y] = (*type_colour, a)
    return img


def trimmed(img, pad=6):
    box = img.getbbox()
    if not box:
        return img
    l, t, r, b = box
    w, h = img.size
    return img.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))


def save(img, name, width):
    img = img.copy()
    if img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = os.path.join(BRAND, name)
    img.save(path, 'WEBP', quality=92, method=6)
    print(f'[brand] {name}  {img.width}x{img.height}  {os.path.getsize(path) // 1024} KB')


def main():
    sheet = keyed(Image.open(SOURCE))

    # The mark is the building above the wordmark. The sheet is square and the
    # type starts a little under halfway down, so the mark is the top band.
    whole = trimmed(sheet)
    mark = trimmed(sheet.crop((0, 0, sheet.width, int(sheet.height * 0.57))))

    save(recolour(whole), 'meridian-logo.webp', 656)                       # dark type
    save(recolour(whole, type_colour=PAPER), 'meridian-logo-light.webp', 656)  # paper type
    save(recolour(mark), 'meridian-mark.webp', 368)

    # A favicon-sized mark, so the tab icon is the logo rather than a letter.
    icon = recolour(mark)
    square = Image.new('RGBA', (max(icon.size),) * 2)
    square.paste(icon, ((square.width - icon.width) // 2, (square.height - icon.height) // 2))
    flat = Image.new('RGBA', square.size, (*INK, 255))
    flat.alpha_composite(square)
    flat.resize((180, 180), Image.LANCZOS).save(
        os.path.join(HERE, '..', 'public', 'apple-touch-icon.png'))
    flat.resize((64, 64), Image.LANCZOS).save(os.path.join(HERE, '..', 'public', 'favicon.png'))
    print('[brand] favicon.png, apple-touch-icon.png')


if __name__ == '__main__':
    main()
