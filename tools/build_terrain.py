"""Build the atlas's georeferenced DEM and Sentinel-2 textures.

Requires Python, numpy, Pillow and curl. Tile caches live outside the site.
The browser uses the generated images and does not contact a tile service.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.parse import urlencode

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "terrain"
WORLD = 40075.016686
DEG = math.pi / 180
DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
RGB = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg"
EOX_WMS = "https://tiles.maps.eox.at/map"
OVERVIEW_SLICE_LIMIT = 1600
OVERVIEW_MOBILE_WIDTH = 4096
FEATURES = {
    "chishui": (32, 34, 13),
    "jiaoping": (28, 28, 13),
    "luding": (34, 36, 13),
    "jiajin": (39, 38, 13),
    "songpan": (50, 51, 12),
}


def mainland_offset(lat, lon):
    """Approximate inverse for the legacy GCJ-02 POI coordinates."""
    x, y = lon - 105, lat - 35
    common = (20 * math.sin(6 * x * math.pi) + 20 * math.sin(2 * x * math.pi)) * 2 / 3
    dy = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*math.sqrt(abs(x)) + common
    dx = 300 + x + 2*y + .1*x*x + .1*x*y + .1*math.sqrt(abs(x)) + common
    dy += (20*math.sin(y*math.pi) + 40*math.sin(y*math.pi/3)) * 2/3
    dy += (160*math.sin(y*math.pi/12) + 320*math.sin(y*math.pi/30)) * 2/3
    dx += (20*math.sin(x*math.pi) + 40*math.sin(x*math.pi/3)) * 2/3
    dx += (150*math.sin(x*math.pi/12) + 300*math.sin(x*math.pi/30)) * 2/3
    a, ee = 6378245, .006693421622965943
    m = 1 - ee * math.sin(lat * DEG)**2
    return (
        dy / (a * (1-ee) / (m**1.5) * DEG),
        dx / (a / math.sqrt(m) * math.cos(lat*DEG) * DEG)
    )


def wgs84(lat, lon):
    shifted_lat, shifted_lon = lat, lon
    for _ in range(4):
        dy, dx = mainland_offset(shifted_lat, shifted_lon)
        shifted_lat, shifted_lon = lat - dy, lon - dx
    return shifted_lat, shifted_lon


def mercator(lat, lon):
    return lon / 360 * WORLD, -math.asinh(math.tan(lat * DEG)) / (2 * math.pi) * WORLD


def box(lat, lon, width, length):
    x, z = mercator(lat, lon)
    return x - width/2, z - length/2, x + width/2, z + length/2


def places():
    source = (ROOT / "assets" / "stations.js").read_text(encoding="utf-8-sig")
    matches = re.findall(r"id: '([a-z]+)'[^\n]+coords: \[([\d.]+), ([\d.]+)\]", source)
    if len(matches) != 19:
        raise ValueError(f"Expected 19 station coordinates, found {len(matches)}")
    points = {name: wgs84(float(lat), float(lon)) for name, lat, lon in matches}
    points["luding"] = (29.9145, 102.230167)
    return points


def tile(kind, z, x, y, cache):
    path = cache / ("photo-2024" if kind == "photo" else kind) / str(z) / str(x) / str(y)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return path.read_bytes()
    url = (DEM if kind == "height" else RGB).format(z=z, x=x, y=y)
    flags = ["--ssl-revoke-best-effort"] if os.name == "nt" else []
    for retry in range(3):
        result = subprocess.run(
            ["curl", "-fLsS", *flags, "--max-time", "14", url],
            check=False, capture_output=True
        )
        if result.returncode == 0:
            Image.open(BytesIO(result.stdout)).verify()
            path.write_bytes(result.stdout)
            return result.stdout
        time.sleep(retry + 1)
    raise RuntimeError(f"Failed to read tile {url}: {result.stderr.decode(errors='replace')}")


def build(bounds, zoom, kind, size, cache, pool):
    world_pixels = 256 * 2**zoom
    left, top, right, bottom = [(coordinate / WORLD + .5)*world_pixels for coordinate in bounds]
    x0, y0 = math.floor(left/256), math.floor(top/256)
    x1, y1 = math.floor(right/256), math.floor(bottom/256)
    coords = [(x, y) for y in range(y0, y1+1) for x in range(x0, x1+1)]
    jobs = [pool.submit(tile, kind, zoom, x, y, cache) for x, y in coords]
    mosaic = Image.new("RGB", ((x1-x0+1)*256, (y1-y0+1)*256))
    for (x, y), job in zip(coords, jobs):
        with Image.open(BytesIO(job.result())) as tile_image:
            mosaic.paste(tile_image, ((x-x0)*256, (y-y0)*256))
    crop = (left-x0*256, top-y0*256, right-x0*256, bottom-y0*256)
    if kind == "photo":
        return mosaic.resize(size, Image.Resampling.LANCZOS, box=crop)
    rgb = np.array(mosaic, dtype=np.float32)
    meters = rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768
    return np.array(Image.fromarray(meters).resize(size, Image.Resampling.BILINEAR, box=crop))


def fetch_overview_slice(bounds, size, cache):
    west, north, east, south = bounds
    parameters = {
        "service": "WMS", "version": "1.1.1", "request": "GetMap",
        "layers": "s2cloudless-2024_3857", "styles": "", "srs": "EPSG:3857",
        "bbox": ",".join(f"{coordinate * 1000:.3f}" for coordinate in (west, -south, east, -north)),
        "width": size[0], "height": size[1], "format": "image/jpeg",
    }
    path = cache / ("overview-" + parameters["bbox"] + f"-{size[0]}x{size[1]}.jpg")
    if path.exists():
        try:
            with Image.open(path) as image:
                if image.size == size:
                    return image.convert("RGB")
        except OSError:
            pass
    flags = ["--ssl-revoke-best-effort"] if os.name == "nt" else []
    with tempfile.NamedTemporaryFile(dir=cache, suffix=".jpg", delete=False) as output:
        download = Path(output.name)
    try:
        # Curl can discard a partial file on retry when it manages the output.
        result = subprocess.run(
            ["curl", "-fLsS", *flags, "--retry", "2", "--max-time", "180", "-o", str(download),
             EOX_WMS + "?" + urlencode(parameters)],
            check=False, capture_output=True
        )
        if result.returncode:
            raise RuntimeError(f"Failed to read overview slice {path.name}: {result.stderr.decode(errors='replace')}")
        with Image.open(download) as image:
            if image.size != size:
                raise ValueError(f"WMS returned {image.size} for a {size} slice")
            slice_image = image.convert("RGB")
        download.replace(path)
        return slice_image
    finally:
        download.unlink(missing_ok=True)


def build_overview(bounds, size, cache):
    west, north, east, south = bounds
    width, height = size
    columns = math.ceil(width / OVERVIEW_SLICE_LIMIT)
    rows = math.ceil(height / OVERVIEW_SLICE_LIMIT)
    cache.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGB", size)
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = []
        for row in range(rows):
            for col in range(columns):
                x0, x1 = width * col // columns, width * (col + 1) // columns
                y0, y1 = height * row // rows, height * (row + 1) // rows
                area = (
                    west + (east - west) * x0 / width, north + (south - north) * y0 / height,
                    west + (east - west) * x1 / width, north + (south - north) * y1 / height,
                )
                jobs.append((x0, y0, pool.submit(fetch_overview_slice, area, (x1 - x0, y1 - y0), cache)))
        for x, y, job in jobs:
            canvas.paste(job.result(), (x, y))
    return canvas


def build_region(name, bounds, zoom, grid, texture, cache, pool, refresh_imagery, refresh_heights):
    width, height = bounds[2]-bounds[0], bounds[3]-bounds[1]
    aspect = height / width
    photo_size = (texture, round(texture*aspect))
    dem_size = (grid, round(grid*aspect))
    height_file = OUT / f"{name}.png"
    photo_file = OUT / f"{name}.webp"
    rebuild_photo = refresh_imagery or not photo_file.exists()
    if height_file.exists() and not refresh_heights:
        with Image.open(height_file) as stored:
            rgb = np.asarray(stored).astype(np.int32)
            meters = rgb[:, :, 0]*256 + rgb[:, :, 1] - 512
    else:
        meters = build(bounds, zoom, "height", dem_size, cache, pool)
        meters = np.maximum(meters, 0)
        encoded = np.rint(meters + 512).clip(0, 65535).astype(np.uint16)
        pixels = np.stack((encoded >> 8, encoded & 255, np.zeros_like(encoded)), axis=2)
        Image.fromarray(pixels.astype(np.uint8)).save(height_file, optimize=True)
    if rebuild_photo:
        photo_zoom = zoom + 1 if name.endswith("-near") else zoom
        image = build_overview(bounds, photo_size, cache) if name == "corridor" else build(bounds, photo_zoom, "photo", photo_size, cache, pool)
        image.save(photo_file, quality=88 if texture >= 900 else 85, method=5)
    meters = np.maximum(meters, 0)
    print(f"{name:<12} {meters.shape[1]}x{meters.shape[0]} · {meters.min():.0f}–{meters.max():.0f} m", flush=True)
    result = {
        "bounds": [round(value, 5) for value in bounds],
        "range": [round(float(meters.min())), round(float(meters.max()))],
        "zoom": zoom,
    }
    if name == "corridor":
        mobile_file = OUT / "corridor-mobile.webp"
        if rebuild_photo or not mobile_file.exists():
            mobile_size = (OVERVIEW_MOBILE_WIDTH, round(OVERVIEW_MOBILE_WIDTH * aspect))
            with Image.open(photo_file) as desktop_image:
                desktop_image.resize(mobile_size, Image.Resampling.LANCZOS).save(mobile_file, quality=84, method=5)
        result["mobileTexture"] = mobile_file.name
        result["photoZoom"] = 9
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "longmarch-terrain")
    parser.add_argument("--only", nargs="+", help="Build named regions before generating the full manifest")
    parser.add_argument("--refresh-imagery", action="store_true")
    parser.add_argument("--refresh-heights", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    points = places()
    northwest = mercator(58, 71)
    southeast = mercator(-1, 148)
    atlas_northwest = mercator(39.1, 99.1)
    atlas_southeast = mercator(23.2, 118.1)
    areas = {
        "luding": (box(*points["luding"], *FEATURES["luding"][:2]), 13, 313, 1440),
        "luding-near": (box(*points["luding"], 12, 13), 13, 321, 1240),
        "route": ((*northwest, *southeast), 6, 397, 1880),
        "corridor": ((*atlas_northwest, *atlas_southeast), 8, 1000, 6144),
        "huahu": (box(33.932, 102.832, 34, 32), 13, 302, 1340),
    }
    for name, coords in points.items():
        width, length, zoom = FEATURES.get(name, (37, 38, 12))
        grid, texture = (313, 1440) if zoom == 13 else (244, 1450) if name == "songpan" else (210, 1100)
        areas.setdefault(name, (box(*coords, width, length), zoom, grid, texture))
        areas.setdefault(f"{name}-near", (box(*coords, 10, 10.5), 13, 323, 1160))
    areas["huahu-near"] = (box(33.902, 102.819, 10, 10.5), 13, 323, 1160)
    result = {}
    with ThreadPoolExecutor(max_workers=9) as pool:
        for name, specs in areas.items():
            if not args.only or name in args.only:
                result[name] = build_region(name, *specs, args.cache, pool, args.refresh_imagery, args.refresh_heights)
    manifest = {
        "origin": [31, 108],
        "regions": result,
        "stations": {name: [round(p, 7) for p in coords] for name, coords in points.items()},
        "sources": {
            "dem": "Mapzen Terrain Tiles, SRTM / USGS",
            "image": "EOxCloudless by EOX IT Services GmbH, modified Copernicus Sentinel data 2024, CC BY-NC-SA 4.0",
        },
    }
    file = OUT / "manifest.json"
    if args.only and file.exists():
        manifest["regions"] = json.loads(file.read_text(encoding="utf-8"))["regions"] | result
    for name, region in manifest["regions"].items():
        if not name.endswith("-near"):
            continue
        region["forest"] = (OUT / f"{name}-forest.png").is_file()
        footprints = OUT / f"{name[:-5]}-buildings.json"
        region["buildings"] = footprints.is_file() and bool(json.loads(footprints.read_text(encoding="utf-8"))["buildings"])
    file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
