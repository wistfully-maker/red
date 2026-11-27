"""Place the supplied keyframe models while retaining the measured bridge.

Source meshes remain read-only. Repeated pieces get one locally simplified
master, and the deck/chain arrays are baked to shared-material batches.
"""
import json
import math
from pathlib import Path
import random

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
PROPS=ROOT/'assets/luding/props'
CHAIN_READY=True


def available(key):
    return (PROPS/(key+'.glb')).exists() and (key!='kf-chain-link' or CHAIN_READY)


class Assets:
    def __init__(self):
        self.masters={}

    def master(self,key,triangles=None):
        cache=(key,triangles)
        if cache in self.masters:return self.masters[cache]
        bpy.ops.import_scene.gltf(filepath=str(PROPS/(key+'.glb')))
        objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
        if len(objects)!=1:raise ValueError('Expected one prepared mesh: '+key)
        o=objects[0];world=o.matrix_world.copy();o.parent=None
        o.data.transform(world);o.matrix_world.identity();o.data.update()
        bpy.context.view_layer.objects.active=o
        if triangles:
            # glTF splits vertices at UV seams. Weld positions before reducing
            # topology; decimating separated triangles creates loose shards.
            bm=bmesh.new();bm.from_mesh(o.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1.e-6)
            bm.to_mesh(o.data);bm.free();o.data.update()
            o.data.calc_loop_triangles();count=len(o.data.loop_triangles)
            if count>triangles:
                mod=o.modifiers.new('Repeated-piece budget','DECIMATE')
                mod.ratio=(triangles-1)/count;mod.use_collapse_triangulate=True
                bpy.ops.object.modifier_apply(modifier=mod.name)
        # The original master stays out of the scene; copies share its data.
        bpy.context.collection.objects.unlink(o)
        self.masters[cache]=o
        return o

    def place(self,key,position,scale=1.,yaw=0.,triangles=None,label=None):
        master=self.master(key,triangles)
        o=master.copy();bpy.context.collection.objects.link(o)
        o.name=label or ('Keyframe / '+key)
        o.location=position;o.rotation_euler=(0,0,yaw)
        o.scale=(scale,scale,scale) if isinstance(scale,(int,float)) else scale
        o['keyframeAsset']=key
        return o


def material_batch(name,master,points,faces,uvs):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    for mat in master.data.materials:mesh.materials.append(mat)
    if uvs:
        layer=mesh.uv_layers.new(name='Supplied UV')
        layer.data.foreach_set('uv',[v for pair in uvs for v in pair])
    for polygon in mesh.polygons:polygon.use_smooth=True
    obj['keyframeAsset']=master.get('keyframeAsset',master.name)
    return obj


def surface_height(obj,x,y):
    bpy.context.view_layer.update()
    inverse=obj.matrix_world.inverted()
    origin=inverse@Vector((x,y,1000.))
    direction=(inverse.to_3x3()@Vector((0,0,-1))).normalized()
    hit,point,normal,index=obj.ray_cast(origin,direction)
    return (obj.matrix_world@point).z if hit else None


def pavilion_nameboards():
    """Fit restrained timber plaques beneath the supplied pavilion's beams."""
    material=bpy.data.materials.get('pavilion_sign') or bpy.data.materials.new('pavilion_sign')
    material.use_nodes=True;material.use_backface_culling=False;material['ludingFinish']=True
    nodes=material.node_tree.nodes;surface=nodes.get('Principled BSDF')
    image=nodes.new('ShaderNodeTexImage')
    image.image=bpy.data.images.load(str(ROOT/'assets/luding/surfaces/bridge-plaque.jpg'),check_existing=True)
    material.node_tree.links.new(image.outputs['Color'],surface.inputs['Base Color'])
    surface.inputs['Roughness'].default_value=.87
    backing=bpy.data.materials.new('Plaque dark chestnut edge');backing.use_nodes=True;backing['ludingFinish']=True
    bs=backing.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.052,.035,.022,1);bs.inputs['Roughness'].default_value=.91
    for side in (-1,1):
        for end in (-1,1):
            centre=side*54.035;x=centre+end*2.09
            bpy.ops.mesh.primitive_cube_add(size=1,location=(x,0,13.45))
            body=bpy.context.object;body.name='Fitted chestnut plaque backing'
            body.scale=(.16,2.88,.94);body.data.materials.append(backing)
            # Front-face winding and UV orientation remain readable from either bank.
            face=x+end*.083
            verts=[(face,-end*1.38,13.0084),(face,end*1.38,13.0084),
                   (face,end*1.38,13.8916),(face,-end*1.38,13.8916)]
            mesh=bpy.data.meshes.new('Fitted Luding bridge nameboard');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
            o=bpy.data.objects.new('Luding bridge nameboard',mesh);bpy.context.collection.objects.link(o)
            mesh.materials.append(material);uv=mesh.uv_layers.new(name='Plaque face')
            for i,coord in enumerate(((0,0),(1,0),(1,1),(0,1))):uv.data[i].uv=coord


def repeated_deck(assets):
    if not available('kf-beam'):return
    master=assets.master('kf-beam',650);mesh=master.data
    mesh.calc_loop_triangles()
    verts=[v.co.copy() for v in mesh.vertices]
    lo=Vector(tuple(min(p[i] for p in verts) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in verts) for i in range(3)))
    size=hi-lo
    points=[];faces=[];uv=[]
    sourceuv=mesh.uv_layers.active.data
    half=103.67/2;count=325;pitch=103.67/count
    for j in range(count):
        x=-half+(j+.5)*pitch;start=len(points)
        for p in verts:
            xx=x+(p.x-(lo.x+hi.x)/2)/size.x*(pitch-.012)
            yy=(p.y-(lo.y+hi.y)/2)/size.y*3.0
            zz=7.25+2.65*(xx/half)**2+(p.z-lo.z)/size.z*.125-.059
            points.append((xx,yy,zz))
        for tri in mesh.loop_triangles:
            faces.append(tuple(start+i for i in tri.vertices))
            uv.extend(tuple(sourceuv[i].uv) for i in tri.loops)
    o=material_batch('Supplied hewn boards / 325 crosswise planks',master,points,faces,uv)
    o['keyframeAsset']='kf-beam';o['spanMetres']=103.67
    o['boardCount']=325


def repeated_chains(assets):
    if not available('kf-chain-link'):return
    master=assets.master('kf-chain-link');mesh=master.data.copy()
    verts=[v.co.copy() for v in mesh.vertices]
    size=[max(v[i] for v in verts)-min(v[i] for v in verts) for i in range(3)]
    axes=sorted(range(3),key=lambda i:size[i],reverse=True)
    long,short,thin=axes
    centre=Vector(tuple((max(p[i] for p in verts)+min(p[i] for p in verts))/2 for i in range(3)))
    for vertex in mesh.vertices:
        q=vertex.co-centre
        vertex.co=(q[long]/size[long]*.49,q[short]/size[short]*.215,-q[thin]/size[thin]*.052)
    mesh.update()
    mat=mesh.materials[0].copy();mat.name='iron_near';mesh.materials.clear();mesh.materials.append(mat)
    holder=bpy.data.objects.new('Four supplied hand-chains / shared forged links',None)
    bpy.context.collection.objects.link(holder)
    holder['keyframeAsset']='kf-chain-link';holder['handChains']=4
    holder['linkCount']=1200
    half=103.67/2;count=300;step=103.67/count
    for y in (-1.55,1.55):
        for level in (.64,1.25):
            for j in range(count):
                x=-half+(j+.5)*step;slope=2*2.65*x/(half*half)
                along=Vector((1,0,slope)).normalized()
                vertical=Vector((-slope,0,1)).normalized()
                angle=.22+(j%2)*math.pi/2
                across=vertical*math.cos(angle)+Vector((0,1,0))*math.sin(angle)
                normal=along.cross(across).normalized()
                o=bpy.data.objects.new('Forged link',mesh);bpy.context.collection.objects.link(o)
                o.parent=holder;o.location=(x,y,7.25+2.65*(x/half)**2+level)
                basis=Matrix(((along.x,across.x,normal.x),(along.y,across.y,normal.y),(along.z,across.z,normal.z)))
                o.rotation_mode='QUATERNION';o.rotation_quaternion=basis.to_quaternion()


def dress_keyframe(env,ground):
    assets=Assets();rng=random.Random(1935)
    if available('kf-pavilion'):
        for side in (-1,1):
            assets.place('kf-pavilion',(side*54.035,0,9.87),6.5,
                         label=('East' if side>0 else 'West')+' supplied four-post bridge pavilion')
        pavilion_nameboards()
    if available('kf-stone-platform'):
        # The upper terrace stays at the existing walking floor. The stairs
        # face outwards along the bank, never obstructing the 3 m bridge deck.
        for side in (-1,1):
            o=assets.place('kf-stone-platform',(side*60.2,-2.0,7.65),(10.6,12.7,5.855),
                           yaw=math.pi/2 if side>0 else -math.pi/2,label='Supplied stepped stone landing')
            o['terraceTopMetres']=9.9975
    if available('kf-house'):
        for x,y,s in env.contributed_houses:
            assets.place('kf-house',(x,y,env.height(x,y)-.07),s*.85,
                         yaw=0 if x<0 else math.pi,label='Supplied inhabited riverbank house')
    if available('kf-porter'):
        master=assets.master('kf-porter');height=max(v.co.z for v in master.data.vertices)-min(v.co.z for v in master.data.vertices)
        floor=10.
        for o in bpy.context.scene.objects:
            if o.get('keyframeAsset')=='kf-stone-platform':
                value=surface_height(o,57.65,-.55)
                if value is not None:floor=value+.003
        assets.place('kf-porter',(57.65,-.55,floor),1.65/height,yaw=-.95,label='Anonymous supplied mountain porter')
    # Replace the old river stones with two matching schist families. Only
    # rocks near the eye retain the full silhouette budget.
    if available('kf-rock-a') and available('kf-rock-b'):
        obstacles=[]
        for j,(x,y,s) in enumerate([(-21,-23,3.5),(17,-39,4.5),(26,-56,3.3),(9,-68,5.0),(-30,36,3.8),(29,22,3.1)]):
            assets.place('kf-rock-a' if j%2 else 'kf-rock-b',(x,y,-s*.19),(s,s,s*.72),j*.87,triangles=3500)
            obstacles.extend([x,-y,s*.44,s*.40])
        for side in (-1,1):
            for j,y in enumerate((-70,-44,-27,-14,16,28,43,67,86)):
                c,w,_=env.channel(0,y);x=-c+side*(w+rng.uniform(.2,3.2));span=rng.uniform(3.5,7.5)
                assets.place('kf-rock-a' if j%2 else 'kf-rock-b',(x,y,env.height(x,y)-span*.16),
                             (span,span,span*.77),rng.uniform(-.8,.8),triangles=1200)
        assets.place('kf-rock-a',(49,-31,env.height(49,-31)-.45),(5.4,5.4,4.4),-.3,triangles=6000,
                     label='Foreground fractured schist')
        for x,y,s,yaw in [(-85,25,21,.6),(-110,80,28,.35),(104,85,24,-.7)]:
            assets.place('kf-rock-b',(x,y,env.height(x,y)-s*.41),(s,s,s*.60),yaw,triangles=6000,
                         label='Exposed layered schist shoulder')
        ground['riverObstacles']=obstacles
    repeated_deck(assets);repeated_chains(assets)
    ground['keyframeAssets']=[key for key in ('kf-pavilion','kf-stone-platform','kf-house','kf-porter','kf-rock-a','kf-rock-b','kf-beam','kf-chain-link') if available(key)]
    camera=Vector((61,-20,12.6));target=Vector((8,32.8,11.6));delta=camera-target
    ground['keyframeCamera']=[camera.x,camera.z,-camera.y]
    ground['keyframeTarget']=[target.x,target.z,-target.y]
    ground['keyframeView']=[target.x,target.z,-target.y,delta.length,math.atan2(delta.x,-delta.y),math.asin(delta.z/delta.length)]
    ground['keyframeVerticalFov']=math.degrees(2*math.atan(36/(2*22.5)/(1664/944)))
    print('KEYFRAME_ASSETS',list(ground['keyframeAssets']),flush=True)
