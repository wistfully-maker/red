"""Build the inhabited landscapes used by the aerial viewer, using Blender 5.2.
blender -b --python tools/build_valley_scenes.py -- [station ...]
Metres / local illustrative units. Photographic materials are shared at runtime.
"""
import math
import base64
import struct
import json
import random
import sys
import time
from uuid import uuid4
from collections import defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).resolve().parent))
import history_south as south
import history_north as north
from field_people import Figures
from field_dwellings import village_house
import field_waterfronts
import historical_sets
from settlement_geometry import terrain_sets
from working_landscapes import market,ground_details

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/models/landscapes'
MEDIA = ROOT / 'assets/valley'
# Surface, width of the central orthophoto, local river half-width, channel centre,
# initial viewing width, and camera target height. The Dadu crossing is in metres.
SITES = {
    'ruijin': ('town',115,0,0,34,3), 'yudu': ('gan',90,4.65,-.85,33,1),
    'xiangjiang': ('gan',128,5.0,0,52,.7), 'liping': ('town',125,0,0,46,3),
    'zunyi': ('town',140,0,0,47,3), 'chishui': ('gan',118,8,-10,43,2),
    'jiaoping': ('gan',135,8,-8,58,2), 'anshun': ('gan',105,7,6,49,1),
    'luding': ('dadu',455,48,0,205,8), 'jiajin': ('snow',128,0,0,72,6),
    'dawei': ('dadu',110,3.4,0,48,2), 'lianghekou': ('town',170,0,0,56,2),
    'songpan': ('marsh',150,0,0,58,1), 'baxi': ('town',160,0,0,56,2),
    'lazikou': ('dadu',115,3.9,0,44,4), 'hadapu': ('town',160,0,0,54,2),
    'wuqi': ('loess',155,0,0,55,2), 'huining': ('loess',170,0,0,60,4),
    'jiangtai': ('loess',175,0,0,62,4),
}
SITE_PLATES={'xiangjiang','chishui','jiaoping','anshun','ruijin','liping','zunyi','hadapu','baxi','huining','jiangtai','dawei'}
SCALE_STUDY=json.loads((ROOT/'tools/field-scale.json').read_text(encoding='utf8'))
RIVER_STUDIES=SCALE_STUDY['rivers']

def smooth(a,b,t):
    t=min(1,max(0,(t-a)/(b-a)))
    return t*t*(3-2*t)

def n2(x,y):
    return noise.noise_vector(Vector((x,y,.43)), noise_basis='PERLIN_ORIGINAL').x

def material(name):
    mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color=(.6,.61,.54,1)
    return mat

def geometry(name,vs,faces,mat,uv=None,smooth_faces=False):
    if not faces:return
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vs,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material(mat))
    if uv is not None:
        layer=mesh.uv_layers.new(name='SurveyUV')
        indices=np.empty(len(mesh.loops),dtype=np.int32)
        mesh.loops.foreach_get('vertex_index',indices)
        layer.data.foreach_set('uv',np.asarray(uv,dtype=np.float32)[indices].ravel())
    if smooth_faces:
        mesh.polygons.foreach_set('use_smooth',np.ones(len(faces),dtype=bool))
    return obj

class RegionalGeometry(north.Geo):
    role=None

    def mesh(self,vs,faces,mat=north.PAPER):
        if self.role=='roof':mat='tile' if mat==north.TIMBER else 'tilerib'
        if self.role=='paving':mat='paving'
        if self.role=='person':mat={north.PAPER:'skin',north.TIMBER:'cotton',north.DARK:'uniform',north.SHALE:'cloth'}.get(mat,mat)
        super().mesh(vs,faces,mat)

def regional_detail(function,role):
    def emit(*args,**kwargs):
        old=north.G.role
        north.G.role=role
        try:return function(*args,**kwargs)
        finally:north.G.role=old
    return emit

north.roof=regional_detail(north.roof,'roof')
north.person=regional_detail(north.person,'person')
north.courtyard_paving=regional_detail(north.courtyard_paving,'paving')

class Landscape:
    def __init__(self,sid):
        self.sid=sid
        self.family,self.span,self.bank,self.mid,self.shot,self.target=SITES[sid]
        if sid in RIVER_STUDIES:
            reach=RIVER_STUDIES[sid]
            self.span=reach['plate'];self.bank=reach['waterWidth']/2
            self.mid=-reach['side']*self.bank;self.shot=reach['entry']
        self.plate=sid if sid in SITE_PLATES else self.family
        self.plate_info=json.loads((MEDIA/'features.json').read_text()).get(self.plate,{})
        self.seed=sum((i+1)*ord(ch) for i,ch in enumerate(sid))
        if sid=='luding':
            # The outer reach is a separate, wider aerial plate. Its surveyed
            # centreline drives the continuous gorge beyond the bridgeheads.
            self.plate='dadu-wide'
            self.span=2250
            bend=[(512,-4),(474,25),(444,42),(409,51),(379,67),(357,87),(326,94),(289,96),(253,95),(223,89),(188,85),(157,84),(125,95),(104,113),(99,129),(106,149),(127,162),(156,171),(182,171),(212,179),(238,192),(253,208),(259,231),(258,261),(259,285),(262,309),(275,331),(292,350),(320,357),(356,357),(393,360),(414,370),(427,390),(430,411),(421,433),(401,449),(372,461),(346,480),(316,500),(286,515),(250,514),(217,498),(190,488),(161,477),(132,468),(99,467),(78,473),(59,482),(37,495),(19,509),(9,525)]
            yy,xx=np.mgrid[0:521,0:521]
            dist=np.full(xx.shape,1.e6)
            for (ax,ay),(bx,by) in zip(bend,bend[1:]):
                dx=bx-ax;dy=by-ay
                t=np.clip(((xx-ax)*dx+(yy-ay)*dy)/(dx*dx+dy*dy),0,1)
                dist=np.minimum(dist,np.hypot(xx-ax-t*dx,yy-ay-t*dy))
            self.valley_distance=dist
        self.rng=random.Random(self.seed)
        self.figures=Figures(self)
        self.local=None
        self.trees=[]
        self.houses=[]
        self.rotation=0 if self.bank else (self.seed%9-4)*.085
        self.base=.24 if sid in south.BUILDERS else .05
        self.focus_radius=12 if sid in south.BUILDERS else 18
        pic=bpy.data.images.load(str(MEDIA/(self.plate+'.webp')),check_existing=False)
        pic.scale(256,256)
        data=np.empty(256*256*4,dtype=np.float32)
        pic.pixels.foreach_get(data)
        self.image=data.reshape(256,256,4)[:,:,:3]
        bpy.data.images.remove(pic)

    def channel(self,x,y):
        vertical=self.family=='dadu'
        along=y if vertical else x
        cross=x if vertical else y
        # Walk out from the bridge on a bending reach. At the crossing, banks
        # meet the two surveyed bridgeheads; bends increase towards the horizon.
        bend=.048*self.span*(math.sin(along/self.span*5+.4)-math.sin(.4))
        width=self.bank*(1+.12*math.sin(8*along/self.span))
        return cross-self.mid-bend,width,along

    def uv(self,x,y):
        size=self.span
        if self.sid=='luding':return (.496+x/size,.5+y/size)
        if self.bank:
            cross,width,along=self.channel(x,y)
            # Register each reach to the two shorelines on its photographic plate.
            a=.5+along/size
            if self.family=='dadu':
                lc=np.interp(a,[0,.25,.5,.75,1],[.353,.38,.374,.395,.403])
                rc=np.interp(a,[0,.25,.5,.75,1],[.53,.573,.593,.566,.565])
            else:
                lc=np.interp(a,[0,.25,.5,.75,1],[.42,.438,.40,.442,.408])
                rc=np.interp(a,[0,.25,.5,.75,1],[.547,.558,.574,.584,.544])
            if 'banks' in self.plate_info:
                lc,rc=[np.interp(a,self.plate_info['fractions'],values) for values in self.plate_info['banks']]
            u=(lc+rc)/2+cross*(rc-lc)/(2*width) if abs(cross)<width else (
                lc+(cross+width)/size if cross<0 else rc+(cross-width)/size)
            return (u,a) if self.family=='dadu' else (a,u)
        c,s=math.cos(self.rotation),math.sin(self.rotation)
        return (.5+(x*c-y*s)/size,.5+(y*c+x*s)/size)

    def rgb(self,u,v):
        mirror=lambda a: 1-abs(a%2-1)
        return self.image[min(255,int(mirror(v)*255)),min(255,int(mirror(u)*255))]

    def bank_distance(self,x,y):
        across,width,_=self.channel(x,y)
        close=abs(across)-width
        if self.sid!='luding':return close
        u,v=self.uv(x,y)
        fx=abs((u+1)%2-1)*519.999;fy=(1-abs((v+1)%2-1))*519.999
        ix=int(fx);iy=int(fy);ax=fx-ix;ay=fy-iy
        grid=self.valley_distance
        d=(1-ay)*((1-ax)*grid[iy,ix]+ax*grid[iy,ix+1])+ay*((1-ax)*grid[iy+1,ix]+ax*grid[iy+1,ix+1])
        blend=smooth(70,135,math.hypot(x,y))
        return close*(1-blend)+(d-10.4)*self.span/520*blend

    def height(self,x,y):
        span=self.span
        radius=math.hypot(x,y)
        hills=n2(x/span*4+self.seed*.012,y/span*4)*.52+n2(x/span*10,y/span*10)*.18
        if self.sid=='luding':
            dist=self.bank_distance(x,y)
            lift=max(0,dist)
            carved=11*n2(x*.009,y*.011)+5*n2(x*.039,y*.032)+1.8*n2(x*.09,y*.08)
            escarpment=smooth(18,120,dist)*(.76+.46*n2(x*.0023,y*.004))*17
            height=.23+lift*(.22+hills*.29)+escarpment+smooth(4,72,dist)*carved
            if radius<110:
                detail=.23+lift*.42
                t=smooth(68,110,radius);height=height*t+detail*(1-t)
            outer=smooth(100,320,radius)
            ridge=.23+lift*(.19+.10*hills)+(1-math.exp(-lift/135))*(32+35*n2(x*.0026,y*.002))
            height=height*(1-outer)+ridge*outer
            # Steep, overlapping shoulders belong to a mountain river, while
            # the walking landings and the existing town shelf stay level.
            mountain=smooth(62,350,lift)*smooth(118,265,radius)
            folds=.76+.24*math.sin(y*.0047+x*.0016)+.12*n2(x*.004,y*.003)
            height+=mountain*(105*folds+48*smooth(320,1000,lift))
            # Taller, receding valley walls behind the occupied bridge reach.
            # The bank mask keeps the actual river and its bend open.
            height+=smooth(16,140,lift)*smooth(140,280,radius)*(70+32*math.sin(y*.013+x*.0027))
            street=68+8*math.sin(y*.018)+.045*y
            shelf=(1-smooth(7,17,abs(abs(x)-street)))*(1-smooth(47,85,abs(y)))
            height=height*(1-shelf)+(8.18+.016*y)*shelf
        elif self.bank:
            across,width,along=self.channel(x,y)
            dist=abs(across)-width
            if dist<0:return .23-.14*smooth(0,width*.45,-dist)
            shore=3.5 if self.sid=='luding' else .6
            height=.23+shore*(1-math.exp(-dist/(span*.018)))
            grade=.32 if self.family=='dadu' else .08
            height+=max(0,dist-span*.035)*grade*(1+hills)
            height+=span*smooth(.025,.28,dist/span)*(.045+hills*.15)
            if self.sid=='lazikou':
                shoulder=dist-(.55+.28*math.sin(y*.34))
                height+=smooth(0,5.3,shoulder)*(7+1.1*math.sin(y*.31)+2*n2(x*.22,y*.21))
                height+=smooth(0,2,shoulder)*(.5*n2(x*.63,y*.56))
                height+=1.6*(1-smooth(0,8,abs(y)))*smooth(-.15,.9,dist)
            if self.sid=='jiaoping':
                height+=smooth(1.6,6.1,y)*(4+1.8*n2(x*.25,y*.26))
        else:
            slope=.10 if self.family=='town' else .17
            height=self.base+smooth(.08,.4,radius/span)*span*(.10+hills)*slope*4
            if self.family=='marsh':height=self.base+span*.007*hills
            elif self.family=='snow':
                ridge=6.2*math.exp(-((x-1.8*math.sin(y*.11))/6)**2)
                height=2+ridge+2.3*math.sin(y*.12)+smooth(8,26,abs(x))*(2.2+3.5*hills)
        if self.plate_info.get('roofs'):
            # The occupied basin has a gentle continuous grade. Keep the large
            # mountain relief outside the street blocks and their foundations.
            edge=max(abs(x),abs(y))/span
            outer=smooth(.47,.78,edge)
            terrace=self.base+.018*y+.46*math.sin(x/span*5)*math.sin(y/span*4)
            height=(1-outer)*terrace+outer*height
        if self.local:
            w,d,fn=self.local
            factor=1-smooth(.82,1.33,max(abs(x)/(w*.5),abs(y)/(d*.5)))
            if factor>0:
                local=fn(max(-w*.5,min(w*.5,x)),max(-d*.5,min(d*.5,y)))
                height=height*(1-factor)+local*factor
        elif self.sid in ['ruijin','zunyi','liping','baxi']:
            t=smooth(self.focus_radius,self.focus_radius*1.7,radius)
            height=self.base*(1-t)+height*t
        if self.sid=='ruijin':
            crown=(1-smooth(4.5,9.5,abs(x)))*(1-smooth(4.2,9.2,abs(y-.7)))
            height+=crown*(1.8+1.34*smooth(-5,-2,y)+.20*n2(x*.45,y*.40))
        if self.sid=='liping':
            height+=3*smooth(-7,6,y)*(1-smooth(6,16,abs(x)))*(1-smooth(6,16,y))
        if self.sid=='luding':
            # A pair of level masonry landings cut into the hillside.
            for side in [-1,1]:
                t=(1-smooth(2.8,12,abs(x-side*53.5)))*(1-smooth(3,13,abs(y)))
                height=height*(1-t)+8.0*t
        return height

    def terrain(self):
        # Dense grid on the principal reach, increasingly spaced beyond it.
        grid=np.r_[np.linspace(-1.85,-.55,32,endpoint=False),
                   np.linspace(-.55,.55,171,endpoint=False),np.linspace(.55,1.85,33)]*self.span
        if self.sid=='luding':
            positive=np.r_[np.linspace(0,132,76),np.linspace(137,330,34),np.linspace(340,1150,60),np.linspace(1177,2450,34)]
            grid=np.r_[-positive[:0:-1],positive]
        elif self.sid in RIVER_STUDIES:grid=np.unique(np.r_[grid,np.linspace(-43,43,78)])
        vs=[];uv=[];faces=[];pigments=[];n=len(grid)
        for j,y in enumerate(grid):
            for i,x in enumerate(grid):
                z=self.height(x,y);vs.append((x,y,z))
                color,wet=self.ground_pigment(x,y,z)
                uv.append((wet,.5));pigments.append((*color,1))
                if i and j:
                    k=j*n+i;faces.append((k-n-1,k-n,k,k-1))
        if self.bank or self.family=='marsh':
            # Clip cells precisely at the channel boundary instead of accepting
            # or rejecting whole quads, which leaves a stair-step shore.
            signed=[self.bank_distance(x,y) for x,y,_ in vs] if self.bank else [.5-u for u,_ in uv]
            water=[];wf=[];lookup={}
            def wet_vertex(i,j=None):
                key=i if j is None else tuple(sorted((i,j)))
                if key in lookup:return lookup[key]
                x,y,z=vs[i]
                if j is not None:
                    t=signed[i]/(signed[i]-signed[j]);xx,yy,zz=vs[j]
                    x+=(xx-x)*t;y+=(yy-y)*t;z+=(zz-z)*t
                index=len(water);lookup[key]=index
                wz=.24 if self.bank else z+.017
                if self.sid=='luding':
                    envelope=smooth(.1,3,-self.bank_distance(x,y))
                    wz+=envelope*(.075*n2(x*.18,y*.26)+.032*math.sin(y*.54+x*.41+2.8*n2(x*.03,y*.08)))
                water.append((x,y,wz))
                return index
            for face in faces:
                if all(signed[i]>0 for i in face):continue
                loop=[]
                for ii,i in enumerate(face):
                    j=face[(ii+1)%4]
                    if signed[i]<=0:loop.append(wet_vertex(i))
                    if (signed[i]<=0)!=(signed[j]<=0):loop.append(wet_vertex(i,j))
                if len(loop)>2:wf.append(tuple(loop))
            geometry('River surface' if self.bank else 'Marsh pools',water,wf,
                     'silt_water' if self.sid in ['chishui','xiangjiang'] else 'jade_water',
                     [self.uv(x,y) for x,y,_ in water],smooth_faces=True)
            for i,value in enumerate(signed):
                if value<0:
                    x,y,z=vs[i];vs[i]=(x,y,z-.17*uv[i][0])
        obj=geometry('Continuous terrain',vs,faces,'ground_'+self.family+'__'+self.plate,uv,True)
        # The hydrology mask and registered photographic plate have separate
        # coordinate channels. Neither channel is interpolated from vertex RGB.
        aerial=obj.data.uv_layers.new(name='Aerial registration')
        loop_ids=np.empty(len(obj.data.loops),dtype=np.int32)
        obj.data.loops.foreach_get('vertex_index',loop_ids)
        survey=np.asarray([self.uv(x,y) for x,y,_ in vs],dtype=np.float32)
        aerial.data.foreach_set('uv',survey[loop_ids].ravel())
        obj.data.uv_layers.active_index=0
        attr=obj.data.color_attributes.new(name='Ground pigment',type='BYTE_COLOR',domain='POINT')
        attr.data.foreach_set('color',np.array(pigments,dtype=np.float32).ravel())
        surface=obj.data.materials[0];surface.use_nodes=True
        rgb=surface.node_tree.nodes.new('ShaderNodeVertexColor');rgb.layer_name=attr.name
        surface.node_tree.links.new(rgb.outputs['Color'],surface.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        return obj

    def ground_pigment(self,x,y,z):
        span=self.span;broad=n2(x/span*7.5+.4,y/span*8.1-.3);grit=n2(x*.38,y*.35)
        radius=math.hypot(x,y);wet=0
        if self.bank:
            dist=self.bank_distance(x,y)
            wet=1-smooth(-.7,.55,dist)
            beach=(.0075+max(-.002,.007*broad))*span
            shore=smooth(.55,max(3.2,beach),dist)
            grass=(.105,.148,.057) if self.family=='dadu' else (.174,.195,.084)
            dry=tuple(a*(1-shore)+b*shore for a,b in zip((.36,.325,.237),grass))
            flow=(.065,.174,.151) if self.sid not in ('chishui','xiangjiang') else (.183,.16,.086)
            color=tuple(a*(1-wet)+b*wet for a,b in zip(dry,flow))
        elif self.family=='snow':
            t=smooth(.22,.66,broad+.12*grit+z/span*.68)
            color=tuple(a*(1-t)+b*t for a,b in zip((.84,.87,.86),(.15,.164,.16)))
        elif self.family=='marsh':
            wet=smooth(.12,.40,broad+.36*n2(x*.11,y*.15))*(.4+.6*smooth(1,4,abs(x-.22*y)))
            color=tuple(a*(1-wet)+b*wet for a,b in zip((.27,.26,.105),(.051,.095,.077)))
        else:
            t=smooth(.06,.46,broad+.11*grit)*smooth(7,20,radius)
            earth=(.395,.263,.143) if self.family=='loess' else (.351,.301,.218)
            green=(.20,.21,.093) if self.family=='loess' else (.117,.164,.076)
            color=tuple(a*(1-t)+b*t for a,b in zip(earth,green))
        return tuple(min(1,max(.001,v*(.96+.17*broad+.043*grit))) for v in color),wet

    def town_blocks(self):
        """Raise the traced dwellings around each court, keeping its entrance clear."""
        verts=[]; texcoords=[]; faces=[]
        c=math.cos(self.rotation);s=math.sin(self.rotation)
        for corners in self.plate_info.get('roofs',[]):
            xy=[]
            for u,v in corners:
                a,b=(u-.5)*self.span,(v-.5)*self.span
                xy.append(np.array((a*c+b*s,-a*s+b*c)))
            centre=sum(xy)/4
            if np.max(np.abs(centre))<self.focus_radius*.84:continue
            direction=xy[1]-xy[0]
            length=float(np.linalg.norm(direction))
            width=float(np.linalg.norm(xy[3]-xy[0]))
            if length<1.8 or width<1.0:continue
            tangent=direction/length
            outward=np.array((-tangent[1],tangent[0]))
            # The long facade facing the lane carries the openings and eave posts.
            if np.dot(outward,centre)>0:outward=-outward
            def place(along,across,z):
                x,y=centre+along*tangent+across*outward
                return (x,y,z)
            floor=[self.height(x,y)-.12 for x,y in xy]
            sill=max(floor)+.16
            flat=self.sid=='baxi'
            top=sill+min(4.2,max(2.15,width*.67))
            def strip(lower,upper,mat):
                south.mesh(lower+upper,[(j,(j+1)%4,4+(j+1)%4,4+j) for j in range(4)],mat)
            strip([(x,y,z) for (x,y),z in zip(xy,floor)],[(x,y,sill) for x,y in xy],'stone')
            strip([(x,y,sill) for x,y in xy],[(x,y,top) for x,y in xy],
                  'earth' if self.sid in ('baxi','huining') else 'plaster')
            start=len(verts)
            bottom=[centre+(p-centre)*(1.02 if flat else 1.065) for p in xy]
            pts=[(x,y,top) for x,y in bottom]
            local_faces=[(0,1,2,3)]
            if not flat:
                ends=[(xy[0]+xy[3])/2,(xy[1]+xy[2])/2]
                ridge=[(x,y,top+width*.29) for x,y in ends]
                pts+=ridge
                south.beam(*ridge,.075,'tilerib',7)
                local_faces=[(0,1,5,4),(2,3,4,5),(3,0,4),(1,2,5)]
            for j in range(4):
                south.beam(pts[j],pts[(j+1)%4],.09,'timber',6)
            verts.extend(pts)
            texcoords.extend(self.uv(x,y) for x,y,z in pts)
            faces.extend(tuple(start+i for i in face) for face in local_faces)
            facade=width*.5+.04
            bays=max(2,min(6,round(length/2.5)))
            for bay in range(bays):
                offset=length*((bay+.5)/bays-.5)
                door=bay==bays//2
                half=min(.51,.28*length/bays)
                low=sill if door else sill+.94
                high=min(top-.24,sill+(1.95 if door else 1.66))
                opening=[place(offset-half,facade,low),place(offset+half,facade,low),
                         place(offset+half,facade,high),place(offset-half,facade,high)]
                south.mesh(opening,[(0,1,2,3)],'recess')
                for side in [-1,1]:
                    x=offset+half*side
                    south.beam(place(x,facade+.035,low),place(x,facade+.035,high),.044,'wood',5)
                south.beam(place(offset-half-.08,facade+.025,high),place(offset+half+.08,facade+.025,high),.061,'timber',6)
                if not door:
                    south.beam(place(offset,facade+.055,low),place(offset,facade+.055,high),.034,'timber',5)
            self.houses.append((*centre,length,width))
        geometry('Outlying courtyard roofs',verts,faces,'tile')

    def plant(self,x,y,z,h=4,spread=3):
        self.trees.append((x,y,z,h,spread))

    def populate(self):
        rng=self.rng;span=self.span
        if self.family not in ['snow','marsh']:
            for i in range(124000 if self.sid=='luding' else 12500):
                limit=.52 if self.sid=='luding' else .66
                x=rng.uniform(-limit,limit)*span;y=rng.uniform(-limit,limit)*span
                if abs(x)<self.focus_radius and abs(y)<self.focus_radius:continue
                if self.sid=='luding':
                    u,v=self.uv(x,y)
                    if self.valley_distance[int((1-abs((v+1)%2-1))*520),int(abs((u+1)%2-1)*520)]<14:continue
                elif self.bank:
                    cross,width,_=self.channel(x,y)
                    if abs(cross)<width+span*.035:continue
                r,g,b=self.rgb(*self.uv(x,y))
                # Use the forest on the plate as a planting mask. Open fields,
                # scree, river beds and paths retain their exposed ground texture.
                if self.sid=='luding':
                    if self.bank_distance(x,y)<5.4:continue
                    if (g<r*.76 or b>g*.95) and rng.random()>.18:continue
                elif g<r*.9 or b>g*.83 or g>.28:continue
                if self.family=='loess' and rng.random()>.06:continue
                if any(abs(x-a)<w*.78 and abs(y-b)<d*.90 for a,b,w,d in self.houses):continue
                h=rng.uniform(14,26) if self.sid=='luding' else rng.uniform(.008,.026)*min(780,span)
                self.plant(x,y,self.height(x,y)-h*.05,h,h*rng.uniform(.77,1.18))
        # Ship placements, not a flattened picture of a tree. Eight independent
        # Blender master silhouettes are shared by the entire website.
        packed=bytearray()
        for x,y,z,h,w in self.trees:
            if self.sid in ('jiajin','songpan'):continue
            if self.sid in ('dawei','lianghekou','baxi','lazikou'):
                species=2 if rng.random()<.72 else 0
            elif self.bank:
                species=rng.choices([0,1,2,3],[48,29,7,16])[0]
            else:species=rng.choices([0,1,2,3],[63,11,12,14])[0]
            quant=lambda v:max(-32767,min(32767,round(v/self.span*16384)))
            packed.extend(struct.pack('<hhhHHBB',quant(x),quant(z),quant(-y),round(h*100),round(w*100),species*2+rng.randrange(2),rng.randrange(256)))
        return base64.b64encode(packed).decode('ascii')

def native_luding(env):
    from luding_keyframe import available
    # The long, thin 103.67 m span reads from the air like an actual footbridge.
    length=103.67;half=length/2; deck=lambda x:9.9-2.65*(1-(x/half)**2)
    for side in (-1,1):
        x=side*(half+2.2)
        south.masonry(x,0,.05,5.3,7.2,9.85,1.1)
        if available('kf-pavilion'):continue
        for dx in [-1.8,0,1.8]:
            for y in [-2.6,2.6]:
                south.beam((x+dx,y,9.8),(x+dx,y,10.20),.34,'dressed_stone',12)
                south.beam((x+dx,y,10.14),(x+dx,y,13.75),.19,'chestnut',12)
                south.box((x+dx,y,13.42),(.67,.48,.18),'chestnut')
                for sign in [-1,1]:
                    south.beam((x+dx,y,12.95),(x+dx,y+sign*.54,13.55),.09,'chestnut',6)
        for y in [-2.6,0,2.6]:south.box((x,y,13.65),(4.6,.36,.35),'timber')
        for dx in [-1.83,1.83]:south.box((x+dx,0,13.65),(.32,6.74,.30),'chestnut')
        south.roof(x,0,13.6,6.5,8.7,2.3,True)
        # Hanging name boards, end brackets and curved ridge terminals frame the passage.
        for end in [-1,1]:
            px=x+end*2.25
            south.box((px,0,13.17),(.19,3.12,.98),'tarred')
            south.box((px,0,13.67),(.28,3.35,.11),'chestnut')
            south.box((px,0,12.65),(.26,3.22,.09),'chestnut')
            face=px+end*.103
            points=[(face,-end*1.52,12.72),(face,end*1.52,12.72),(face,end*1.52,13.61),(face,-end*1.52,13.61)]
            geometry('Bridge name panel',points,[(0,1,2,3)],'pavilion_sign',[(0,0),(1,0),(1,1),(0,1)])
            for sign in [-1,1]:
                south.line([(x+end*(2.25+t*.96),sign*(3.02+t*.98),13.98-.48*t+.88*t**3) for t in np.linspace(0,1,12)],.085,'tilerib',9)
                south.beam((px-end*.56,sign*2.59,12.65),(px+end*.53,sign*2.59,13.54),.105,'chestnut',8)
        for dx in np.linspace(-2.85,2.85,21):
            for end in [-1,1]:
                south.beam((x+dx,end*2.8,14.10),(x+dx,end*4.21,13.59),.070,'timber',6)
        place_local(x+side*5.35,0,side*math.pi/2,'cut_stone_approach',
                    lambda:south.stairs(0,0,8,3.3,9,.32,.21))
    # A modelled landing beyond the east abutment allows the visitor to turn back.
    if not available('kf-stone-platform'):
        south.masonry(60.9,-2.55,7.6,10.6,12.7,2.33,1.15)
    for j in range(8):
        for k in range(6):
            if available('kf-stone-platform'):continue
            if j==4 and k==3:continue
            south.box((56.29+j*1.32,-7.78+k*2.09,9.955),(1.30,2.07,.085),'dressed_stone')
    # Individual hewn planks have a dressed top lip, a narrow gap and irregular end grain.
    boards=[];board_faces=[];board_uv=[]
    for j in range(325):
        x=-half+(j+.5)*length/325
        width=length/325-.011-.003*math.sin(j*1.71)
        left=-1.50+.032*math.sin(j*4.1);right=1.50+.028*math.sin(j*2.9)
        y0=(j*.618034)%1; x0=(j*.414214)%1
        corners=[(-width/2,left),(width/2,left+.009*math.cos(j)),(width/2,right),(-width/2,right+.013*math.sin(j))]
        start=len(boards)
        for inset,level in [(0,-.069),(0,.055),(.010,.066)]:
            for dx,dy in corners:
                px=x+dx-math.copysign(inset,dx);py=dy-math.copysign(inset,dy)
                boards.append((px,py,deck(px)+level+.004*math.sin(j*2.27)))
                board_uv.append((x0+py/2.1,y0+dx/.94+level*.04))
        for k in range(4):
            n=(k+1)%4
            for row in [0,4]:
                board_faces.append(tuple(start+i+row for i in (k,n,n+4,k+4)))
        board_faces.append(tuple(start+8+i for i in range(4)))
        board_faces.append(tuple(start+i for i in (3,2,1,0)))
    if not available('kf-beam'):
        geometry('Hewn transversal deck boards',boards,board_faces,'bridge_plank',board_uv)
    for y,offset in [(i*.31-1.24,-.14) for i in range(9)]:
        south.line([(x,y,deck(x)+offset) for x in np.linspace(-half,half,100)],.066,'iron',6)
    # Preserve four fine rail silhouettes in the aerial LOD. The near LOD
    # contains individually interlocking oval iron links, on alternating planes.
    for y in [-1.55,1.55]:
        for h in [.64,1.25]:
            south.line([(x,y,deck(x)+h) for x in np.linspace(-half,half,100)],.050,'iron_far',6)
    if not available('kf-chain-link'):bridge_links(length,deck)
    for x in np.linspace(-half,half,65):
        for y in [-1.51,1.51]:south.beam((x,y,deck(x)),(x,y,deck(x)+1.24),.031,'iron',5)
    for x,side,yaw in [(-32,.85,1.47),(-27,.76,1.62),(18,.9,-1.52),(30,.86,-1.64)]:
        env.figures.build(x,side,deck(x)+.08,env.rng.uniform(1.56,1.75),yaw,'walk','walker')
    for side, count in [(-1,16),(1,8)]:
        street=[]
        for i in range(count):
            y=(i-count*.48)*9.1
            x=side*(68+8*math.sin(y*.018)+.045*y)
            street.append((x,y))
            bx=x+side*(5.2+env.rng.uniform(-1.3,1.7))*(1 if i%4 else -1)
            if abs(bx+60)<8.0 and abs(y-4.5)<7:continue
            w,d,h=env.rng.uniform(5.0,8.3),env.rng.uniform(4.1,7.4),env.rng.uniform(2.6,4.2)
            if side==1 and abs(y)<9:
                # The inner street bay used to intersect the stone landing
                # and put a clipped porch through the pavilion camera.
                bx=max(bx,78.0)
            if (side,i) in {(-1,4),(-1,10),(1,3),(1,6)}:
                scale=w*1.45
                env.contributed_houses=getattr(env,'contributed_houses',[])+[(bx,y,scale)]
                env.houses.append((bx,y,.75*scale,scale))
            else:add_cottage(env,bx,y,w,d,h)
        trail(env,street,2.1)
    for side in [-1,1]:
        for y in [-16,-9,8,17]:env.plant(side*64,y,env.height(side*64,y),4.8,4.4)
        for i in range(180):
            y=env.rng.uniform(-73,73)
            dx,width,_=env.channel(0,y)
            x=-dx+side*(width+env.rng.uniform(-2.4,8.3))
            if abs(y)<4.3 and abs(x-side*(half+2.2))<3.1:continue
            r=env.rng.uniform(.11,.65)
            south.rock((x,y,env.height(x,y)+r*.08),(r*1.4,r,r*.76),'rock')
    gorge_ledges(env)

def gorge_ledges(env):
    """Exposed beds follow the modelled waterline and dip beneath the beach."""
    rng=random.Random(5327)
    for side in [-1,1]:
        y=-184.
        while y<182:
            y+=rng.uniform(2.6,9.4)
            if abs(y)<11 or rng.random()<.15:continue
            # Locate this shore on the actual bending channel.
            xs=np.arange(0,222,2.)*side
            crossing=next((i for i in range(1,len(xs)) if env.bank_distance(xs[i-1],y)<0<=env.bank_distance(xs[i],y)),None)
            if crossing is None:continue
            shore=xs[crossing]
            length=rng.uniform(3.2,10.5);depth=rng.uniform(2.7,6.8)
            rise=rng.uniform(.55,2.05)
            vertices=[]
            for u,v in [(-.46,-.38),(-.14,-.57),(.41,-.49),(.54,-.09),(.42,.38),(.09,.53),(-.46,.41),(-.55,.08)]:
                px=shore+side*(depth*.21+u*depth)
                py=y+v*length+u*length*.30
                top=max(.35,env.height(px,py))+rise*(.78+.28*u)+rng.uniform(-.13,.13)
                vertices.append((px,py,top))
            for base,top,mat,inset in [(-1.2,-.33,'wet_schist',0),(-.33,-.21,'schist_seam',.06),(-.21,.0,'gorge_schist',.12)]:
                ring=[(x+(shore-x)*inset,yy+(y-yy)*inset,min(env.height(x,yy)-.55,z+base) if base< -1 else z+base) for x,yy,z in vertices]
                cap=[(x+(shore-x)*(inset+.05),yy+(y-yy)*(inset+.05),z+top) for x,yy,z in vertices]
                faces=[(i,(i+1)%8,(i+1)%8+8,8+i) for i in range(8)]
                if top==0:
                    cap.append((shore+side*depth*.25,y+.15*length,sum(p[2] for p in cap)/8+rise*.27))
                    faces.extend((i+8,(i+1)%8+8,16) for i in range(8))
                south.mesh(ring+cap,faces,mat)
            for j in range(rng.randrange(8,24)):
                px=shore+side*rng.uniform(-2.6,6.5);py=y+rng.gauss(0,length*.58)
                size=rng.uniform(.10,.64)
                south.rock((px,py,env.height(px,py)-size*.08),(size*1.7,size*1.03,size*.57),'wet_schist')

def bridge_links(length,deck):
    count=360
    step=length/count
    verts=[];faces=[]
    for y in [-1.55,1.55]:
        for level in [.64,1.25]:
            for i in range(count):
                x=-length/2+(i+.5)*step
                # Unit tangent of the catenary approximation and its perpendicular.
                slope=2*2.65*x/(length/2)**2
                tangent=Vector((1,0,slope)).normalized()
                vertical=Vector((-slope,0,1)).normalized()
                angle=.28+(i%2)*math.pi/2
                across=vertical*math.cos(angle)+Vector((0,1,0))*math.sin(angle)
                face=tangent.cross(across).normalized()
                centre=Vector((x,y,deck(x)+level))
                start=len(verts)
                for j in range(12):
                    t=j*math.tau/12
                    ring=centre+tangent*(.194*math.cos(t))+across*(.084*math.sin(t))
                    outward=(tangent*(.084*math.cos(t))+across*(.194*math.sin(t))).normalized()
                    for k in range(5):
                        phi=k*math.tau/5
                        verts.append(tuple(ring+.027*(outward*math.cos(phi)+face*math.sin(phi))))
                for j in range(12):
                    for k in range(5):
                        a=start+j*5;b=start+((j+1)%12)*5;next_k=(k+1)%5
                        faces.append((a+k,b+k,b+next_k,a+next_k))
    geometry('Interlocking handrail links',verts,faces,'iron_near',smooth_faces=True)

def add_cottage(env,x,y,w,d,h):
    village_house(env,x,y,w,d,h,place_local)

def place_local(x,y,angle,label,build):
    """Place one timber frame in its own axes, retaining the material batches."""
    previous,section=south.B,south.PART
    south.B={}
    try:
        build()
        batches=south.B
    finally:
        south.B=previous
    c,s=math.cos(angle),math.sin(angle)
    south.part(label)
    for (_,mat),(verts,faces) in batches.items():
        south.mesh([(x+a*c-b*s,y+a*s+b*c,z) for a,b,z in verts],faces,mat)
    south.part(section)

def zunyi_compound(env):
    # Interpret the documented L-shaped main house, timber cross-court, eight
    # street bays and brick passage. The later commemorative plaque is omitted.
    def return_wing():
        south.timber_house(0,0,.32,8.1,3.75,5.4,2,hip=True)
        for floor in [1.38,4.05]:
            for x in [-2.7,0,2.7]:
                south.window(x,2.02,floor,1.1,1.35,mat='chestnut')
    place_local(4.1,6.5,math.pi/2,'return_wing',return_wing)
    def street_bays():
        for centre in [-5.18,5.18]:
            south.box((centre,.35,1.49),(8.05,3.0,2.50),'wood')
            south.box((centre,-1.27,.32),(8.38,3.63,.19),'paving')
            south.roof(centre,0,2.84,8.6,4.2,1.15,tiles=True)
            for k in range(5):
                dx=centre-4+k*2
                south.beam((dx,-1.54,.39),(dx,-1.54,2.85),.095,'chestnut',8)
            for k in range(4):
                dx=centre-3+k*2
                south.door(dx-.34,-1.22,.4,.68,1.76,open=k==2)
                south.window(dx+.51,-1.23,1.57,.68,.82,mat='chestnut')
        for yy in [-1.38,1.42]:
            for xx in [-1.01,1.01]:
                south.box((xx,yy,1.62),(.3,.34,2.60),'greybrick')
        south.roof(0,.05,3.25,3.0,4.55,1.26,hip=True)
    place_local(-19,2.2,-math.pi/2,'eight_shop_bays',street_bays)
    def timber_range():
        south.timber_house(0,0,.33,7.9,2.7,2.53,hip=False,plaster=False)
    place_local(-13.5,8.2,0,'timber_court',timber_range)
    place_local(-13.6,-3,math.pi,'timber_court',timber_range)
    # A paved threshold joins the passage to the verandas. Offset the sill
    # slightly above the surrounding earth so all three rises remain visible.
    south.part('cross_court_gateway')
    for side in [-1,1]:
        south.box((-9.1,1.15+side*1.22,1.42),(.68,.64,2.48),'greybrick')
        south.box((-9.1,1.15+side*1.22,.44),(.84,.81,.42),'lightstone')
    south.box((-9.1,1.15,2.77),(.72,3.36,.38),'greybrick')
    south.box((-9.1,1.15,3.02),(.89,3.66,.14),'lightstone')
    south.box((-9.1,1.15,3.20),(.70,2.04,.29),'greybrick')
    south.box((-9.1,1.15,3.41),(.92,2.38,.15),'tile')
    south.part('glass_lights')
    for floor in [2.04,4.69]:
        for i in range(7):
            x=-4.8+i*1.6
            for col in range(3):
                for row in range(3):
                    mat=['amber_glass','smoke_glass','blue_glass'][(col+i+row*2)%3]
                    south.box((x+(col-1)*.345,-1.325,floor+(row-1)*.50),(.302,.014,.451),mat)
    env.plant(-13.7,2.3,.28,3.55,3.25)
    env.plant(9.3,-2.2,.27,3.7,3.1)

def liping_street(env):
    # Both shop entrances open towards the existing ascending stone lane.
    # Set their thresholds on the masonry terrace beside the steps.
    def shop():
        south.timber_house(0,0,2.49,3.55,2.45,2.70,plaster=False)
        south.mesh([(-1.65,-1.29,4.58),(1.65,-1.29,4.58),
                    (1.65,-2.03,4.36),(-1.65,-2.03,4.36)],[(0,1,2,3)],'cloth')
        for side in [-1,1]:
            south.beam((side*1.46,-1.3,3.95),(side*1.46,-2.02,4.35),.033,'timber',6)
    for y in [-2.35,1.48]:
        place_local(5.7,y,-math.pi/2,'street_terrace_shops',shop)
    env.plant(-6.9,6.8,env.height(-6.9,6.8),3.4,2.9)

def trail(env,points,width):
    vs=[];faces=[]
    for x,y in points:
        for dx in [-width/2,width/2]:vs.append((x+dx,y,env.height(x+dx,y)+.10))
        k=len(vs)
        if k>2:faces.append((k-4,k-3,k-1,k-2))
    south.mesh(vs,faces,'sand')

def marsh_walk(env):
    for i in range(14):
        y=-13+i*1.85;x=.27*y+1.6*math.sin(.28*y)
        north.person(x,y,env.height(x,y),.93,yaw=-.23,pose='walk')
    north.flag(2.7,9,env.height(2.7,9),2.1,1)
    for i in range(3200):
        x=env.rng.uniform(-32,32);y=env.rng.uniform(-30,30)
        r,g,b=env.rgb(*env.uv(x,y))
        if b>g*.78 or max(r,g)<.09:continue
        z=env.height(x,y);s=env.rng.uniform(.19,.47)
        for j in range(4):
            a=env.rng.random()*math.tau;px=x+.11*math.cos(a);py=y+.11*math.sin(a)
            south.mesh([(px-.025,py,z),(px+.025,py,z),(px+.13*math.cos(a),py+.12*math.sin(a),z+s)],[(0,1,2)],'sedge')

def alpine_pass(env):
    for i in range(17):
        y=-13+i*1.6;x=1.8*math.sin(y*.11)
        north.person(x,y,env.height(x,y),.78,yaw=math.pi)
    north.flag(1,8,env.height(1,8),2.3,1)
    for i in range(92):
        x=env.rng.uniform(-24,24);y=env.rng.uniform(-22,22)
        if abs(x-1.8*math.sin(y*.11))<2.4:continue
        s=env.rng.uniform(.19,.83)
        south.rock((x,y,env.height(x,y)-s*.2),(s,s*1.5,s*.90),'rock')

def gorge_pass(env):
    for y in [-.56,.56]:south.beam((-5,y,2),(5,y,2),.15,'timber',8)
    for x in np.linspace(-5,5,38):south.box((x,0,2.2),(.25,1.45,.12),'wood')
    for x in [-5,5]:south.masonry(x,0,.22,1.2,2.1,1.86,.38)
    for i in range(6):north.person(-3.4+1.3*i,.12*(-1)**i,2.28,.9)
    for i in range(190):
        y=env.rng.uniform(-38,38);x=env.rng.choice([-1,1])*env.rng.uniform(3.9,7)
        s=env.rng.uniform(.09,.62);south.rock((x,y,env.height(x,y)),(s,s*.8,s*.6),'rock')

def create_landmark(env):
    sid=env.sid
    south.B={};south.R.seed(env.seed);south.part('site')
    original_tree=south.tree;south.tree=env.plant
    south_person,north_person=south.person,north.person
    north_bench=north.bench
    def bench(x,y,z,w=2,yaw=0):
        # The supplied seated delegates include individual chairs. These three
        # old shared benches occupied the same footprints in Lianghekou.
        if sid=='lianghekou' and abs(y-.25)<1e-5 and abs(z-.2)<1e-5 and any(abs(x-v)<1e-5 for v in (-2.5,0,2.5)):
            return
        return north_bench(x,y,z,w,yaw)
    north.bench=bench
    def civilian(x,y,z,h=1.67,pose=0):
        env.figures.build(x,y,z,env.rng.uniform(1.56,1.77),env.rng.uniform(-.68,.68),
                          'walk' if pose or env.figures.count%3==0 else 'stand','local')
    def traveller(x,y,z,s=1,yaw=0,pose='walk',pack=True):
        env.figures.build(x,y,z,env.rng.uniform(1.56,1.76),yaw,pose,'walker' if pack else 'local')
    south.person=civilian;north.person=traveller
    if sid=='luding':
        native_luding(env)
    elif sid in RIVER_STUDIES:
        field_waterfronts.scene(env,RIVER_STUDIES[sid])
        if sid=='chishui':
            for xx,yy,w,d,h in [(-8,6,4.5,3.2,3.0),(-2.7,6.7,4.8,3.5,3.4),(3.5,7.4,5.2,3.4,3.5),(8.5,8.9,3.7,3.1,2.95)]:
                add_cottage(env,xx,yy,w,d,h)
        elif sid=='jiaoping':
            for j in range(3):south.cave(-5+j*2.4,5,env.height(-5+j*2.4,5),1.55,1.83,1.5)
        elif sid=='anshun':
            add_cottage(env,-9,-8,4.8,3.2,2.65)
        elif sid=='yudu':
            for xx,yy in [(-17,-12),(-25,-16),(13,-16),(20,-18)]:add_cottage(env,xx,yy,env.rng.uniform(5,7),4.2,3.25)
    elif sid in south.BUILDERS:
        south.BUILDERS[sid]()
        if sid=='zunyi':zunyi_compound(env)
        if sid=='liping':liping_street(env)
    else:
        north.G=RegionalGeometry();north.RNG.seed(env.seed)
        def ground(w=32,d=28,fn=None,*args,**kw):
            fn=fn or (lambda x,y:0)
            env.local=(w,d,fn)
            return fn
        north.terrain=north.organic_terrain=ground
        north.shrub=lambda x,y,z,s=1,bare=False:env.plant(x,y,z,s*2.3,s*1.9)
        if sid=='lazikou':gorge_pass(env)
        elif sid=='jiajin':alpine_pass(env)
        elif sid=='songpan':marsh_walk(env)
        else:north.SCENES[sid][2]()
        names=['plaster','paper','timber','recess','stone','red','water']
        for i,(verts,faces) in north.G.parts.items():
            name=names[i] if isinstance(i,int) else i
            if sid in ['wuqi','jiangtai'] and i==north.PAPER:name='earth'
            if sid=='jiajin' and isinstance(i,int):name=['rock','snow','timber','rock','lightstone','red','water'][i]
            if name=='water':continue
            geometry('Historic '+name,verts,faces,name)
    south.tree=original_tree
    south.person=south_person;north.person=north_person;north.bench=north_bench
    # The journal guide is a contemporary interpretive layer, only displayed
    # in the guide view. Historical crowd meshes stay visible independently.
    anchors={'luding':(51,0,9.96),'zunyi':(2.7,-5.1,.37),'jiajin':(2.1,-2,None),
             'ruijin':(1.1,-.9,3.68),'liping':(2.8,-4.1,1.08),'lazikou':(5.10,0,2.29),
             'lianghekou':(2,-6,.25),'dawei':(6.1,.15,2.88),'huining':(-3,-7,.20)}
    gx,gy,gz=anchors.get(sid,(-2.7,RIVER_STUDIES[sid]['side']*2.8,None) if sid in RIVER_STUDIES else (2.6,-5.7,None))
    env.figures.build(gx,gy,env.height(gx,gy)+.03 if gz is None else gz,1.64,.23,'write','guide',True)
    historical_sets.dress(env)
    market(env)
    if sid!='luding':
        from station_story_details import add as add_story_details
        add_story_details(env)
    env.figures.flush(geometry)
    env.town_blocks()
    terrain_sets(env)
    ground_details(env)
    if sid in ['chishui','lianghekou','yudu'] or (sid in ['liping','zunyi','hadapu','huining','baxi'] and len(env.houses)<6):
        for i in range(14):
            x=(-1 if i%2 else 1)*env.rng.uniform(.17,.35)*env.span
            y=env.rng.uniform(-.34,.34)*env.span
            w=env.rng.uniform(3.3,6.1);d=w*.70
            if env.bank and abs(env.channel(x,y)[0])-env.channel(x,y)[1]<d:continue
            if any(abs(x-a)<(w+c)/2+1 and abs(y-b)<(d+e)/2+1 for a,b,c,e in env.houses):continue
            add_cottage(env,x,y,w,d,w*.43)
    joined=defaultdict(lambda:[[],[]])
    for (label,mat),(v,f) in south.B.items():
        if label in ['cut_paper_base','water_and_ripples','earthen_banks','jinsha_canyon_left','jinsha_canyon_right','yunshishan_cliff']:continue
        if mat in ['foliage','leaflight']:continue
        if label in ['xiangjiang_gravel_bars','anshun_pebble_beach','historic_cave_bank'] and mat=='sand':continue
        if label.startswith('Story details '):
            geometry(label+' / '+mat,v,f,mat)
            continue
        if sid=='zunyi' and label in ['conference_main_building','upper_cut_gallery','return_wing']:
            mat={'plaster':'greybrick','lightstone':'dressed_stone','timber':'chestnut'}.get(mat,mat)
        cut=sid=='zunyi' and label in ('upper_cut_wall','upper_cut_gallery','tiled_hip_roof_and_dormer','glass_lights')
        vs,fs=joined[(mat,cut)];k=len(vs);vs.extend(v);fs.extend(tuple(k+i for i in face) for face in f)
    for (mat,cut),(v,f) in joined.items():
        obj=geometry(('Roof section ' if cut else 'Historic ')+mat,v,f,mat)
        if cut:obj['roomCut']=True

def clear_guide_mark(env):
    """Find a grounded position with an unobstructed face and book in both aspect ratios."""
    scene=bpy.context.scene
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    x,eye,minus_y,angle=env.figures.anchor
    for dx,dy in [(0,0),(1.8,-1),(-2.1,-1.2),(1.2,2.5),(-3,2),(3,-2),(-4,-3),(4,3),(0,-7)]:
        px,py=x+dx,-minus_y+dy
        if any(math.hypot(px-a,py-b)<1.05 for a,b,_,_ in env.figures.people):continue
        estimate=eye-1.14 if dx==dy==0 else env.height(px,py)
        if env.sid=='chishui' and abs(px)<10.5 and .9<py<6.5:estimate=1.86
        hit,foot,n,_,support,_=scene.ray_cast(graph,Vector((px,py,estimate+.78)),Vector((0,0,-1)),distance=3.8)
        if not hit or abs(n.z)<.58 or support.name.startswith(('People','Individual','Branch')):continue
        if env.bank and support.name.startswith('Continuous terrain'):
            cross,width,_=env.channel(px,py)
            if abs(cross)<width+.25:continue
        fz=foot.z+.012
        for turn in [angle,angle+1.06,angle-1.06,angle+2.14,angle-2.14,angle+math.pi]:
            yaw=turn+.17;clear=True
            for dist in [3.05,3.905]:
                camera=Vector((px+math.sin(yaw)*dist*.987,py-math.cos(yaw)*dist*.987,fz+1.14+dist*.159))
                for side,h in [(0,.24),(-.22,1.06),(.22,1.06),(0,1.59)]:
                    point=Vector((px+side*math.cos(yaw),py+side*math.sin(yaw),fz+h))
                    ray=point-camera
                    if scene.ray_cast(graph,camera,ray.normalized(),distance=ray.length-.018)[0]:
                        clear=False;break
                if not clear:break
            if clear:
                env.figures.anchor=[px,fz+1.14,-py,turn]
                return
    raise ValueError('No clear guide camera at '+env.sid)

def build(sid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    env=Landscape(sid)
    create_landmark(env)
    ground=env.terrain()
    ground['framingWidth']=env.shot
    ground['targetHeight']=env.target
    ground['plateWidth']=env.span
    ground['surveyPlate']=env.plate
    ground['figureCount']=env.figures.count
    if sid!='luding' and getattr(env,'story_details',None):
        ground['storyDetailTargetsJSON']=json.dumps(env.story_details,ensure_ascii=False)
    if sid in RIVER_STUDIES:
        spec=RIVER_STUDIES[sid]
        bx,by,bz=env.boat_focus
        ground['boatView']=[bx,bz,-by]
        ground['reachCentre']=[0,1,-env.mid]
        ground['riverWidth']=spec['waterWidth']
        ground['hullDimensions']=list(env.hull_dimensions)
        ground['scaleBasis']=spec['basis']
        ground['scaleSource']=spec['source']
        if 'widthSource' in spec:ground['widthSource']=spec['widthSource']

    placements=env.populate()
    if sid=='luding':
        from luding_studio import dress_scene
        dress_scene(env,ground,geometry)
    else:
        ground['groveInstances']=placements
        from landscape_surfaces import dress_landscape
        dress_landscape(env,ground)
    clear_guide_mark(env)
    if sid != 'luding':
        portrait = frame_resident(env)
        if portrait:
            ground['residentView'] = portrait
    x,y,z,dist,turn,tilt=frame_tableau(env)
    ground['tableauView']=[x,z,-y,dist,turn,tilt]
    ground['recorderAnchor']=env.figures.anchor
    OUT.mkdir(exist_ok=True,parents=True)
    image_options={'export_image_format':'WEBP','export_image_quality':88} if sid=='luding' else {}
    target=OUT/(sid+'.glb')
    temporary=OUT/(sid+'.'+uuid4().hex+'.glb')
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',**image_options,
            export_extras=True,export_yup=True,export_gpu_instances=(sid=='luding'),export_meshopt_compression_enable=True,
            export_meshopt_extension='EXT_meshopt_compression',export_animations=False)
        if sid=='luding':
            from luding_sedge import promote_shore_alpha
            promote_shore_alpha(temporary)
        # The local preview server/Windows scanner can briefly hold the old GLB
        # open. Keep the completed temporary export and retry its atomic swap.
        for attempt in range(40):
            try:
                temporary.replace(target)
                break
            except PermissionError:
                if attempt==39:raise
                time.sleep(.25)
    finally:
        temporary.unlink(missing_ok=True)
    print('LANDSCAPE',sid,len(env.trees),'crowns',flush=True)
    if sid=='luding' and '--proof' in sys.argv:
        from luding_studio import render_proofs
        render_proofs()

def frame_resident(env):
    """Frame a person at eye level without putting a wall or neighbour in front."""
    scene = bpy.context.scene
    graph = bpy.context.evaluated_depsgraph_get()
    candidates = sorted(env.figures.portrait_candidates, key=lambda person: not person[-1])
    for x, y, z, height, yaw, pose, _ in candidates:
        # Supplied actors record their actual posed mesh height. Seated people
        # have already been scaled to seated stature by field_supplied.
        head = height * .91
        aim = Vector((x, y, z + head * .73))
        distance = max(2.15, height * 1.62)
        for offset in (.30, -.35, .69, -.74, 1.08, -1.08):
            angle = yaw + offset
            for pitch in (.14, .30):
                eye = aim + distance * Vector((math.sin(angle) * math.cos(pitch),
                                               -math.cos(angle) * math.cos(pitch), math.sin(pitch)))
                if eye.z < env.height(eye.x, eye.y) + .3:
                    continue
                # A seated meeting participant can have legs below the table.
                # Check face/shoulders rather than rejecting the portrait when
                # the desk naturally hides the lower body.
                levels=((head,0),(head*.80,.13),(head*.80,-.13),(head*.72,0)) if pose=='sit' else ((head,0),(head*.65,.15),(head*.65,-.15),(.28,0))
                for level, side in levels:
                    point = Vector((x + side * math.cos(yaw), y + side * math.sin(yaw), z + level))
                    ray = point - eye
                    if scene.ray_cast(graph, eye, ray.normalized(), distance=ray.length - .32)[0]:
                        break
                else:
                    return [x, aim.z, -y, distance, angle, pitch]
    return None


def frame_tableau(env):
    """Pick an actual line of sight to the evidence, including the portrait lens."""
    x,y,z,dist,desired,tilt=env.tableau
    if env.sid=='zunyi':return env.tableau
    scene=bpy.context.scene;graph=bpy.context.evaluated_depsgraph_get()
    aim=Vector((x,y,z));best=None
    for delta in [0,.55,-.55,1.12,-1.12,1.70,-1.70,2.3,-2.3,math.pi]:
        angle=desired+delta
        for pitch in [tilt,tilt+.18,tilt+.34]:
            cost=.16*abs(delta)+.5*abs(pitch-tilt)
            for factor in [1,1.28]:
                eye=aim+Vector((math.sin(angle)*math.cos(pitch),-math.cos(angle)*math.cos(pitch),math.sin(pitch)))*dist*factor
                for sx,sz in [(0,0),(-.65,.12),(.65,.12),(0,.44),(0,-.28)]:
                    destination=aim+Vector((sx*math.cos(angle),sx*math.sin(angle),sz))
                    ray=destination-eye
                    if scene.ray_cast(graph,eye,ray.normalized(),distance=ray.length-min(1.3,dist*.15))[0]:
                        cost+=2 if sx==0 and sz==0 else 1
            if best is None or cost<best[0]:best=(cost,angle,pitch)
            if cost==0:return env.tableau
    return (x,y,z,dist,best[1],best[2])

if __name__=='__main__':
    ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SITES)
    for sid in ids:
        if not sid.startswith('--'):build(sid)

