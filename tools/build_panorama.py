"""Build the full-route orthophoto and a separate relief material from elevation."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_terrain import OUT, build_overview


def build_relief(bounds):
    with Image.open(OUT / "corridor.png") as source:
        dem = np.asarray(source, dtype=np.float32)
    height = np.maximum(0, dem[:, :, 0] * 256 + dem[:, :, 1] - 512) * .001
    west, north, east, south = bounds
    cell_z = (south - north) / (height.shape[0] - 1)
    cell_x = (east - west) / (height.shape[1] - 1)
    # Separate the shorter terrain features from the broad rise of the plateau.
    encoded = Image.fromarray(np.uint8(np.clip(height / 8 * 255, 0, 255)))
    wide = np.asarray(encoded.filter(ImageFilter.GaussianBlur(5)), dtype=np.float32) * (8 / 255)
    dz, dx = np.gradient(height, cell_z, cell_x)
    sun = np.array([-.82, .34, -.43])
    sun /= np.linalg.norm(sun)
    slope = (-dx * sun[0] - dz * sun[2]) * 3.4
    direct = (sun[1] + slope) / np.sqrt(1 + 11.56 * (dx * dx + dz * dz))
    across = np.abs(height - wide)
    recess = np.clip((wide - height) * 1.65, 0, 1)
    rgb = np.stack((np.clip(.5 + (direct - sun[1]) * .70, 0, 1),
                    np.clip(.5 + (height - wide) * .70, 0, 1),
                    np.clip(across * 1.4 + recess * .27, 0, 1)), axis=-1)
    Image.fromarray(np.uint8(rgb * 255 + .5)).save(OUT / "corridor-relief.png", optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", default=Path(tempfile.gettempdir()) / "longmarch-panorama", type=Path)
    parser.add_argument("--basisu", default="basisu")
    parser.add_argument("--worldcover", type=Path, help="Terrascope WorldCover RGB map for the corridor bounds")
    parser.add_argument("--relief-only", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    bounds = manifest["regions"]["corridor"]["bounds"]
    build_relief(bounds)
    if args.worldcover:
        with Image.open(args.worldcover) as source:
            colors = np.asarray(source.convert("RGB"))
        red, green, blue = [colors[:, :, index] for index in range(3)]
        forest = (red <= 18) & (blue <= 18) & (green >= 58) & (green <= 120)
        Image.fromarray(np.uint8(forest) * 255).save(OUT / "corridor-forest-mask.png", optimize=True)
    if args.relief_only:
        return
    width = 7680
    height = round(width * (bounds[3] - bounds[1]) / (bounds[2] - bounds[0]) / 4) * 4
    image = build_overview(bounds, (width, height), args.cache)
    with tempfile.TemporaryDirectory(prefix="march-panorama-") as temp:
        source = Path(temp) / "corridor-hd.png"
        image.save(source)
        subprocess.run([
            args.basisu, "-ktx2", "-q", "255", "-comp_level", "1", "-mipmap", "-y_flip",
            "-max_threads", "6", "-file", str(source), "-output_file", str(OUT / "corridor-hd.ktx2"),
        ], check=True)


if __name__ == "__main__":
    main()
