"""Decimate the inhabited landmarks for the national route's relief-map scale."""
from pathlib import Path
import sys, math
import bpy
import bmesh
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_valley_scenes as source

IDS=['yudu','xiangjiang','zunyi','jiaoping','luding','jiajin','songpan','wuqi','huining']
# Linear reflectance values baked into one vertex-color material.
PIGMENTS={'tile':(.065,.083,.088),'tilerib':(.12,.14,.14),'timber':(.15,.076,.036),
    'wood':(.31,.21,.12),'stone':(.32,.31,.28),'plaster':(.63,.60,.49),
    'red':(.48,.054,.025),'recess':(.045,.039,.034),'iron':(.11,.13,.14),
    'snow':(.85,.89,.86),'earth':(.43,.30,.15),'water':(.08,.21,.20)}

bpy.ops.wm.read_factory_settings(use_empty=True)
shared=source.material('Relief pigments')
shared.use_nodes=True
bsdf=next(n for n in shared.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
vc=shared.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Pigment'
shared.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color'])
for sid in IDS:
    env=source.Landscape(sid)
    known=set(bpy.context.scene.objects)
    source.create_landmark(env)
    if sid in ['songpan','jiajin']:
        w=14 if sid=='songpan' else 16
        p=[];f=[]
        for j in range(24):
            y=(j/23*2-1)*w
            for i in range(24):
                x=(i/23*2-1)*w
                # An irregular low silhouette feathers into the atlas surface.
                z=env.height(x,y)-.12
                p.append((x,y,z));k=len(p)-1
                if i and j and (x/w)**2+(y/w)**2<.96:f.append((k-25,k-24,k,k-1))
        source.geometry('Pass and meadow',p,f,'snow' if sid=='jiajin' else 'earth')
    verts=[];faces=[];colors=[]
    extent={'luding':68,'yudu':9,'songpan':14}.get(sid,17)
    for obj in list(set(bpy.context.scene.objects)-known):
        mesh=obj.data;name=mesh.materials[0].name
        if name=='iron_near':
            bpy.data.objects.remove(obj,do_unlink=True)
            continue
        if name=='iron_far':name='iron'
        bm=bmesh.new();bm.from_mesh(mesh)
        discard=[v for v in bm.verts if abs(v.co.x)>extent or abs(v.co.y)>extent*.91]
        bmesh.ops.delete(bm,geom=discard,context='VERTS')
        if bm.faces:
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.012)
            bm.to_mesh(mesh);mesh.update()
        else:
            bm.free();bpy.data.objects.remove(obj,do_unlink=True);continue
        bm.free()
        limit=2400 if name in ['stone','wood','plaster','tile'] else 750
        if len(mesh.polygons)>limit:
            mod=obj.modifiers.new('Distant silhouette','DECIMATE');mod.ratio=min(1,limit/len(mesh.polygons))
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
        mesh=obj.data;k=len(verts)
        verts.extend(tuple(v.co) for v in mesh.vertices)
        colors.extend([(*PIGMENTS.get(name,(.42,.41,.32)),1)]*len(mesh.vertices))
        faces.extend(tuple(i+k for i in face.vertices) for face in mesh.polygons)
        bpy.data.objects.remove(obj,do_unlink=True)
    if not verts:raise ValueError(sid)
    lo=min(p[2] for p in verts);width=max(max(p[a] for p in verts)-min(p[a] for p in verts) for a in (0,1))
    points=[(x/width,y/width,(z-lo)/width) for x,y,z in verts]
    # At this LOD an entire tile ridge can project to less than one pixel.
    # Weld subpixel features per pigment before triangulation.
    reduced=[];pigments=[];lookup={};remap=[]
    for pt,col in zip(points,colors):
        cell=tuple(round(v*83) for v in pt)
        key=(cell,col)
        if key not in lookup:
            lookup[key]=len(reduced);reduced.append(pt);pigments.append(col)
        remap.append(lookup[key])
    polygons=[]
    for face in faces:
        ordered=list(dict.fromkeys(remap[i] for i in face))
        if len(ordered)>=3:polygons.append(ordered)
    obj=source.geometry(sid,reduced,polygons,shared.name)
    obj.data.validate()
    attr=obj.data.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='POINT')
    for cell,col in zip(attr.data,pigments):cell.color=col
output=source.ROOT/'assets/models/valley-landmarks.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=False,
    export_yup=True,export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression')

