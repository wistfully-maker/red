"""Add small Overture building-footprint extracts to the station close views.

Requires pmtiles, mapbox-vector-tile and shapely. Only tile byte ranges are read.
"""
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import gzip
import json
import math
import os
import subprocess

from mapbox_vector_tile import decode
from pmtiles.reader import Reader
from shapely import affinity
from shapely.geometry import Polygon, box, shape
from shapely.strtree import STRtree

from build_terrain import OUT, WORLD
from build_vectors import pieces, rings

RELEASE = "2026-10-21.0"
URL = f"https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/{RELEASE}/buildings.pmtiles"
ZOOM = 14
STEP = WORLD / 2 ** ZOOM
RADIUS = 2600
LIMIT = box(-RADIUS, -RADIUS, RADIUS, RADIUS)


@lru_cache(maxsize=128)
def read_range(start, length):
    flags = ["--ssl-revoke-best-effort"] if os.name == "nt" else []
    data = subprocess.run(
        ["curl", "-fLsS", *flags, "--retry", "2", "--max-time", "24",
         "-r", f"{start}-{start + length - 1}", URL],
        check=True, capture_output=True,
    ).stdout
    if len(data) != length:
        raise ValueError(f"Expected {length} tile bytes, got {len(data)}")
    return data


def read_tile(reader, x, y):
    tile = reader.get(ZOOM, x, y)
    if not tile:
        return None
    if tile.startswith(b"\x1f\x8b"):
        tile = gzip.decompress(tile)
    return decode(tile, default_options={"y_coord_down": True}).get("building")


def height_for(properties, area):
    height = properties.get("height")
    if not height:
        floors = properties.get("num_floors")
        height = float(floors) * 3.05 if floors else min(9.5, 3.35 + math.sqrt(area) * .16)
    return round(min(72, max(2.8, float(height))), 1)


def extract(origin, previous, reader, pool):
    ox, oz = origin
    coords = [
        (x, y)
        for y in range(math.floor((oz + WORLD / 2 - RADIUS / 1000) / STEP),
                       math.floor((oz + WORLD / 2 + RADIUS / 1000) / STEP) + 1)
        for x in range(math.floor((ox + WORLD / 2 - RADIUS / 1000) / STEP),
                       math.floor((ox + WORLD / 2 + RADIUS / 1000) / STEP) + 1)
    ]
    existing = [Polygon(parts[0], parts[1:]).buffer(0) for _, parts in previous if len(parts[0]) > 2]
    existing = [feature for feature in existing if not feature.is_empty]
    index = STRtree(existing)
    jobs = [pool.submit(read_tile, reader, x, y) for x, y in coords]
    additions = []
    for (x, y), job in zip(coords, jobs):
        layer = job.result()
        if not layer:
            continue
        dx = (x * STEP - WORLD / 2 - ox) * 1000
        dz = (y * STEP - WORLD / 2 - oz) * 1000
        area = LIMIT.intersection(box(dx, dz, dx + STEP * 1000, dz + STEP * 1000))
        scale = STEP * 1000 / layer["extent"]
        for feature in layer["features"]:
            properties = feature["properties"]
            if properties.get("is_underground"):
                continue
            footprint = affinity.affine_transform(shape(feature["geometry"]), [scale, 0, 0, scale, dx, dz])
            if not footprint.is_valid:
                footprint = footprint.buffer(0)
            for polygon in pieces(footprint.intersection(area).simplify(.75)):
                if polygon.geom_type != "Polygon" or polygon.area < 18:
                    continue
                duplicate = any(
                    polygon.intersection(existing[i]).area > min(polygon.area, existing[i].area) * .38
                    for i in index.query(polygon, predicate="intersects")
                )
                if duplicate:
                    continue
                center = polygon.centroid
                priority = math.hypot(center.x, center.y) / max(1.0, math.log(polygon.area))
                additions.append((priority, [height_for(properties, polygon.area), rings(polygon)]))
    additions.sort(key=lambda item: item[0])
    return [record for _, record in additions[:2600]]


def main():
    reader = Reader(read_range)
    reader.header()
    paths = sorted(OUT.glob("*-vectors.json"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for path in paths:
            source = json.loads(path.read_text(encoding="utf-8"))
            result = extract(source["origin"], source["buildings"], reader, pool)
            target = OUT / path.name.replace("-vectors.json", "-buildings.json")
            target.write_text(json.dumps({"source": RELEASE, "buildings": result}, separators=(",", ":")), encoding="utf-8")
            print(path.name, len(result), flush=True)


if __name__ == "__main__":
    main()
