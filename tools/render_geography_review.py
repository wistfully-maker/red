"""Read exported scenes only; render the actual overview/tableau camera rules."""
from pathlib import Path
import hashlib
import json
import math
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from render_station_stories import finishes
OUT=ROOT/'output/geography-review';OUT.mkdir(parents=True,exist_ok=True)


def review(sid):
    if sid=='luding':raise ValueError('Luding is excluded from this rebuild and review')
    source=ROOT/'assets/models/landscapes'/(sid+'.glb');digest=hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
    scene=bpy.context.scene
    ground=next(o for o in scene.objects if o.type=='MESH' and o.data.materials[0].name.startswith('ground_'))
    finishes()
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.cycles.max_bounces=5
    scene.world=bpy.data.worlds.new('Valley proof daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.67,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2.25;sun.data.angle=.11;sun.data.color=(1,.88,.73)
    sun.rotation_euler=Vector((2.6,1.74,-.94)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21));cam.data.clip_start=.025;cam.data.clip_end=12000
    scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=93;scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
    report={'station':sid,'sourceSHA256':digest,'landscapeAssets':list(ground.get('landscapeAssets',[])),
            'placements':json.loads(ground.get('landscapePlacementsJSON','[]')),'views':{},
            'limit':'Generic terrain/architecture use a static approximation of the web palette. Supplied native landscape and figure materials remain unchanged.'}
    for mode in ('overview','tableau'):
        for o in scene.objects:
            if o.get('journalGuide'):o.hide_render=True
            if sid=='zunyi' and o.get('roomCut'):
                o.hide_render=mode=='tableau';o.hide_set(mode=='tableau')
        if mode=='overview':
            yaw=.60;pitch={'jiajin':.68,'songpan':.84,'lazikou':.75,'wuqi':.47}.get(sid,.59)
            target=Vector((-2.2 if sid=='zunyi' else 0,0,ground['targetHeight']))
            distance=ground['framingWidth']/(.83*1.55)
        else:
            x,z,ny,distance,yaw,pitch=ground['tableauView'];target=Vector((x,-ny,z))
        cam.location=target+Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))*distance
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/(sid+'-'+mode+'.jpg'));bpy.ops.render.render(write_still=True)
        report['views'][mode]={'cameraBlender':list(cam.location),'targetBlender':list(target),'distance':distance,'yaw':yaw,'pitch':pitch}
    (OUT/(sid+'-check.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    assert digest==hashlib.sha256(source.read_bytes()).hexdigest()
    print('GEOGRAPHY_REVIEW',sid,len(report['placements']),'source unchanged',flush=True)


if __name__=='__main__':
    stations=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['jiajin','songpan','wuqi']
    for sid in stations:review(sid)
