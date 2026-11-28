"""Rebuild only reviewed scenes and refresh their production stills/proofs."""
from pathlib import Path
import json, math, sys
from types import SimpleNamespace
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import build_valley_scenes as builder
from rebuild_numbered_people import audit,previews
from render_station_stories import finishes
from review_scene_layout import inspect

OUT=ROOT/'output/scene-layout';OUT.mkdir(exist_ok=True,parents=True)
VIEWS={
 'liping': [('shop-clearance',(-1.3,-8.5,1.05),(-.3,-16,5.5),11),
            ('shopkeeper',(-2,-7.5,1.0),(1.5,-11.8,3.0),5.2)],
 'zunyi': [('entry',(.3,-5.0,1.2),(3.1,-10.7,3.8),5.5)],
 'chishui': [('quay',(-2.4,2.8,2.7),(-1,-8.7,6.8),10.5)],
 'lianghekou': [('meeting',(0,-1.2,1.05),(0,-12.8,5.4),10.5),
                ('meeting-side',(0,-1.2,.65),(9.5,-8.4,3.7),10.5)],
 'luding': [('upright-table',(-60,4.5,8.65),(-56.8,8.2,11),4.6)]}


def setup():
    scene=bpy.context.scene
    finishes()
    for o in scene.objects:
        if o.get('journalGuide'):o.hide_render=True
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4
    scene.world=bpy.data.worlds.new('Scene layout daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.67,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2.25;sun.data.angle=.11
    sun.data.color=(1,.88,.73);sun.rotation_euler=Vector((2.6,1.74,-.94)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.type='ORTHO';cam.data.clip_start=.02;cam.data.clip_end=12000
    scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=94
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
    return scene,cam


def render_proofs(sid):
    scene,cam=setup()
    for key,target,eye,span in VIEWS[sid]:
        if sid=='liping' and key=='shopkeeper':
            actor=next(o for o in scene.objects if o.get('fieldSuppliedActor')=='farmer-greeting')
            x,y,z=actor.location
            env=SimpleNamespace(figures=SimpleNamespace(portrait_candidates=[
                (x,y,z,actor['posedHeight'],actor['authorYaw'],'greet',False)]),height=lambda x,y:.24)
            view=builder.frame_resident(env)
            if view is None:raise ValueError('No clear front camera for the moved Liping shopkeeper')
            x,z,ny,d,yaw,pitch=view;target=Vector((x,-ny,z))
            eye=target+d*Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))
            span=3.1
        cam.location=eye;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=span
        scene.render.filepath=str(OUT/(sid+'-'+key+'.jpg'));bpy.ops.render.render(write_still=True)
    if sid=='luding':
        carving=next(o for o in scene.objects if o.name=='Supplied carving')
        state={o:o.hide_render for o in scene.objects if o.type=='MESH'}
        for o in state:o.hide_render=o!=carving
        centre=Vector((-60,4.5,8.5));cam.location=centre+Vector((3.4,4.2,2.3))
        cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.5
        scene.render.filepath=str(OUT/'luding-upright-frame.jpg');bpy.ops.render.render(write_still=True)
        for o,hidden in state.items():o.hide_render=hidden
    # The gallery thumbnail is always a render of the delivered geometry.
    if sid=='luding':
        cam.location=(61,-20,12.6);cam.rotation_euler=(Vector((8,32.8,11.6))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.type='PERSP';cam.data.lens=22.5
    else:
        ground=next(o for o in scene.objects if o.type=='MESH' and o.data.materials[0].name.startswith('ground_'))
        target=Vector((-2.2 if sid=='zunyi' else 0,0,ground['targetHeight']))
        distance=ground['framingWidth']/(.83*1.55);yaw=.60;pitch=.59
        cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21))
        cam.location=target+distance*Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=960;scene.render.resolution_y=640
    scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=90
    scene.render.filepath=str(ROOT/'assets/valley/stills'/(sid+'.webp'));bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:]
    render_only='--render-only' in args
    proof_only='--proof-only' in args
    for sid in [a for a in args if not a.startswith('--')]:
        if not render_only and not proof_only:builder.build(sid)
        else:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/landscapes'/(sid+'.glb')))
        ground=(next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0].name.startswith('ground_'))
                if render_only or proof_only else audit(sid))
        if sid!='luding' and not proof_only:previews(sid,ground)
        render_proofs(sid)
        inspect(sid,'after')
