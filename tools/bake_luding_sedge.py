"""Paint the supplied tuft in object space and bake to its existing glTF UVs.

Usage: python tools/bake_luding_sedge.py original.glb intermediate.glb
The intermediate is fed to prepare_tripo_prop.py for decimation and export.
"""
import io
import json
import struct
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def blade_strips(destination):
    y, x = np.mgrid[0:512, 0:512]
    lane, cross = x // 64, (x % 64) / 63
    h = 1 - y / 511
    rng = np.random.default_rng(1935)
    palette = np.array([(115, 123, 58), (137, 139, 66), (91, 108, 44),
                        (103, 112, 48), (114, 125, 52), (160, 143, 79),
                        (171, 144, 90), (140, 125, 67)])
    root = np.array([84, 70, 39])
    tip = palette[lane] + np.array([25, 20, 16])
    base = root + (palette[lane] - root) * smooth(.0, .39, h)[:, :, None]
    base += (tip - palette[lane]) * smooth(.45, 1., h)[:, :, None]
    midrib = np.exp(-((cross - .51 - .015 * np.sin(h * 8)) / .035) ** 2)
    stripes = 4 * np.sin(cross * 146 + h * 2) + 3 * np.sin(cross * 44)
    edge = smooth(.41, .50, np.abs(cross - .5))
    intensity = 13 * midrib + 12 * edge + stripes + rng.normal(0, 1.4, h.shape)
    Image.fromarray(np.clip(base + intensity[:, :, None], 0, 255).astype('uint8')).save(destination)


def gravel_verge(destination):
    """Bake a broken strip of alluvium, feathered into the existing ground."""
    shingle = np.array(Image.open(destination.parents[2] / 'valley/bank-shingle.webp').convert('RGB'))
    # Mirror at the edges of the source tile. Periodic masks keep the
    # sediment seamless when the renderer repeats it in physical metres.
    base = np.concatenate((shingle, shingle[:, ::-1]), axis=1)
    base = np.concatenate((base, base[::-1]), axis=0)
    h, w = base.shape[:2]
    y, x = np.mgrid[:h, :w].astype('float32')
    phase_x, phase_y = x * (2 * np.pi / w), y * (2 * np.pi / h)
    silt = .5 + .25 * np.sin(2 * phase_x + np.cos(phase_y)) + .25 * np.cos(phase_x - 3 * phase_y)
    gravel = cv2.remap(base, 2*x + 27*np.sin(phase_y), 2*y + 19*np.cos(phase_x),
                       cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    mix = smooth(.26, .75, silt)[:, :, None]
    stone = gravel * mix + base * (1 - mix)
    dirt = np.array([108, 99, 77])
    rgb = stone * (.65 - .24*mix) + dirt * (.35 + .24*mix)
    Image.fromarray(np.uint8(rgb)).save(destination, quality=88, method=5)



def paint(source, target):
    raw = source.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20 + size])
    buffer = bytearray(raw[28 + size:])
    primitive = data['meshes'][0]['primitives'][0]

    def read(index):
        accessor = data['accessors'][index]
        view = data['bufferViews'][accessor['bufferView']]
        dtype = {5123: '<u2', 5125: '<u4', 5126: '<f4'}[accessor['componentType']]
        columns = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        step = np.dtype(dtype).itemsize
        return np.ndarray((accessor['count'], columns), dtype, buffer,
                          offset=view.get('byteOffset', 0) + accessor.get('byteOffset', 0),
                          strides=(view.get('byteStride', columns * step), step)).copy()

    positions = read(primitive['attributes']['POSITION'])
    positions /= np.ptp(positions[:, 1])
    side = 1024
    uv = read(primitive['attributes']['TEXCOORD_0']) * side - .5
    triangles = read(primitive['indices']).reshape(-1, 3)
    raster = np.zeros((side, side, 3), np.float32)
    covered = np.zeros((side, side), bool)
    for indices in triangles:
        a, b, c = uv[indices]
        u, v = b - a, c - a
        det = u[0] * v[1] - u[1] * v[0]
        if abs(det) < .0001:
            continue
        left, top = np.maximum(0, np.ceil(uv[indices].min(axis=0)).astype(int))
        right, bottom = np.minimum(side - 1, np.floor(uv[indices].max(axis=0)).astype(int))
        if left > right or top > bottom:
            continue
        yy, xx = np.mgrid[top:bottom + 1, left:right + 1]
        s = ((xx - a[0]) * v[1] - (yy - a[1]) * v[0]) / det
        t = (u[0] * (yy - a[1]) - u[1] * (xx - a[0])) / det
        keep = (s >= 0) & (t >= 0) & (s + t <= 1)
        y, x = yy[keep], xx[keep]
        p, q, r = positions[indices]
        raster[y, x] = p + s[keep, None] * (q - p) + t[keep, None] * (r - p)
        covered[y, x] = True

    # Extend position samples past each UV island for clean mipmap filtering.
    _, nearest = cv2.distanceTransformWithLabels((~covered).astype('uint8'),
                    cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    x, height, z = np.moveaxis(raster[covered][nearest - 1], 2, 0)
    angle = np.arctan2(z, x)
    radius = np.hypot(x, z)
    arch = angle + .15 * height + .035 * np.sin(height * 9 + angle * 3)
    vein = np.sin(arch * 86 + 3 * np.sin(arch * 18))
    variety = .5 + .5 * np.sin(arch * 11 + np.sin(arch * 6))
    dry = np.maximum((1 - smooth(.09, .42, height)) * smooth(.07, .32, radius),
                     .75 * smooth(.79, 1, variety))
    dry = np.maximum(dry, .56 * smooth(.67, 1.05, height) * variety)
    fresh = np.stack((67 + 50 * height, 78 + 57 * height, 36 + 17 * height), axis=2)
    straw = np.stack((135 + 47 * height, 103 + 44 * height, 62 + 38 * height), axis=2)
    fibres = vein * 4 + np.sin(arch * 220 + height * 3) * 2
    color = fresh + (straw - fresh) * dry[:, :, None] + (fibres + variety * 9)[:, :, None]
    # Derive small tangent-space perturbations from the same longitudinal fibres.
    dy, dx = np.gradient(.8 * vein)
    normal = np.stack((-np.clip(dx, -.18, .18), np.clip(dy, -.18, .18), np.ones_like(dx)), axis=2)
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rough = np.clip(.69 + .19 * dry - .045 * vein, 0, 1)
    maps = [('sedge-albedo', color), ('sedge-leaf-normal', (normal * .5 + .5) * 255),
            ('sedge-roughness', np.stack((np.ones_like(rough), rough, np.zeros_like(rough)), axis=2) * 255)]
    data['images'], data['textures'] = [], []
    for name, pixels in maps:
        stream = io.BytesIO()
        Image.fromarray(np.clip(pixels, 0, 255).astype('uint8')).save(stream, format='PNG')
        encoded = stream.getvalue()
        buffer.extend(bytes(-len(buffer) % 4))
        view_index = len(data['bufferViews'])
        data['bufferViews'].append({'buffer': 0, 'byteOffset': len(buffer), 'byteLength': len(encoded)})
        buffer.extend(encoded)
        data['textures'].append({'source': len(data['images'])})
        data['images'].append({'name': name, 'bufferView': view_index, 'mimeType': 'image/png'})
    data['materials'] = [{'name': 'Hand-painted Dadu bank sedge', 'doubleSided': True,
        'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2}},
        'normalTexture': {'index': 1}, 'extras': {'ludingFinish': True}}]
    primitive['material'] = 0
    buffer.extend(bytes(-len(buffer) % 4))
    data['buffers'][0]['byteLength'] = len(buffer)
    meta = json.dumps(data, separators=(',', ':')).encode()
    meta += b' ' * (-len(meta) % 4)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(struct.pack('<4sIIII', b'glTF', 2, 28 + len(meta) + len(buffer), len(meta), 0x4e4f534a)
                       + meta + struct.pack('<I4s', len(buffer), b'BIN\0') + buffer)


if __name__ == '__main__':
    source_path, output_path = map(Path, sys.argv[1:])
    if source_path.resolve() == output_path.resolve():
        raise ValueError('The source and intermediate must have different paths')
    paint(source_path, output_path)
    blade_strips(Path(__file__).resolve().parents[1] / 'assets/luding/surfaces/sedge-blades.png')
    gravel_verge(Path(__file__).resolve().parents[1] / 'assets/luding/surfaces/sedge-shingle.webp')
