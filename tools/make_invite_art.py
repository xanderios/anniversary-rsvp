"""Builds the invitation art plate: the original card (referencias/4.webp) with all lettering
lifted off, so the words can be set as real HTML text on top.
Usage: python make_invite_art.py <in.webp> <out.jpg>"""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255.0

# 1) estimate the bare paper everywhere: blur only the pixels that already look like paper
lum = a.mean(axis=2)
sat = a.max(axis=2) - a.min(axis=2)
paper_mask = ((lum > 0.955) & (sat < 0.045)).astype(np.float32)
def blur(arr, r):
    return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0
num = np.stack([blur(a[..., c] * paper_mask, 28) for c in range(3)], axis=2)
den = blur(paper_mask, 28)[..., None]
paper = num / np.maximum(den, 1e-3)

# 2) the lettering blocks (pixel boxes on the 853x1280 original)
BOXES = [
    (232, 226, 608, 390),    # poem
    (284, 400, 542, 438),    # heart divider
    (222, 446, 594, 514),    # voce e nosso convidado
    (366, 520, 460, 588),    # crown
    (92, 572, 736, 724),     # Maria Alice
    (222, 728, 628, 774),    # 1 ano
    (84, 804, 292, 936),     # date
    (292, 804, 470, 988),    # time + rules
    (470, 804, 757, 1012),   # place
    (280, 1024, 586, 1126),  # sera uma alegria
    (348, 1126, 504, 1168),  # flourish
]
sx, sy = W / 853.0, H / 1280.0
m = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(m)
for x0, y0, x1, y1 in BOXES:
    d.rectangle([x0 * sx, y0 * sy, x1 * sx, y1 * sy], fill=255)
m = np.asarray(m.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255.0
res = a * (1 - m) + paper * m
Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).save(out, quality=92)
print("saved", out, W, H)
