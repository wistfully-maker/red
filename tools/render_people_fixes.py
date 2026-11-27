"""Read-only before/after Cycles proofs for the reviewed Ruijin/Dawei people."""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from render_station_stories import finishes

OUT=ROOT/'output/person-fixes';OUT.mkdir(parents=True,exist_ok=True)
VIEWS={
    'ruijin':[
        ('farmer',(-1.4,-1.1,4.7241678),(-1.791,-3.666,5.089),2.6195),
        ('reader',(-1.85,-.02,4.75),(.704,-2.264,5.24),3.4),
        ('courtyard',(-1.9,-.1,4.45),(3.2,-7.6,7.1),8.8)],
    'dawei':[('bridge',(-2.1,0,3.8),(1.4,-7,6.8),8.4)]
}


def static_meshes():
    result={}
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.name.startswith('People') or obj.get('fieldSuppliedActor'):continue
        data=obj.data;data.calc_loop_triangles()
        positions=np.empty(len(data.vertices)*3,dtype=np.float32);data.vertices.foreach_get('co',positions)
        indices=np.empty(len(data.loop_triangles)*3,dtype=np.int32);data.loop_triangles.foreach_get('vertices',indices)
        digest=hashlib.sha256(positions.tobytes()+indices.tobytes()+np.array(obj.matrix_world,dtype=np.float32).tobytes()).hexdigest()
        result[obj.name]={'sha256':digest,'vertices':len(data.vertices),'triangles':len(data.loop_triangles)}
    return result


def render(sid,phase):
    source=(ROOT/'.workbuddy/person-fixes'/('before-'+sid+'.glb') if phase=='before'
            else ROOT/'assets/models/landscapes'/(sid+'.glb'))
    sha=hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
    preserved=static_meshes();scene=bpy.context.scene
    for obj in scene.objects:
        if obj.get('journalGuide'):obj.hide_render=True
    finishes()
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.max_bounces=5
    scene.world=bpy.data.worlds.new('People review daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.67,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2.25;sun.data.angle=.11
    sun.data.color=(1,.88,.73);sun.rotation_euler=Vector((2.6,1.74,-.94)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
    camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32;camera.data.lens=16/math.tan(math.radians(21))
    camera.data.clip_start=.025;camera.data.clip_end=12000
    scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=94
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
    views=[]
    for key,target,eye,distance in VIEWS[sid]:
        target=Vector(target);camera.location=eye
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        path=OUT/(sid+'-'+key+'-'+phase+'.jpg');scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True);views.append(str(path))
    report={'station':sid,'phase':phase,'sourceSHA256':sha,'proofs':views,'static_meshes':preserved}
    (OUT/(sid+'-'+phase+'-render.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
    print('PERSON_FIX_PROOF',sid,phase,len(views),'model unchanged',flush=True)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['after']
    for sid in ('ruijin','dawei'):render(sid,args[0])
