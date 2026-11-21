"""Bake the atlas's Terrarium rasters into indexed glTF terrain meshes.

Requires Python, numpy and Pillow. Run after updating the DEM or its bounds.
"""
import argparse
from pathlib import Path
import json
import struct

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "terrain"
OUTPUT = ROOT / "assets" / "models"
RADIUS = 6378.137
SUN = np.array([-.78, .49, -.39])
SUN /= np.linalg.norm(SUN)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def sample(values, u, v, triangular=False):
    rows, cols = np.array(values.shape) - 1
    x, y = np.clip(u, 0, 1) * cols, np.clip(v, 0, 1) * rows
    i, j = np.minimum(x.astype(int), cols - 1), np.minimum(y.astype(int), rows - 1)
    s, t = x - i, y - j
    a, b, c, d = values[j, i], values[j, i + 1], values[j + 1, i], values[j + 1, i + 1]
    if triangular:
        return np.where(s + t <= 1, a + s * (b - a) + t * (c - a),
                        d + (1 - s) * (c - d) + (1 - t) * (b - d))
    return (a * (1 - s) + b * s) * (1 - t) + (c * (1 - s) + d * s) * t


def sample_surface(parent, x, z):
    (left, top, right, bottom), heights = parent
    return sample(heights, (x - left) / (right - left), (z - top) / (bottom - top), True)


def terrain(name, absolute_bounds, origin, parent):
    with Image.open(SOURCE / f"{name}.png") as source:
        rgb = np.asarray(source, dtype=np.int32)
    meters = np.maximum(0, rgb[:, :, 0] * 256 + rgb[:, :, 1] - 512)
    bounds = np.array(absolute_bounds) - np.tile(origin, 2)
    left, top, right, bottom = bounds
    density = .82 if name == "route" else 1
    rows, columns = np.maximum(1, np.rint((np.array(meters.shape) - 1) * density).astype(int))
    u, v = np.meshgrid(np.linspace(0, 1, columns + 1), np.linspace(0, 1, rows + 1))
    x, z = left + (right - left) * u, top + (bottom - top) * v
    y = sample(meters, u, v) * .001 * np.cosh((z + origin[1]) / RADIUS)
    if parent:
        weight = smooth(np.minimum.reduce([u, v, 1 - u, 1 - v]) / .085)
        y = weight * y + (1 - weight) * (sample_surface(parent, x, z) + .003)
    surface = (bounds, y)
    positions = np.stack((x, y, z), axis=-1).astype("<f4").reshape(-1, 3)
    dz, dx = np.gradient(y, (bottom - top) / rows, (right - left) / columns)
    normals = np.stack((-dx, np.ones_like(y), -dz), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    uv = np.stack((u, v), axis=-1)

    cell = min((right - left) / columns, (bottom - top) / rows)
    horizontal = np.hypot(SUN[0], SUN[2])
    shadow = np.zeros_like(y)
    for step in cell * np.array([1.5, 3.5, 7, 14, 28, 53]):
        nx, nz = x + SUN[0] * step / horizontal, z + SUN[2] * step / horizontal
        valid = (nx >= left) & (nx <= right) & (nz >= top) & (nz <= bottom)
        obstacle = sample_surface(surface, nx, nz) - y - step * SUN[1] / horizontal
        shadow = np.maximum(shadow, valid * smooth(obstacle / (step * .23 + .012)))
    surround = sum(sample_surface(surface, x + dx, z + dz)
                   for dx, dz in ((3 * cell, 0), (-3 * cell, 0), (0, 3 * cell), (0, -3 * cell))) / 4
    relief = np.stack((1 - shadow, 1 - np.clip((surround - y) / (cell * 1.1 + .018), 0, .58)), axis=-1)

    a = np.arange((rows + 1) * (columns + 1)).reshape(rows + 1, columns + 1)[:-1, :-1]
    b = a + columns + 1
    triangles = np.stack((a, b, a + 1, b, b + 1, a + 1), axis=-1)
    index_type = "<u2" if len(positions) <= 65536 else "<u4"
    arrays = [
        ("POSITION", positions, 5126, "VEC3", False),
        ("NORMAL", np.rint(normals.reshape(-1, 3) * 127).astype("i1"), 5120, "VEC3", True),
        ("TEXCOORD_0", np.rint(uv.reshape(-1, 2) * 65535).astype("<u2"), 5123, "VEC2", True),
        ("_RELIEF", np.rint(relief.reshape(-1, 2) * 255).astype("u1"), 5121, "VEC2", True),
        ("indices", triangles.ravel().astype(index_type), 5123 if index_type == "<u2" else 5125, "SCALAR", False),
    ]
    return surface, arrays, int(columns), int(rows)


def write_model(name, arrays, columns, rows):
    binary = bytearray()
    views, accessors, attributes = [], [], {}
    for key, values, component, kind, normalized in arrays:
        is_index = key == "indices"
        view = {"buffer": 0, "byteOffset": len(binary), "target": 34963 if is_index else 34962}
        if not is_index and values.strides[0] % 4:
            padded = np.zeros((len(values), 4), dtype=values.dtype)
            padded[:, :values.shape[1]] = values
            payload = padded.tobytes()
            view["byteStride"] = 4
        else:
            payload = values.tobytes()
        view["byteLength"] = len(payload)
        views.append(view)
        binary.extend(payload)
        binary.extend(b"\0" * (-len(binary) % 4))
        accessor = {"bufferView": len(views) - 1, "componentType": component, "count": len(values), "type": kind}
        if normalized:
            accessor["normalized"] = True
        if key == "POSITION":
            accessor.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        if not is_index:
            attributes[key] = len(accessors)
        accessors.append(accessor)
    model = {
        "asset": {"version": "2.0", "generator": "Long March terrain baker"},
        "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name, "extras": {"columns": columns, "rows": rows}}],
        "meshes": [{"primitives": [{"attributes": attributes, "indices": len(accessors) - 1}]}],
        "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors,
    }
    header = json.dumps(model, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    output = OUTPUT / f"{name}.glb"
    with output.open("wb") as file:
        file.write(struct.pack("<4sII", b"glTF", 2, 28 + len(header) + len(binary)))
        file.write(struct.pack("<I4s", len(header), b"JSON"))
        file.write(header)
        file.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        file.write(binary)
    print(f"{name}: {(columns + 1) * (rows + 1):,} vertices · {output.stat().st_size:,} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("regions", nargs="*", help="Bake selected regions (default: every atlas region)")
    args = parser.parse_args()
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    regions = manifest["regions"]
    lat, lon = np.radians(manifest["origin"])
    origin = np.array([RADIUS * lon, -RADIUS * np.arcsinh(np.tan(lat))])
    selected = args.regions or list(regions)
    OUTPUT.mkdir(exist_ok=True)
    surfaces = {}

    def bake(name):
        if name in surfaces:
            return
        parent = name.removesuffix("-near") if name.endswith("-near") else {"route": None, "corridor": "route"}.get(name, "corridor")
        if parent:
            bake(parent)
        surface, arrays, columns, rows = terrain(name, regions[name]["bounds"], origin, surfaces.get(parent))
        surfaces[name] = surface
        if name in selected:
            write_model(name, arrays, columns, rows)

    for name in selected:
        bake(name)


if __name__ == "__main__":
    main()
