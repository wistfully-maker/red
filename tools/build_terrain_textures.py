"""Encode the atlas's high-traffic imagery as GPU compressed KTX2 textures."""
import argparse
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets" / "terrain"
REGIONS = ("luding", "luding-near", "corridor-mobile", "corridor")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--basisu", default="basisu", help="Path to the Basis Universal encoder")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="march-textures-") as temp:
        for name in REGIONS:
            input_path = Path(temp) / f"{name}.png"
            output_path = Path(temp) / f"{name}.ktx2"
            with Image.open(ROOT / f"{name}.webp") as image:
                size = tuple((dimension + 3) // 4 * 4 for dimension in image.size)
                image.convert("RGB").resize(size, Image.Resampling.LANCZOS).save(input_path)
            subprocess.run([
                args.basisu, "-ktx2", "-q", "255", "-comp_level", "1", "-mipmap", "-y_flip",
                "-max_threads", "5", "-file", str(input_path), "-output_file", str(output_path),
            ], check=True)
            (ROOT / output_path.name).write_bytes(output_path.read_bytes())


if __name__ == "__main__":
    main()
