"""Extract small, attributed OpenFreeMap vector neighborhoods for the close terrain scenes.

Requires mapbox-vector-tile and shapely. Requests use a dedicated user agent and
four workers, and are limited to the atlas's station neighborhoods.
"""
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
import math
from pathlib import Path
import subprocess
import tempfile

import mapbox_vector_tile
from shapely import affinity
from shapely.geometry import box, shape

from build_terrain import OUT, WORLD, mercator

INDEX = "https://tiles.openfreemap.org/planet"
AGENT = "Shanhezhilu-HistoricalAtlas/1.0"
ZOOM = 14
STEP = WORLD / 2**ZOOM
RADIUS = 2600
LIMIT = box(-RADIUS, -RADIUS, RADIUS, RADIUS)
LAYERS = {"building", "transportation", "water", "waterway"}


def request(url):
    return subprocess.run(
        ["curl", "-fLsS", "--ssl-revoke-best-effort", "--retry", "2", "--max-time", "25", "-A", AGENT, url],
        check=True, capture_output=True
    ).stdout


def tile(template, x, y, cache):
    path = cache / f"{x}-{y}.pbf"
    if not path.exists():
        path.write_bytes(request(template.format(z=ZOOM, x=x, y=y)))
    data = path.read_bytes()
    if data.startswith(b"\x1f\x8b"):
        data = gzip.decompress(data)
    return mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})


def coord(pair):
    return [round(pair[0]), round(pair[1])]


def pieces(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type.startswith("Multi") or geometry.geom_type == "GeometryCollection":
        for child in geometry.geoms:
            yield from pieces(child)
    else:
        yield geometry


def rings(polygon):
    return [[coord(p) for p in list(ring.coords)[:-1]] for ring in [polygon.exterior, *polygon.interiors]]


def extract(template, lat, lon, cache, pool):
    ox, oz = mercator(lat, lon)
    x0, x1 = [math.floor((ox + WORLD / 2 + shift) / STEP) for shift in (-RADIUS/1000, RADIUS/1000)]
    y0, y1 = [math.floor((oz + WORLD / 2 + shift) / STEP) for shift in (-RADIUS/1000, RADIUS/1000)]
    coords = [(x, y) for y in range(y0, y1+1) for x in range(x0, x1+1)]
    jobs = [pool.submit(tile, template, x, y, cache) for x, y in coords]
    buildings = []
    roads = []
    water = []
    streams = []
    for (x, y), job in zip(coords, jobs):
        dx = (x * STEP - WORLD / 2 - ox) * 1000
        dz = (y * STEP - WORLD / 2 - oz) * 1000
        visible = LIMIT.intersection(box(dx, dz, dx + STEP * 1000, dz + STEP * 1000))
        for name, layer in job.result().items():
            if name not in LAYERS:
                continue
            scale = STEP * 1000 / layer["extent"]
            for feature in layer["features"]:
                properties = feature["properties"]
                kind = properties.get("class", "")
                if name == "transportation" and kind in {"rail", "transit", "ferry", "aerialway", "pier"}:
                    continue
                geo = affinity.affine_transform(shape(feature["geometry"]), [scale, 0, 0, scale, dx, dz])
                if not geo.is_valid:
                    geo = geo.buffer(0)
                cropped = geo.intersection(visible).simplify(1.1 if name == "building" else 2.1)
                for part in pieces(cropped):
                    if name == "building" and part.geom_type == "Polygon" and part.area > 22:
                        height = min(55, max(3, float(properties.get("render_height") or 5.5)))
                        buildings.append((part.area, [round(height, 1), rings(part)]))
                    elif name == "water" and part.geom_type == "Polygon" and part.area > 160:
                        water.append(rings(part))
                    elif part.geom_type == "LineString" and part.length > 15:
                        line = [coord(point) for point in part.coords]
                        if name == "transportation":
                            roads.append([kind, line])
                        elif name == "waterway" and kind in {"river", "canal", "stream"}:
                            streams.append([kind, line])
    buildings.sort(key=lambda entry: entry[0], reverse=True)
    return {
        "origin": [round(ox, 6), round(oz, 6)],
        "buildings": [item for _, item in buildings[:1800]],
        "roads": roads,
        "water": water,
        "streams": streams,
    }


def main():
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    points = manifest["stations"] | {"huahu": [33.902, 102.819]}
    index = json.loads(request(INDEX))
    template = index["tiles"][0]
    revision = template.split("/")[-4]
    cache = Path(tempfile.gettempdir()) / "longmarch-openfreemap" / revision
    cache.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, (lat, lon) in points.items():
            output = OUT / f"{name}-vectors.json"
            if output.exists():
                continue
            data = extract(template, lat, lon, cache, pool)
            data["source"] = revision
            output.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            print(name, {key: len(data[key]) for key in ("buildings", "roads", "water", "streams")}, flush=True)


if __name__ == "__main__":
    main()
