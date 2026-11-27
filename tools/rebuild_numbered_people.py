"""Rebuild every station, audit supplied actors and render actual scene previews.

Blender --background --python-exit-code 17 --python tools/rebuild_numbered_people.py
Optional station ids after -- allow a focused recheck. Source models are read only.
"""
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import build_valley_scenes as builder
from render_station_stories import finishes

OUT=ROOT/'output/numbered-people';OUT.mkdir(exist_ok=True,parents=True)


def audit(sid):
    bpy.context.view_layer.update()
    scene=bpy.context.scene
    actors=[o for o in scene.objects if o.get('fieldSuppliedActor')]
    procedural=[o.name for o in scene.objects if o.type=='MESH' and
                ((o.name.startswith('People ') and not o.get('fieldSuppliedActor')) or
                 any(m and m.name.startswith('fig_') for m in o.data.materials))]
    assert not procedural,(sid,procedural)
    ground=next(o for o in scene.objects if o.type=='MESH' and o.data.materials[0].name.startswith('ground_'))
    assert len(actors)==ground['figureCount'],(sid,len(actors),ground['figureCount'])
    rows=[]
    for o in actors:
        points=[o.matrix_world@v.co for v in o.data.vertices]
        low=min(p.z for p in points);height=max(p.z for p in points)-low
        assert abs(low-o['placementFloor'])<2e-5,(sid,o.name,low,o['placementFloor'])
        assert abs(height-o['posedHeight'])<2e-5,(sid,o.name,height,o['posedHeight'])
        direction=(o.matrix_world.to_3x3()@Vector((1,0,0))).normalized()
        expected=Vector((math.sin(o['authorYaw']),-math.cos(o['authorYaw']),0))
        assert direction.dot(expected)>.999999,(sid,o.name,'front axis')
        assert all(m.get('fieldFigureFinish') and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes)
                   for m in o.data.materials),(sid,o.name,'native texture lost')
        rows.append({'asset':o['fieldSuppliedActor'],'position':list(o.location),
                     'requestedPose':o['requestedPose'],'sourcePose':o['sourcePose'],
                     'floor':low,'height':height,'nominalAdultHeight':o['nominalAdultHeight'],
                     'frontBlender':list(direction),'embeddedSupport':o['embeddedSupport']})
    if sid=='dawei':
        for position in [(-2.1,.33,2.89),(-.5,-.33,2.89)]:
            assert not any((Vector(row['position'])-Vector(position)).length<1e-4 for row in rows)
    chairs=[o for o in scene.objects if o.get('fieldSuppliedProp')=='folding-chair']
    for o in actors:
        if o.get('embeddedSupport') not in ('chair','stool'):continue
        assert not any(math.hypot(p.location.x-o.location.x,p.location.y-o.location.y)<.43
                       and abs(p.location.z-o.location.z)<.20 for p in chairs),(sid,'duplicate chair')
    source=ROOT/'assets/models/landscapes'/(sid+'.glb')
    report={'station':sid,'passed':True,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'bytes':source.stat().st_size,'people':len(rows),'counts':dict(Counter(r['asset'] for r in rows)),
            'proceduralPeople':procedural,'actors':rows,
            'checks':['bottom on authored floor','pose-specific height','front direction',
                      'native UV/PBR retained','no duplicate supplied chair','no procedural historical mesh']}
    (OUT/(sid+'-audit.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('NUMBERED_SCENE_AUDIT',sid,len(rows),report['counts'],flush=True)
    return ground


def previews(sid,ground):
    scene=bpy.context.scene
    finishes()
    scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True;scene.cycles.max_bounces=4
    scene.world=bpy.data.worlds.new('Numbered people review daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.67,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2.25;sun.data.angle=.11
    sun.data.color=(1,.88,.73);sun.rotation_euler=Vector((2.6,1.74,-.94)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21))
    cam.data.clip_start=.025;cam.data.clip_end=12000
    scene.render.resolution_x=960;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=92
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
    views=['overview','tableau']
    if 'boatView' in ground:views.append('boat')
    for mode in views:
        for o in scene.objects:
            if o.get('journalGuide'):o.hide_render=True
            if sid=='zunyi' and o.get('roomCut'):o.hide_render=mode=='tableau';o.hide_set(mode=='tableau')
        if mode=='overview':
            yaw=.60;pitch={'jiajin':.68,'songpan':.84,'lazikou':.75,'wuqi':.47}.get(sid,.59)
            target=Vector((-2.2 if sid=='zunyi' else 0,0,ground['targetHeight']))
            distance=ground['framingWidth']/(.83*1.55)
        elif mode=='boat':
            x,z,ny=ground['boatView'];target=Vector((x,-ny,z))
            distance=ground['hullDimensions'][0]*1.6;yaw=.56;pitch=.47
        else:
            x,z,ny,distance,yaw,pitch=ground['tableauView'];target=Vector((x,-ny,z))
        cam.location=target+Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))*distance
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/(sid+'-'+mode+'.jpg'));bpy.ops.render.render(write_still=True)
    print('NUMBERED_SCENE_PREVIEWS',sid,len(views),flush=True)


if __name__=='__main__':
    ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(builder.SITES)
    for sid in ids:
        builder.build(sid)
        previews(sid,audit(sid))
