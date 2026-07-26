"""Tile four 2:1 shots into a 1280x640 social preview.

Most socials are shot as a single view in Classic (see shots-social.json),
because a four-quadrant grid usually turns to mush at link-card size. CrossCanvas
is the exception: its hero is four different DIAGRAMS rather than four views of
one screen, so what survives the downscale is exactly what should - four
distinct shapes in four palettes. Labels are unreadable at 1280x640 either way,
so nothing is lost by keeping all four.

Why this takes its own shot list rather than cropping the hero: a hero quadrant
is 1600x1000 (1.6:1) and a social cell is 2:1. Cropping to fit shaves the bottom
off every diagram, and centre-cropping the assembled hero is worse still - it
takes the header off the top row and slices the bottom row mid-diagram, reading
as a broken screenshot rather than a grid. Shooting at 1600x800 instead lets
CrossCanvas's own `fit=1` refit each diagram into the shorter canvas, so every
quadrant arrives complete.

Usage: python social.py <indir> <out.png> <tl> <tr> <bl> <br>
"""
import sys
from PIL import Image

CELL_W, CELL_H = 640, 320

indir, out = sys.argv[1], sys.argv[2]
names = sys.argv[3:7]
if len(names) != 4:
    raise SystemExit(__doc__)

card = Image.new('RGB', (CELL_W * 2, CELL_H * 2))
for i, n in enumerate(names):
    im = Image.open(f'{indir}/{n}.png').convert('RGB')
    if im.size != (CELL_W, CELL_H):
        im = im.resize((CELL_W, CELL_H), Image.LANCZOS)
    card.paste(im, ((i % 2) * CELL_W, (i // 2) * CELL_H))
card.save(out, 'PNG', optimize=True)
print(f'{out}  {card.size[0]}x{card.size[1]}')
