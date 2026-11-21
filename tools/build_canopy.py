"""Bake an alpha cutout for the atlas's middle distance tree crowns."""
from pathlib import Path
import random
from PIL import Image, ImageDraw

SIZE = 256
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "materials" / "canopy.png"


def make_crown(draw, offset, conifer):
    rng = random.Random(7177 if conifer else 91421)
    left = offset
    def leaf(x, y, radius, shade):
        ratio = rng.uniform(.62, 1.35)
        draw.ellipse((left + x - radius, y - radius * ratio, left + x + radius, y + radius * ratio),
                     fill=(shade, shade, shade, 255))

    draw.line((left + 128, 238, left + 129, 68), fill=(84, 84, 84, 255), width=6)
    groups = ([(128, 50, 27), (128, 88, 41), (128, 127, 62), (128, 163, 83), (128, 193, 86)]
              if conifer else [(77, 135, 45), (165, 124, 54), (121, 74, 49), (133, 126, 59), (126, 167, 40)])
    for cx, cy, spread in groups:
        draw.line((left + 128, min(cy + 43, 220), left + cx, cy), fill=(91, 91, 91, 255), width=4)
        for _ in range(470):
            x, y = rng.uniform(-1, 1), rng.uniform(-1, 1)
            if x * x + y * y > 1:
                continue
            radius = rng.uniform(1.4, 6) * (1 - .38 * (x * x + y * y))
            shade = round(168 + rng.uniform(-35, 30) - x * 21 - y * 13)
            leaf(cx + x * spread, cy + y * spread * (.38 if conifer else .85), radius, shade)


image = Image.new("RGBA", (SIZE * 2, SIZE))
canvas = ImageDraw.Draw(image)
make_crown(canvas, 0, False)
make_crown(canvas, SIZE, True)
image.save(OUTPUT, optimize=True)
