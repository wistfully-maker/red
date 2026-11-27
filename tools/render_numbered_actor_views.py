"""Render front/back of actual actors reimported from the delivered station GLBs.

Surrounding architecture is hidden for the portrait proof, so a wall cannot
conceal a second face. Geometry, UVs, native materials and scale are unmodified.
"""
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/numbered-people';OUT.mkdir(exist_ok=True,parents=True)
VIEWS={'ruijin':['farmer-greeting','newspaper-reader'],
       'yudu':['boatman-rowing'],
       'liping':['journal-writer','seated-civilian-woman'],
       'xiangjiang':['kneeling-caregiver'],
       'zunyi':['seated-delegate'],
       'jiajin':['resting-marcher','staff-climber']}


def render(sid):
    path=ROOT/'assets/models/landscapes'/(sid+'.glb');digest=hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
    scene=bpy.context.scene
    choices={key:next(o for o in scene.objects if o.get('fieldSuppliedActor')==key) for key in VIEWS[sid]}
    for o in scene.objects:
        if o.type=='MESH':o.hide_render=True
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
    scene.world=bpy.data.worlds.new('Actor proof neutral backdrop');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.45,.45,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.type='ORTHO';cam.data.clip_start=.01;cam.data.clip_end=1000
    scene.render.resolution_x=540;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=95
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.3
    lights=[]
    for _ in range(2):
        bpy.ops.object.light_add(type='AREA');lights.append(bpy.context.object)
    report=[]
    for key,obj in choices.items():
        obj.hide_render=False;bpy.context.view_layer.update()
        corners=[obj.matrix_world@Vector(p) for p in obj.bound_box]
        low=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
        high=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
        centre=(low+high)/2;height=high.z-low.z
        forward=(obj.matrix_world.to_3x3()@Vector((1,0,0))).normalized()
        right=forward.cross(Vector((0,0,1))).normalized()
        cam.data.ortho_scale=max(height*1.15,max(high.x-low.x,high.y-low.y)*1.7)
        for side,light in zip((-1,1),lights):
            light.location=centre+forward*height*side*2+right*height+Vector((0,0,height*2))
            light.data.energy=180*height*height;light.data.size=height*2
            light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
        paths=[]
        for label,direction in [('front',1),('back',-1)]:
            cam.location=centre+forward*height*3*direction+Vector((0,0,height*.04))
            cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(OUT/(sid+'-'+key+'-'+label+'.jpg'))
            bpy.ops.render.render(write_still=True);paths.append(scene.render.filepath)
        obj.hide_render=True
        report.append({'station':sid,'sourceSHA256':digest,'actor':key,'portraits':paths,
                       'scope':'Actual exported actor; surrounding objects hidden for a clear front/back geometry and texture check.'})
    assert digest==hashlib.sha256(path.read_bytes()).hexdigest()
    (OUT/(sid+'-portraits.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('NUMBERED_EXPORTED_ACTOR_PORTRAITS',sid,list(choices),flush=True)


if __name__=='__main__':
    ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(VIEWS)
    for sid in ids:render(sid)
