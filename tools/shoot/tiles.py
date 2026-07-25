"""Downscale shoot.js PNGs to the 560x330 launcher tile size.

Tiles are rendered with object-fit: cover at aspect-ratio 560/330, so the source
is shot at 2x that box and supersampled down - crisper than a 1x grab.

Usage: python tiles.py <indir> <outdir> [name ...]
"""
import sys
import os
from PIL import Image

W, H = 560, 330

indir, outdir = sys.argv[1], sys.argv[2]
names = sys.argv[3:]
os.makedirs(outdir, exist_ok=True)

for f in sorted(os.listdir(indir)):
    if not f.endswith('.png'):
        continue
    name = f[:-4]
    if names and name not in names:
        continue
    im = Image.open(os.path.join(indir, f)).convert('RGB')
    # Crop to the tile aspect from the top-left before scaling, so nothing
    # squashes if a shot was framed at a different ratio.
    tw = min(im.width, int(im.height * W / H))
    th = min(im.height, int(im.width * H / W))
    im = im.crop((0, 0, tw, th))
    im = im.resize((W, H), Image.LANCZOS)
    dest = os.path.join(outdir, name + '.jpg')
    im.save(dest, 'JPEG', quality=88, optimize=True, progressive=True)
    print(f'{name}  {os.path.getsize(dest) // 1024}KB')
