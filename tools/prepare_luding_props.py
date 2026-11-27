"""Blender -b -P tools/prepare_luding_props.py -- source-paths.json output-directory

The JSON maps a short asset name to a supplied GLB. Masters are read-only.
Export normalized, textured metre-wide props suitable for linked instances.
"""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:]
sources=json.loads(Path(args[0]).read_text(encoding='utf-8-sig'))
out=Path(args[1]).resolve()
out.mkdir(exist_ok=True,parents=True)
for key,source in sources.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
    obj=objects[0]
    assert len(objects)==1, 'Expected one textured shell: '+key
    obj.data.transform(obj.matrix_world)
    obj.matrix_world.identity()
    mod=obj.modifiers.new('Web silhouette','DECIMATE')
    target=18500 if key=='house' else 8500 if key in ('gate','carving') else 2600
    mod.ratio=min(1,target/len(obj.data.polygons))
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bb=[Vector(p) for p in obj.bound_box]
    lo=Vector(tuple(min(v[i] for v in bb) for i in range(3)))
    hi=Vector(tuple(max(v[i] for v in bb) for i in range(3)))
    pivot=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z));unit=max(hi.x-lo.x,hi.y-lo.y)
    for v in obj.data.vertices:v.co=(v.co-pivot)/unit
    obj.name='Supplied '+key;obj.data.name=obj.name
    for mat in obj.data.materials:mat.name='Source '+key;mat['ludingFinish']=True
    for im in bpy.data.images:
        if im.type!='IMAGE' or not im.has_data:continue
        w,h=im.size;limit=1536 if key=='house' else 768
        if max(w,h)>limit:im.scale(round(w*limit/max(w,h)),round(h*limit/max(w,h)));im.pack()
    bpy.ops.export_scene.gltf(filepath=str(out/(key+'.glb')),export_format='GLB',use_selection=True,
                              export_extras=True,export_animations=False,export_image_format='WEBP',export_image_quality=84)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4
    scene.world=bpy.data.worlds.new('Asset check');scene.world.color=(.58,.58,.58)
    bpy.ops.object.light_add(type='SUN');bpy.context.object.rotation_euler=(.55,-.45,-.2);bpy.context.object.data.energy=2.7
    target=Vector((0,0,(hi.z-lo.z)/unit*.46));bpy.ops.object.camera_add()
    cam=bpy.context.object;cam.location=target+Vector((1.3,-1.85,1.03));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=1.46;scene.camera=cam
    scene.render.resolution_x=400;scene.render.resolution_y=330;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.filepath=str(out/(key+'.jpg'))
    bpy.ops.render.render(write_still=True)
