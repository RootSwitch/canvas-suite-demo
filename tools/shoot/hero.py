"""Composite four shoot.js PNGs into a 2x2 hero-quadrants image.

Heroes are the THEME showcase: four views of one app, each in a different
theme, butted together with no gap. (Tiles are the opposite job - one theme,
see tiles.py and the README.)

Quadrants are shot at 2x the final quadrant box and supersampled down, so the
text stays sharp at the size GitHub renders a README image.

Usage: python hero.py <indir> <out.png> <tl> <tr> <bl> <br>
"""
import sys
from PIL import Image

QW, QH = 1600, 1000

indir, out = sys.argv[1], sys.argv[2]
names = sys.argv[3:7]
if len(names) != 4:
    raise SystemExit(__doc__)

hero = Image.new('RGB', (QW * 2, QH * 2))
for i, n in enumerate(names):
    im = Image.open(f'{indir}/{n}.png').convert('RGB')
    if im.size != (QW, QH):
        im = im.resize((QW, QH), Image.LANCZOS)
    hero.paste(im, ((i % 2) * QW, (i // 2) * QH))
hero.save(out, 'PNG', optimize=True)
print(f'{out}  {hero.size[0]}x{hero.size[1]}')
