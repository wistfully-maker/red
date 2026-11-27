"""Prepare a user-exported textured static GLB for Luding linked instances.

Run in a separate Blender process (the in-memory scene is cleared):
  blender --background --factory-startup --python-exit-code 17 \
    --python tools/prepare_tripo_prop.py -- \
    .workbuddy/luding-tripo/bamboo-backbasket-source.glb \
    assets/luding/props/bamboo-backbasket.glb --preview

Preserves the source file and PBR/UV data. Exports a single static mesh, with
bottom-centred origin and longest horizontal extent of 1 metre by default.
This matches tools/luding_bank.py's existing metre-wide prop convention.
Output: embedded-texture GLB, same-stem JSON report, optional front/back/top PNGs.
WebP quality 90 is the web delivery default; --image-format AUTO retains standard
PNG/JPEG encoding where a downstream importer lacks EXT_texture_webp support.
No generation service, paid processing, or external Python packages are used.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


def bounds(obj):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    if not points:
        raise ValueError('The supplied mesh has no vertices')
    return [Vector(tuple(fn(point[axis] for point in points) for axis in range(3)))
            for fn in (min, max)]


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def render_checks(output):
    """Use the same PBR material for three independently useful inspection views."""
    # Inspect the compressed delivery file, not an uncompressed in-memory material.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(output))
    obj = next(item for item in bpy.context.scene.objects if item.type == 'MESH')
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new('Prop inspection studio')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.68, .68, .68, 1)
    background.inputs['Strength'].default_value = .6
    lo, hi = bounds(obj)
    centre = (lo + hi) / 2
    span = max(hi - lo)
    for offset, energy, size in [((2, -3, 4), 450, 3), ((-3, 1, 2), 220, 3)]:
        bpy.ops.object.light_add(type='AREA', location=centre + Vector(offset) * span)
        light = bpy.context.object
        light.data.energy = energy * span * span
        light.data.shape = 'DISK'
        light.data.size = size * span
        light.rotation_euler = (centre - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.65
    camera.data.clip_start = .001
    camera.data.clip_end = max(100, span * 30)
    scene.camera = camera
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    paths = []
    for label, direction in [('front', (1, -2, .85)), ('back', (-1, 2, .85)),
                             ('top', (0, -1, 2.3))]:
        camera.location = centre + Vector(direction).normalized() * span * 4
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        path = output.with_name(output.stem + '-' + label + '.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(str(path))
    return paths


def prepare_prop(source, output, *, name=None, triangles=18000, texture_limit=2048,
                 span=1.0, yaw=0.0, image_format='WEBP', image_quality=90,
                 preview=False, force=False):
    source, output = Path(source).resolve(), Path(output).resolve()
    if source == output:
        raise ValueError('Input and output must differ; the source GLB is read-only')
    if not source.is_file() or source.suffix.lower() != '.glb':
        raise ValueError('Input must be an existing GLB exported with textures')
    if output.suffix.lower() != '.glb':
        raise ValueError('Output filename must end in .glb')
    if triangles < 4 or texture_limit < 16 or not math.isfinite(span) or span <= 0:
        raise ValueError('Use at least 4 triangles, texture size >= 16, and a positive span')
    if not math.isfinite(yaw):
        raise ValueError('Yaw must be a finite number of degrees')
    if image_format not in ('AUTO', 'WEBP') or not 1 <= image_quality <= 100:
        raise ValueError('Image format must be AUTO/WEBP, with quality from 1 to 100')
    report_path = output.with_suffix('.json')
    destinations = [output, report_path]
    if preview:
        destinations += [output.with_name(output.stem + '-' + view + '.png')
                         for view in ('front', 'back', 'top')]
    if source in destinations:
        raise ValueError('Output paths must not replace the source')
    if not force:
        for path in destinations:
            if path.exists():
                raise FileExistsError(str(path) + ' exists; choose a new output or pass --force')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == 'MESH' and len(obj.data.polygons)]
    if not meshes:
        raise ValueError('No polygon meshes were found in the supplied GLB')
    if any(obj.type == 'ARMATURE' or obj.animation_data for obj in objects):
        raise ValueError('Export a static prop without armatures or animation')
    if any(obj.data.shape_keys for obj in meshes):
        raise ValueError('Export a static prop without shape keys')
    materials = {mat for obj in meshes for mat in obj.data.materials if mat}
    images = {node.image for mat in materials if mat.node_tree
              for node in mat.node_tree.nodes
              if node.type == 'TEX_IMAGE' and node.image}
    if not images:
        raise ValueError('No image textures found; re-export GLB with materials and textures')
    for obj in meshes:
        textured = any(mat and mat.node_tree and any(node.type == 'TEX_IMAGE' and node.image
                       for node in mat.node_tree.nodes) for mat in obj.data.materials)
        if textured and not obj.data.uv_layers:
            raise ValueError('Textured mesh has no UV coordinates: ' + obj.name)
    original_triangles = sum(triangle_count(obj) for obj in meshes)
    # Capture every world matrix before changing parents; imported hierarchies can
    # have another mesh as parent, not only empties.
    world_matrices = {obj: obj.matrix_world.copy() for obj in meshes}
    rotation = Matrix.Rotation(math.radians(yaw), 4, 'Z')
    for obj in meshes:
        obj.data = obj.data.copy()
        transform = rotation @ world_matrices[obj]
        obj.parent = None
        obj.matrix_world.identity()
        obj.data.transform(transform)
        if transform.determinant() < 0:
            obj.data.flip_normals()
        obj.data.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = 'Supplied ' + (name or output.stem)
    obj.data.name = obj.name
    # Use real triangulated counts; polygon counts underestimate quad/ngon inputs.
    for _ in range(4):
        count = triangle_count(obj)
        if count <= triangles:
            break
        modifier = obj.modifiers.new('Web triangle budget', 'DECIMATE')
        modifier.ratio = max(.000001, (triangles - 1) / count)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if triangle_count(obj) > triangles or not len(obj.data.polygons):
        raise ValueError('Cannot meet triangle budget without an empty mesh; increase --triangles')
    lo, hi = bounds(obj)
    horizontal_extent = max(hi.x - lo.x, hi.y - lo.y)
    if horizontal_extent <= 1e-8:
        raise ValueError('The mesh has no usable horizontal extent; check its orientation')
    pivot = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    scale = span / horizontal_extent
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co - pivot) * scale
    obj.data.update()
    for mat in materials:
        # The scene finish pass must retain supplied PBR maps instead of replacing
        # them with the generic historical palette.
        mat['ludingFinish'] = True
    texture_report = []
    for image in sorted(images, key=lambda item: item.name):
        before = list(image.size)
        if min(before) <= 0 or not image.has_data:
            raise ValueError('Texture image has no readable pixels: ' + image.name)
        if max(before) > texture_limit:
            ratio = texture_limit / max(before)
            image.scale(max(1, round(before[0] * ratio)), max(1, round(before[1] * ratio)))
        image.pack()
        texture_report.append({'name': image.name, 'before': before, 'after': list(image.size),
                               'color_space': image.colorspace_settings.name})
    obj['sourceAsset'] = source.name
    obj['sourceSHA256'] = source_hash
    obj['propSpanMetres'] = span
    obj['pivotConvention'] = 'bottom-centre; Blender Z up, glTF Y up'
    output.parent.mkdir(exist_ok=True, parents=True)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                              export_extras=True, export_animations=False,
                              export_image_format=image_format, export_image_quality=image_quality)
    result_lo, result_hi = bounds(obj)
    report = {
        'asset': name or output.stem,
        'source': {'file': str(source), 'sha256': source_hash, 'mesh_count': len(meshes),
                   'triangles': original_triangles},
        'result': {'file': str(output), 'bytes': output.stat().st_size,
                   'mesh_count': 1, 'triangles': triangle_count(obj),
                   'material_count': len(obj.data.materials), 'texture_count': len(images),
                   'texture_encoding': image_format, 'texture_quality': image_quality,
                   'bounds_blender': [list(result_lo), list(result_hi)],
                   'dimensions_blender': list(result_hi - result_lo),
                   'dimensions_gltf': [result_hi.x - result_lo.x, result_hi.z - result_lo.z,
                                       result_hi.y - result_lo.y]},
        'normalisation': {'span_metres': span, 'scale_from_import': scale,
                          'bottom_centre_before_scale': list(pivot), 'yaw_degrees': yaw},
        'textures': texture_report,
        'preview_files': render_checks(output) if preview else [],
        'notes': ['GLB includes textures; source GLB is unchanged.',
                  'Scale is normalised, not an assertion of measured historical dimensions.',
                  'Inspect the front/back/top views for generated geometry defects before placement.'],
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('TRIPO_PROP_REPORT ' + json.dumps(report, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--name', help='Asset name in the GLB and report; defaults to output stem')
    parser.add_argument('--triangles', type=int, default=18000)
    parser.add_argument('--texture-limit', type=int, default=2048)
    parser.add_argument('--span', type=float, default=1.0, help='Longest horizontal extent in metres')
    parser.add_argument('--yaw', type=float, default=0.0, help='Rotate about Blender Z, in degrees')
    parser.add_argument('--image-format', choices=('WEBP', 'AUTO'), default='WEBP')
    parser.add_argument('--image-quality', type=int, default=90)
    parser.add_argument('--preview', action='store_true', help='Render front, back, and top PNGs')
    parser.add_argument('--force', action='store_true', help='Replace existing outputs, never the source')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    prepare_prop(**vars(args))


if __name__ == '__main__':
    main()
