"""Regionally placed supplied surfaces, exposed rock and dead wood.

Surface models are upper-envelope dressing over the existing terrain, not
floating display tiles. Rock bases are buried below sampled terrain. Existing
landmarks, boats, buildings and people keep their original local-metre layout.
"""
from pathlib import Path
import json
import math
import random

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/'assets/landscape-props'
VERSION='20261125-geography-1'


def smooth(a,b,x):
    x=min(1,max(0,(x-a)/(b-a)))
    return x*x*(3-2*x)


class Geography:
    def __init__(self,env,ground):
        self.env=env;self.ground=ground;self.masters={};self.cap_materials={};self.used=[];self.placements=[];self.volumes=[]
        self.water=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name in ('jade_water','silt_water','water')]

    def height(self,x,y):
        hit,point,normal,index=self.ground.ray_cast(Vector((x,y,1500)),Vector((0,0,-1)))
        return point.z if hit else self.env.height(x,y)

    def dry(self,x,y):
        if self.env.bank and self.env.bank_distance(x,y)<.30:return False
        for o in self.water:
            inv=o.matrix_world.inverted();origin=inv@Vector((x,y,1500));direction=(inv.to_3x3()@Vector((0,0,-1))).normalized()
            hit,point,normal,index=o.ray_cast(origin,direction)
            if hit and (o.matrix_world@point).z>self.height(x,y)-.02:return False
        return True

    def master(self,key):
        if key not in self.masters:
            bpy.ops.import_scene.gltf(filepath=str(LIB/(key+'.glb')))
            obj,=[o for o in bpy.context.selected_objects if o.type=='MESH']
            world=obj.matrix_world.copy();obj.parent=None;obj.data.transform(world);obj.matrix_world.identity();obj.data.update()
            bpy.context.collection.objects.unlink(obj)
            self.masters[key]=obj
        if key not in self.used:self.used.append(key)
        return self.masters[key]

    def record(self,key,position,kind,**extra):
        self.placements.append({'asset':key,'positionBlender':list(position),'kind':kind,**extra})

    def surface(self,key,x,y,length,width,yaw=0,relief=.045,base=.008,protect_people=True):
        source=self.master(key);mesh=source.data
        mesh.calc_loop_triangles()
        vertices=[v.co for v in mesh.vertices]
        shell=BVHTree.FromPolygons(vertices,[tri.vertices for tri in mesh.loop_triangles],all_triangles=True)
        lo=Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
        hi=Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
        c,s=math.cos(yaw),math.sin(yaw);size=hi-lo
        # These elongated path assets use local Y for their length. The other
        # surfaces keep the same convention so rotations stay explicit.
        def xy(p):
            u=(p.x-(lo.x+hi.x)/2)/size.x*width;v=(p.y-(lo.y+hi.y)/2)/size.y*length
            return x+c*u-s*v,y+s*u+c*v
        uvdata=mesh.uv_layers.active.data;points=[];faces=[];uv=[];colours=[];offsets=[]
        occupied=getattr(self.env.figures,'people',[])
        terrain=self.ground.data
        terrain.calc_loop_triangles()
        centre_x=(lo.x+hi.x)/2;centre_y=(lo.y+hi.y)/2
        def sample(p):
            dx=p.x-x;dy=p.y-y
            u=(c*dx+s*dy)/width*2
            v=(-s*dx+c*dy)/length*2
            if size.x>size.y:
                sx=centre_x+v*size.x/2;sy=centre_y+u*size.y/2
            else:
                sx=centre_x+u*size.x/2;sy=centre_y+v*size.y/2
            location,_,index,_=shell.ray_cast(Vector((sx,sy,hi.z+1)),Vector((0,0,-1)))
            if location is None:return None
            tri=mesh.loop_triangles[index]
            texture_uv=[Vector((*uvdata[i].uv,0)) for i in tri.loops]
            texture_point=barycentric_transform(location,*[vertices[i] for i in tri.vertices],*texture_uv)
            opacity=1-smooth(.67,.97,math.hypot(u,v))
            if protect_people and occupied:
                nearest=min(math.hypot(p.x-a,p.y-b) for a,b,_,_ in occupied)
                opacity*=smooth(.60,1.03,nearest)
            return (texture_point.x,texture_point.y),opacity
        for tri in terrain.loop_triangles:
            if tri.normal.z<.94:continue
            pp=[terrain.vertices[i].co for i in tri.vertices]
            centre=sum(pp,Vector())/3
            dx=centre.x-x;dy=centre.y-y
            if abs(c*dx+s*dy)>width*.58 or abs(-s*dx+c*dy)>length*.58:continue
            if not self.dry(centre.x,centre.y):continue
            samples=[sample(p) for p in pp]
            if any(item is None for item in samples):continue
            start=len(points)
            for p,(tex,alpha) in zip(pp,samples):
                points.append((p.x,p.y,p.z+base))
                offsets.append(base);uv.append(tex);colours.append((1,1,1,alpha))
            faces.append((start,start+1,start+2))
        if not faces:return
        data=bpy.data.meshes.new('Conformed '+key);data.from_pydata(points,[],faces);data.update()
        layer=data.uv_layers.new(name='Supplied top UV')
        layer.data.foreach_set('uv',[v for pair in uv for v in pair])
        colour=data.color_attributes.new(name='LandscapeBlend',type='FLOAT_COLOR',domain='POINT')
        colour.data.foreach_set('color',[v for rgba in colours for v in rgba])
        for original in mesh.materials:
            cache=(key,original.name)
            if cache not in self.cap_materials:
                mat=original.copy();mat.name='Geo blended surface / '+key
                nodes=mat.node_tree.nodes;links=mat.node_tree.links
                bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
                attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='LandscapeBlend'
                if bs.inputs['Base Color'].is_linked:
                    colour_source=bs.inputs['Base Color'].links[0].from_socket
                    mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
                    links.new(colour_source,mix.inputs[6]);links.new(attribute.outputs['Color'],mix.inputs[7]);links.new(mix.outputs[2],bs.inputs['Base Color'])
                links.new(attribute.outputs['Alpha'],bs.inputs['Alpha']);mat.surface_render_method='DITHERED'
                self.cap_materials[cache]=mat
            data.materials.append(self.cap_materials[cache])
        obj=bpy.data.objects.new('Landscape surface / '+key,data);bpy.context.collection.objects.link(obj)
        obj['landscapeAsset']=key;obj['landscapeSurface']=True;obj['sourceAsset']=source.get('sourceAsset','')
        obj['sourceSHA256']=source.get('sourceSHA256','')
        self.record(key,(x,y,self.height(x,y)),'conformed surface',length=length,width=width,faces=len(faces),
                    minSurfaceReliefMetres=min(offsets),maxSurfaceReliefMetres=max(offsets),edgeBlend=True)
        return obj

    def clear_site(self,x,y,rx,ry):
        for a,b,w,d in self.env.houses:
            if abs(x-a)<rx+w*.6+.7 and abs(y-b)<ry+d*.6+.7:return False
        for a,b,_,_ in getattr(self.env.figures,'people',[]):
            if abs(x-a)<rx+.8 and abs(y-b)<ry+.8:return False
        # Keep the main close tableau intact, including its portable furniture.
        tx,ty,_,distance,_,_=self.env.tableau
        if abs(x-tx)<rx+1.7 and abs(y-ty)<ry+1.7:return False
        return self.dry(x,y)

    def volume(self,key,x,y,span,yaw=0,zratio=1.,tree_height=None):
        source=self.master(key);verts=[v.co for v in source.data.vertices]
        lo=Vector(tuple(min(v[i] for v in verts) for i in range(3)))
        hi=Vector(tuple(max(v[i] for v in verts) for i in range(3)));size=hi-lo
        scale=tree_height/size.z if tree_height else span/max(size.x,size.y)
        rx=scale*size.x/2;ry=scale*size.y/2
        # Search nearby land rather than intersect an existing building or person.
        found=False
        offsets=[(0,0),(5,0),(-5,0),(0,6),(7,7),(-7,7),(0,12)]
        if not tree_height:offsets += [(14,8),(-14,8),(0,22),(18,18),(-18,18)]
        for dx,dy in offsets:
            cx,cy=x+dx,y+dy
            if not self.clear_site(cx,cy,max(rx,ry)*.78,max(rx,ry)*.78):continue
            if tree_height:
                if any(abs(cx-a)<max(rx,ry)+r and abs(cy-b)<max(rx,ry)+r for a,b,r in self.volumes):continue
                roots=[self.height(cx+rx*math.cos(a),cy+ry*math.sin(a)) for a in [j*math.tau/8 for j in range(8)]]
                if max(roots)-min(roots)>tree_height*.40:continue
            x=cx;y=cy;found=True;break
        if not found:return None
        sample=[self.height(x+rx*math.cos(a),y+ry*math.sin(a)) for a in [j*math.tau/8 for j in range(8)]]
        height=scale*size.z*zratio
        if tree_height:
            floor=self.height(x,y)-min(.18,tree_height*.055)
        else:
            # The closed model's lower sides remain below every sampled edge.
            floor=min(sample)-height*.22
        obj=source.copy();bpy.context.collection.objects.link(obj)
        obj.name='Landscape exposure / '+key
        obj.location=(x,y,floor);obj.scale=(scale,scale,scale*zratio);obj.rotation_euler=(0,0,yaw)
        if tree_height:
            # Adjust only the lowest root zone to the sampled slope. The trunk
            # and branch silhouette keep the supplied shape and proportions.
            obj.data=source.data.copy();c,s=math.cos(yaw),math.sin(yaw);centre_height=self.height(x,y)
            for vertex in obj.data.vertices:
                t=(vertex.co.z-lo.z)/max(.001,size.z)
                if t>.18:continue
                px=x+scale*(c*vertex.co.x-s*vertex.co.y);py=y+scale*(s*vertex.co.x+c*vertex.co.y)
                vertex.co.z+=(self.height(px,py)-centre_height)/scale*(1-smooth(.04,.18,t))
            obj.data.update()
        obj['landscapeAsset']=key;obj['landscapeSurface']=False
        self.record(key,(x,y,floor),'dead wood' if tree_height else 'buried outcrop',height=height,lowestSurroundingTerrain=min(sample))
        self.volumes.append((x,y,max(rx,ry)))
        return obj


def dress_landscape(env,ground):
    if env.sid=='luding':return
    geo=Geography(env,ground);sid=env.sid;h=geo.height
    tx,ty,tz,_,_,_=env.tableau
    rivers=sid in ('yudu','xiangjiang','chishui','jiaoping','anshun')
    if rivers:
        side={'yudu':-1,'xiangjiang':-1,'chishui':1,'jiaoping':1,'anshun':-1}[sid]
        shore=env.landing_y
        geo.surface('gravel-surface',-4.0,shore+side*3.8,8,7,.15,relief=.045)
        geo.surface('dirt-path',3.1,shore+side*7.0,13,2.6,.14,relief=.018)
        if sid in ('yudu','xiangjiang'):
            geo.volume('dead-tree',-11,shore+side*4.8,2.4,.4,tree_height=1.9)
        if sid=='jiaoping':geo.volume('rock-peak',15,19,13,.35)
        if sid=='anshun':geo.volume('rock-peak',-21,-18,14,-.4)
    elif sid=='jiajin':
        for y in (-8,-1,6):
            x=.3+1.1*math.sin(y*.31)
            geo.surface('snow-path',x,y,6.8,1.3,-.20,relief=.018,base=.028,protect_people=False)
        geo.volume('snow-cliff',7,6,8,.3)
        geo.volume('rock-peak',-11,10,13,-.4)
        geo.volume('pale-dead-tree',8,-7,3.0,.6,tree_height=3.4)
    elif sid=='songpan':
        for x,y,l,w in [(2.4,1.5,6,5),(-3.8,-3.5,5,4),(5.7,7.4,5,4)]:
            geo.surface('grass-terrain',x,y,l,w,.12,relief=.085)
        geo.surface('dirt-path',-2,-6,8,1.4,-.3,relief=.012)
        geo.volume('dead-tree',5.7,.2,2.2,.8,tree_height=1.8)
    elif sid in ('wuqi','huining','jiangtai'):
        geo.surface('cracked-soil',tx+4,ty-1,9,8,.35,relief=.040)
        geo.surface('dirt-path',tx+1,ty-4,12,2.4,.2,relief=.018)
        xy={'wuqi':(-16,12),'huining':(-25,16),'jiangtai':(21,19)}[sid]
        geo.volume('soil-hill',*xy,19,.3,zratio=.76)
        if sid in ('wuqi','jiangtai'):geo.volume('sandstone-peak',xy[0]-14,xy[1]+8,23,-.4,zratio=.65)
        geo.volume('pale-dead-tree',tx+9,ty+2,3.1,.5,tree_height=3.2)
    else:
        geo.surface('dirt-path',tx+3,ty-3,9,2.3,.2,relief=.018)
        geo.surface('grass-terrain',tx+6,ty+2,5,4,-.3,relief=.065)
        if sid=='zunyi':geo.surface('gravel-surface',11,-8,5,4,.3,relief=.035)
        if sid=='lazikou':geo.volume('rock-peak',15,14,10,.6)
        if sid=='dawei':geo.volume('soil-hill',21,18,16,.4,zratio=.70)
        if sid in ('baxi','lianghekou'):geo.volume('pale-dead-tree',tx-8,ty+5,3.2,.2,tree_height=3.0)
    ground['nativeLandscapeVersion']=VERSION
    ground['landscapeAssets']=sorted({p['asset'] for p in geo.placements})
    ground['landscapePlacementsJSON']=json.dumps(geo.placements,separators=(',',':'))
    print('NATIVE_LANDSCAPE',sid,len(geo.placements),list(ground['landscapeAssets']),flush=True)
