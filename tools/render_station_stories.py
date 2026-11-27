"""Read-only Cycles checks of the exported non-Luding story cameras.

Use Blender -b -P tools/render_station_stories.py -- yudu jiajin zunyi.
Models and web assets are never rewritten. Generic surfaces approximate the
web's existing colour/scan palette; the embedded figure finish is preserved.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/station-stories';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=(ROOT/'assets/valley-materials.js').read_text(encoding='utf8')
SURFACES={name:(image,colour,float(span)) for name,image,colour,span in re.findall(
    r"(\w+):\s*\['([^']+)',\s*'(#[0-9a-f]+)',\s*([\d.]+)\]",SOURCE)}
SOLID=dict(re.findall(r"(\w+):\s*'(#[0-9a-f]+)'",SOURCE))


def rgba(code):
    c=[int(code[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)+(1.,)


def finishes():
    for mat in bpy.data.materials:
        if mat.get('fieldFigureFinish') or mat.get('ludingFinish') or mat.get('nativeLandscapeFinish'):continue
        if mat.name.startswith('ground_'):continue
        # Keep any other authored embedded material, including face and cloth maps.
        if mat.use_nodes and any(n.type=='TEX_IMAGE' and n.image for n in mat.node_tree.nodes):continue
        name=mat.name;spec=SURFACES.get(name)
        colour=spec[1] if spec else SOLID.get(name,'#a49679')
        mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
        bs=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');links.new(bs.outputs[0],out.inputs['Surface'])
        bs.inputs['Base Color'].default_value=rgba(colour);bs.inputs['Roughness'].default_value=.85
        if name.startswith('iron'):
            bs.inputs['Metallic'].default_value=.42;bs.inputs['Roughness'].default_value=.63
        if name in ('jade_water','silt_water','water'):
            bs.inputs['Base Color'].default_value=rgba('#508579' if name!='silt_water' else '#877e56')
            bs.inputs['Metallic'].default_value=.055;bs.inputs['Roughness'].default_value=.35
        if not spec:continue
        texture,_,span=spec;path=ROOT/'assets/valley'/(texture+'.webp')
        if not path.exists():continue
        coords=nodes.new('ShaderNodeNewGeometry');scale=nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=1/span
        links.new(coords.outputs['Position'],scale.inputs[0])
        image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(path),check_existing=True)
        image.projection='BOX';image.projection_blend=.22;image.extension='REPEAT';links.new(scale.outputs[0],image.inputs[0])
        multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
        multiply.inputs[1].default_value=rgba(colour);links.new(image.outputs['Color'],multiply.inputs[2]);links.new(multiply.outputs[0],bs.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.17;bump.inputs['Distance'].default_value=.012
        links.new(image.outputs['Color'],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal'])


def render(sid):
    if sid=='luding':raise ValueError('This checker does not render or modify Luding')
    path=ROOT/'assets/models/landscapes'/(sid+'.glb')
    before=hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    scene=bpy.context.scene
    ground=next(o for o in scene.objects if o.type=='MESH' and o.data.materials[0].name.startswith('ground_'))
    targets=json.loads(ground.get('storyDetailTargetsJSON','[]'))
    if not targets:raise ValueError('No story details in exported '+sid)
    for o in scene.objects:
        if o.get('journalGuide'):o.hide_render=True
        if sid=='zunyi' and o.get('roomCut'):o.hide_render=True;o.hide_set(True)
    finishes()
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.cycles.max_bounces=5
    scene.world=bpy.data.worlds.new('Diffuse valley daylight');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.64,.67,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.68
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2.25;sun.data.angle=.11;sun.data.color=(1,.88,.73)
    sun.rotation_euler=Vector((2.6,1.74,-.94)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21));cam.data.clip_start=.025;cam.data.clip_end=12000
    x,z,ny,d,yaw,pitch=list(ground['tableauView']);target=Vector((x,-ny,z))
    cam.location=target+Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))*d
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=1120;scene.render.resolution_y=760;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=93
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
    scene.render.filepath=str(OUT/(sid+'-tableau.jpg'));bpy.ops.render.render(write_still=True)
    # Ray evidence distinguishes a visible group from a tiny item hidden behind
    # its supporting person/table. The images remain the final layout check.
    def evidence_for_camera():
        bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();result=[]
        for item in targets:
            point=Vector(item['point']);ray=point-cam.location
            hit,where,normal,index,obj,matrix=scene.ray_cast(graph,cam.location,ray.normalized(),distance=ray.length+.02)
            frame=world_to_camera_view(scene,cam,point)
            result.append({**item,'firstHit':obj.name if hit else None,'hitDistanceFromTarget':float((where-point).length) if hit else None,
                           'frameXY':[float(frame.x),float(frame.y)],'insideFrame':bool(frame.z>0 and 0<frame.x<1 and 0<frame.y<1)})
        return result
    evidence=evidence_for_camera()
    report={'station':sid,'modelSHA256':before,'tableauView':list(ground['tableauView']),'cameraBlender':list(cam.location),
            'storyMeshes':len([o for o in scene.objects if o.name.startswith('Story details ')]),'targets':evidence,
            'limit':'Static surface approximation of the web palette; embedded figure materials are retained; forest instances are not expanded.'}
    if 'boatView' in ground:
        bx,bz,minus_y=list(ground['boatView']);boat_target=Vector((bx,-minus_y,bz))
        distance=ground['hullDimensions'][0]*1.6;yaw=.56;pitch=.47
        cam.location=boat_target+Vector((math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)))*distance
        cam.rotation_euler=(boat_target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/(sid+'-boat.jpg'));bpy.ops.render.render(write_still=True)
        report['boatCameraBlender']=list(cam.location);report['boatTargets']=evidence_for_camera()
    (OUT/(sid+'-check.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    assert hashlib.sha256(path.read_bytes()).hexdigest()==before
    print('STORY_PROOF',sid,report['storyMeshes'],len(targets),'model unchanged',flush=True)


if __name__=='__main__':
    names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['yudu','jiajin','zunyi']
    for name in names:render(name)
