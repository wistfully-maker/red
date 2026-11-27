"""Dress the Luding banks with the contributed tuft and tapered outer leaves."""
import json
import math
import random
import struct
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def promote_shore_alpha(path):
    """Blender 5.2 may emit an opaque white COLOR_0 before the fade layer."""
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    binary_chunk = raw[20+length:]
    changed = False
    for mesh in doc['meshes']:
        for part in mesh['primitives']:
            if doc['materials'][part['material']]['name'] != 'Dadu alluvial verge':
                continue
            attr = part['attributes']
            if 'COLOR_1' not in attr:
                continue
            primary = doc['accessors'][attr['COLOR_0']]
            view = doc['bufferViews'][primary['bufferView']]
            if primary['type'] != 'VEC4' or primary['componentType'] != 5121 or view.get('extensions'):
                continue
            start = 8 + view.get('byteOffset', 0) + primary.get('byteOffset', 0)
            step = view.get('byteStride', 4)
            if all(binary_chunk[start+i*step:start+i*step+4] == b'\xff'*4 for i in range(primary['count'])):
                attr['COLOR_0'] = attr.pop('COLOR_1')
                changed = True
    if changed:
        metadata = json.dumps(doc, separators=(',', ':')).encode()
        metadata += b' ' * (-len(metadata) % 4)
        header = struct.pack('<4sIIII', b'glTF', 2, 20+len(metadata)+len(binary_chunk), len(metadata), 0x4e4f534a)
        tmp = path.with_suffix('.alpha.tmp')
        tmp.write_bytes(header + metadata + binary_chunk)
        tmp.replace(path)


def dress_shore(ground):
    # Follow the actual terrain triangles so the gravel meets the grass roots
    # and the bank's waterline throughout a camera move.
    mat = bpy.data.materials.new('Dadu alluvial verge')
    mat.use_nodes = True
    mat.surface_render_method = 'DITHERED'
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(ROOT / 'assets/luding/surfaces/sedge-shingle.webp'), check_existing=True)
    tex.extension = 'REPEAT'
    shader = mat.node_tree.nodes.get('Principled BSDF')
    dye = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    dye.layer_name = 'Shore fade'
    # glTF pairs RGB and alpha in COLOR_0. Link both channels from the same
    # layer so the exporter does not synthesize an opaque primary color set.
    pigment = mat.node_tree.nodes.new('ShaderNodeMixRGB')
    pigment.blend_type = 'MULTIPLY'
    pigment.inputs[0].default_value = 1
    mat.node_tree.links.new(tex.outputs['Color'], pigment.inputs[1])
    mat.node_tree.links.new(dye.outputs['Color'], pigment.inputs[2])
    mat.node_tree.links.new(pigment.outputs[0], shader.inputs['Base Color'])
    mat.node_tree.links.new(dye.outputs['Alpha'], shader.inputs['Alpha'])
    shader.inputs['Roughness'].default_value = .87
    coords = [v.co.copy() for v in ground.data.vertices]
    mapping, vertices, faces = {}, [], []
    for poly in ground.data.polygons:
        p = coords[poly.vertices[0]]
        if not (31 < abs(p.x) < 67 and -43 < p.y < 36):
            continue
        face = []
        for index in poly.vertices:
            if index not in mapping:
                pos = coords[index]
                mapping[index] = len(vertices)
                vertices.append((pos.x, pos.y, pos.z + .018))
            face.append(mapping[index])
        faces.append(face)
    mesh = bpy.data.meshes.new('Alluvium on the two landings')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name='Gravel metres')
    fade = mesh.color_attributes.new(name='Shore fade', type='BYTE_COLOR', domain='POINT')
    def ramp(t):
        t = max(0., min(1., t))
        return t * t * (3. - 2. * t)
    for i, (x, y, _) in enumerate(vertices):
        bank = abs(x) + 1.8 * math.sin(y*.32) + 1.2 * math.cos(y*.51+x*.62)
        opacity = ramp((bank-34)/5) * ramp((64-bank)/6)
        opacity *= ramp((y+40)/7) * ramp((33-y)/8)
        fade.data[i].color = (1, 1, 1, opacity)
    for loop in mesh.loops:
        x, y, z = vertices[loop.vertex_index]
        uv.data[loop.index].uv = ((abs(x) + .46*z + .12*y) / 2.6, (y-.15*x) / 2.6)


def add_outer_leaves():
    # The supplied core has angular, broad blades. Finer folded leaves soften its
    # outline. Each blade samples one longitudinal strip of the painted atlas.
    rng = random.Random(381)
    verts, faces, uvs = [], [], []
    for i in range(105):
        angle = rng.uniform(0, math.tau)
        ca, sa = math.cos(angle), math.sin(angle)
        base = rng.uniform(.06, .16)
        reach = rng.uniform(.18, .46)
        height = rng.uniform(.27, .89)
        droop = rng.uniform(.24, .85)
        width = rng.uniform(.008, .019)
        bend = rng.uniform(-.15, .15)
        lane = rng.randrange(8)
        start = len(verts)
        for step in range(8):
            t = step / 7
            r = base + reach * t ** 1.45
            z = height * (1.7 * t - droop * t ** 2.7)
            half = width * (.54 + .58 * math.sin(t * math.pi)) * (1 - t ** 3) + .0005
            sweep = bend * t * t
            for j, lateral in enumerate((-1, 0, 1)):
                y = sweep + lateral * half
                verts.append((ca * r - sa * y, sa * r + ca * y, z + (.24 * half if j == 1 else 0)))
                uvs.append(((lane + .08 + j * .42) / 8, .01 + .98 * t))
            if step:
                k = start + step * 3
                faces.extend(((k-3, k-2, k+1, k), (k-2, k-1, k+2, k+1)))
    data = bpy.data.meshes.new('Curved sedge leaf margins')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new('Sedge outer leaves', data)
    bpy.context.collection.objects.link(obj)
    uv = data.uv_layers.new(name='Leaf strips')
    for loop in data.loops:
        uv.data[loop.index].uv = uvs[loop.vertex_index]
    material = bpy.data.materials.new('Sedge olive blades and dry sheaths')
    material.use_nodes = True
    material.use_backface_culling = False
    material['ludingFinish'] = True
    surface = material.node_tree.nodes.get('Principled BSDF')
    tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(ROOT / 'assets/luding/surfaces/sedge-blades.png'), check_existing=True)
    material.node_tree.links.new(tex.outputs['Color'], surface.inputs['Base Color'])
    surface.inputs['Roughness'].default_value = .81
    data.materials.append(material)
    return obj


def place_sedge(env, ground):
    dress_shore(ground)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/luding/props/kf-sedge.glb'))
    core, = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    leaves = add_outer_leaves()
    rng = random.Random(1935)
    sites = [(50,-6,.89), (51,-8,.8), (49,-4,.62), (52,-10,.55),
             (49,4.8,.65), (51,-13,.63), (50,-15,.42), (47,16,.66),
             (-51,5,.68), (-55,-8,.72), (-48,-12,.47), (-53,15,.62),
             (55,12,.58), (-52,24,.65), (-58,-18,.62)]
    for i, (x, y, size) in enumerate(sites):
        # Raycast the exported terrain; the mesh interpolates the sampled heights.
        hit, point, _, _ = ground.ray_cast(Vector((x, y, 500)), Vector((0, 0, -1)))
        height = point.z if hit else env.height(x, y)
        turn = rng.uniform(0, math.tau)
        for master in (core, leaves):
            obj = master if i == 0 else master.copy()
            if i:
                bpy.context.collection.objects.link(obj)
            obj.location = (x, y, height - size * .034)
            obj.rotation_euler = (0, 0, turn)
            obj.scale = (size,) * 3
            obj['contributedProp'] = 'kf-sedge'
