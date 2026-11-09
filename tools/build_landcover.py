"""Project small ESA WorldCover 2021 windows onto the station texture grid.

Requires rasterio, NumPy and Pillow. COGs are read over HTTP byte ranges.
"""
from contextlib import ExitStack
from functools import lru_cache
from io import RawIOBase
import json
import math
import os
import re
import subprocess

import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import Window, from_bounds as source_window

from build_terrain import OUT

ROOT = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
CHUNK = 128 * 1024


def curl(*args):
    flags = ["--ssl-revoke-best-effort"] if os.name == "nt" else []
    return subprocess.run(
        ["curl", "-fLsS", *flags, "--retry", "1", "--max-time", "24", *args],
        capture_output=True, check=True
    ).stdout


@lru_cache(maxsize=32)
def object_length(url):
    match = re.search(rb"bytes 0-0/(\d+)", curl("-r", "0-0", "-w", "%header{content-range}", url))
    if not match:
        raise ValueError("Missing WorldCover object length")
    return int(match.group(1))


@lru_cache(maxsize=180)
def object_chunk(url, start):
    end = min(start + CHUNK, object_length(url))
    data = curl("-r", f"{start}-{end - 1}", url)
    if len(data) != end - start:
        raise ValueError(f"Unexpected WorldCover byte range length: {len(data)}")
    return data


class COGReader(RawIOBase):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.size = object_length(url)
        self.offset = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.offset

    def seek(self, offset, whence=0):
        origins = (0, self.offset, self.size)
        self.offset = origins[whence] + offset
        return self.offset

    def read(self, size=-1):
        end = self.size if size < 0 else min(self.size, self.offset + size)
        output = bytearray()
        while self.offset < end:
            start = self.offset // CHUNK * CHUNK
            data = object_chunk(self.url, start)
            stop = min(end, start + CHUNK)
            output.extend(data[self.offset - start:stop - start])
            self.offset = stop
        return bytes(output)

    def readinto(self, target):
        data = self.read(len(target))
        target[:len(data)] = data
        return len(data)


def open_cog(path, mode="rb"):
    name = os.path.basename(path)
    if not name.endswith("_Map.tif") or mode != "rb":
        raise FileNotFoundError(path)
    return COGReader(ROOT + name)


def tile_name(lat, lon):
    return f"ESA_WorldCover_10m_2021_v200_{'N' if lat >= 0 else 'S'}{abs(lat):02d}{'E' if lon >= 0 else 'W'}{abs(lon):03d}_Map.tif"


def extract(bounds, sources, stack):
    west, north, east, south = bounds
    projected = (west * 1000, -south * 1000, east * 1000, -north * 1000)
    bbox = transform_bounds("EPSG:3857", "EPSG:4326", *projected)
    columns = 832
    rows = round(columns * (south - north) / (east - west))
    cover = np.zeros((rows, columns), dtype=np.uint8)
    transform = from_bounds(*projected, columns, rows)
    for lat in range(math.floor(bbox[1] / 3) * 3, math.floor(bbox[3] / 3) * 3 + 1, 3):
        for lon in range(math.floor(bbox[0] / 3) * 3, math.floor(bbox[2] / 3) * 3 + 1, 3):
            name = tile_name(lat, lon)
            if name not in sources:
                sources[name] = stack.enter_context(rasterio.open(name, opener=open_cog))
            source = sources[name]
            window = source_window(*bbox, transform=source.transform).round_offsets().round_lengths()
            window = window.intersection(Window(0, 0, source.width, source.height))
            reproject(
                source.read(1, window=window),
                cover,
                src_transform=source.window_transform(window),
                src_crs=source.crs,
                src_nodata=0,
                dst_transform=transform,
                dst_crs="EPSG:3857",
                dst_nodata=0,
                init_dest_nodata=False,
                resampling=Resampling.nearest,
            )
    canopy = np.where(cover == 10, 255, np.where(cover == 20, 28, 0)).astype(np.uint8)
    return Image.fromarray(canopy), int(np.count_nonzero(cover)), float(np.mean(cover == 10))


def main():
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
        GDAL_HTTP_CONNECTTIMEOUT="12", GDAL_HTTP_TIMEOUT="32", GDAL_HTTP_MAX_RETRY="2"
    ), ExitStack() as stack:
        sources = {}
        for name, data in manifest["regions"].items():
            if not name.endswith("-near"):
                continue
            target = OUT / f"{name}-forest.png"
            if target.exists():
                continue
            image, valid, coverage = extract(data["bounds"], sources, stack)
            if valid < image.width * image.height * .95:
                raise ValueError(f"Incomplete ESA cover at {name}: {valid}")
            image.save(target, optimize=True)
            print(name, image.size, f"{coverage:.1%} tree cover", flush=True)


if __name__ == "__main__":
    main()
