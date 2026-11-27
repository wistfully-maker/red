"""End-to-end Blender check; writes only to ignored .workbuddy/tripo-prop-check.

blender --background --python-exit-code 17 --python tools/check_tripo_prop.py
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools/prepare_tripo_prop.py'
assert SCRIPT.is_file(), 'Missing textured multi-mesh prop preparation script'
spec = importlib.util.spec_from_file_location('prepare_tripo_prop', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def glb_document(path):
    data = path.read_bytes()
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    return json.loads(data[20:20 + size])


def check():
    folder = ROOT / '.workbuddy/tripo-prop-check'
    folder.mkdir(exist_ok=True, parents=True)
    source, output = folder / 'fixture-source.glb', folder / 'fixture-ready.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.object.empty_add(location=(4.0, -2.0, 6.0))
    parent = bpy.context.object
    parent.rotation_euler.z = math.radians(23)
    parent.scale = (1.4, .8, 1.3)
    for index in range(2):
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
        obj = bpy.context.object
        obj.name = 'Fixture part ' + str(index)
        obj.parent = parent
        obj.location = (index * 1.7, index * .7, index * .8)
        obj.scale = (1, .6, .8)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.subdivide(number_cuts=5)
        bpy.ops.object.mode_set(mode='OBJECT')
        mat = bpy.data.materials.new('Fixture PBR ' + str(index))
        mat.use_nodes = True
        obj.data.materials.append(mat)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        principled = nodes.get('Principled BSDF')
        image = bpy.data.images.new('Fixture colour ' + str(index), width=128, height=64)
        image.generated_color = (.25 + .2 * index, .16, .07, 1)
        image.pack()
        color = nodes.new('ShaderNodeTexImage')
        color.image = image
        links.new(color.outputs['Color'], principled.inputs['Base Color'])
        normal_image = bpy.data.images.new('Fixture normal ' + str(index), width=128, height=64)
        normal_image.generated_color = (.5, .5, 1, 1)
        normal_image.colorspace_settings.name = 'Non-Color'
        normal_image.pack()
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = normal_image
        normal = nodes.new('ShaderNodeNormalMap')
        links.new(tex.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], principled.inputs['Normal'])
        rough_image = bpy.data.images.new('Fixture roughness ' + str(index), width=128, height=64)
        rough_image.generated_color = (.5, .8, .2, 1)
        rough_image.colorspace_settings.name = 'Non-Color'
        rough_image.pack()
        rough_tex = nodes.new('ShaderNodeTexImage')
        rough_tex.image = rough_image
        channels = nodes.new('ShaderNodeSeparateColor')
        links.new(rough_tex.outputs['Color'], channels.inputs['Color'])
        links.new(channels.outputs['Green'], principled.inputs['Roughness'])
        links.new(channels.outputs['Blue'], principled.inputs['Metallic'])
    bpy.ops.export_scene.gltf(filepath=str(source), export_format='GLB', export_animations=False)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    report = module.prepare_prop(source, output, name='fixture-basket', triangles=200,
                                 texture_limit=64, force=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, 'Source was modified'
    assert report['source']['sha256'] == source_hash
    assert report['source']['mesh_count'] == 2
    assert report['result']['triangles'] <= 200, report
    assert report['result']['triangles'] > 0
    assert report['result']['mesh_count'] == 1
    assert report['result']['material_count'] == 2
    assert report['result']['texture_count'] >= 6
    assert all(max(image['after']) <= 64 for image in report['textures'])
    doc = glb_document(output)
    assert len(doc['meshes']) == 1
    assert all('baseColorTexture' in mat['pbrMetallicRoughness'] for mat in doc['materials'])
    assert all('normalTexture' in mat for mat in doc['materials'])
    assert all('metallicRoughnessTexture' in mat['pbrMetallicRoughness'] for mat in doc['materials'])
    assert all(mat['extras']['ludingFinish'] for mat in doc['materials'])
    assert all('TEXCOORD_0' in primitive['attributes'] for primitive in doc['meshes'][0]['primitives'])
    assert 'animations' not in doc
    assert all('bufferView' in image and 'uri' not in image for image in doc['images'])
    assert all(image['mimeType'] == 'image/webp' for image in doc['images']), 'Web texture encoding'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(output))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    assert len(meshes) == 1
    obj = meshes[0]
    bounds = [obj.matrix_world @ Vector(point) for point in obj.bound_box]
    lo = [min(point[axis] for point in bounds) for axis in range(3)]
    hi = [max(point[axis] for point in bounds) for axis in range(3)]
    assert abs(lo[2]) < 1e-5, (lo, hi)
    assert abs((hi[0] + lo[0]) / 2) < 1e-5, (lo, hi)
    assert abs((hi[1] + lo[1]) / 2) < 1e-5, (lo, hi)
    assert abs(max(hi[0] - lo[0], hi[1] - lo[1]) - 1.0) < 1e-5, (lo, hi)
    for bad_output, force in [(source, True), (output, False)]:
        try:
            module.prepare_prop(source, bad_output, force=force)
        except (ValueError, FileExistsError):
            pass
        else:
            raise AssertionError('Expected overwrite protection for ' + str(bad_output))
    stored = json.loads(output.with_suffix('.json').read_text(encoding='utf-8'))
    assert stored == report
    print('TRIPO_PROP_CHECK ' + json.dumps({'passed': True,
          'triangles': report['result']['triangles'], 'source_meshes': 2,
          'output_meshes': len(meshes), 'materials': len(doc['materials']),
          'embedded_textures': len(doc['images']), 'source_unchanged': True}), flush=True)


if __name__ == '__main__':
    check()
