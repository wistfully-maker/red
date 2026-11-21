"""Original solid summer foliage library. No image planes, UVs or external textures.
Each silhouette is authored once at three branch/leaf resolutions and instanced.
"""
from pathlib import Path
import math, random
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
TAU=math.tau
def rgb(h):
    values=[int(h[k:k+2],16)/255 for k in (0,2,4)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in values)
BARK=rgb('665342')
PALETTE={
 'camphor':['365736','567c42','719549','8ca453'],
 'willow':['3f6332','628c42','88a750','9eb562'],
 'fir':['274836','355b42','507552','6e8d58'],
 'bamboo':['416831','658d42','8aaa4c','9bb459']
}
mat=bpy.data.materials.new('Summer foliage • vertex pigments');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF')
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Pigment'
mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value=.94
class Crown:
    def __init__(self,species,variant,lod):
        self.species=species;self.variant=variant;self.lod=lod
        self.r=random.Random(1329+variant*119+list(PALETTE).index(species)*37)
        self.v=[];self.f=[];self.colors=[]
        self.tones=[rgb(x) for x in PALETTE[species]]
    def shape(self,v,f,color):
        n=len(self.v);self.v.extend(v);self.f.extend(tuple(n+i for i in face) for face in f)
        self.colors.extend([(*color,1)]*len(v))
    def limb(self,pts,radii,color=BARK):
        pts=list(map(Vector,pts));vs=[];fs=[];sides=5 if self.lod<2 else 8
        for j,(p,rad) in enumerate(zip(pts,radii)):
            axis=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
            a=axis.cross(Vector((0,0,1)) if abs(axis.z)<.88 else Vector((0,1,0))).normalized();b=axis.cross(a)
            for i in range(sides):
                t=i*TAU/sides;vs.append(tuple(p+rad*(a*math.cos(t)+b*math.sin(t))))
                if j:
                    k=(j-1)*sides+i;q=(j-1)*sides+(i+1)%sides;fs.append((k,q,q+sides,k+sides))
        self.shape(vs,fs,color)
    def lobe(self,c,rx,ry,rz,seed):
        r=random.Random(seed);n=5 if self.lod in (0,3) else 8;verts=[tuple(c-Vector((0,0,rz*.8)))];faces=[]
        for ring in range(2):
            for i in range(n):
                a=TAU*(i+.32*ring)/n;scale=r.uniform(.76,1.18)
                verts.append(tuple(c+Vector((math.cos(a)*rx*scale,math.sin(a)*ry*scale,rz*(ring*.82-.36+r.uniform(-.18,.12))))))
        verts.append(tuple(c+Vector((rx*.12,ry*.04,rz*.87))))
        for i in range(n):
            j=(i+1)%n;faces.extend([(0,1+j,1+i),(1+i,1+j,1+n+j,1+n+i),(1+n+i,1+n+j,2*n+1)])
        shade=self.tones[r.randrange(0,3)]
        self.shape(verts,faces,shade)
        for j,p in enumerate(verts):
            light=.72+.36*max(0.,min(1.,.5+(p[2]-c.z)/(2*rz)))
            self.colors[len(self.colors)-len(verts)+j]=(*[v*light for v in shade],1)
    def blade(self,p,a,length,width,pitch,color):
        long=Vector((math.cos(a)*math.cos(pitch),math.sin(a)*math.cos(pitch),math.sin(pitch)))*length
        side=Vector((-math.sin(a),math.cos(a),0))*width
        mid=p+long*.5
        self.shape([tuple(p),tuple(mid+side),tuple(p+long),tuple(mid-side),tuple(mid+Vector((0,0,width*.45)))],
                   [(0,1,4),(1,2,4),(2,3,4),(3,0,4)],color)
    def spray(self,c,radius,seed,droop=False):
        r=random.Random(seed);self.lobe(c,radius,radius*.85,radius*(.62 if droop else .74),seed)
        if not self.lod:return
        tips=5 if self.lod==1 else 14
        for j in range(tips):
            a=j*2.4+r.uniform(-.35,.35)
            delta=Vector((math.cos(a)*radius,math.sin(a)*radius,radius*r.uniform(-.30,.63)))
            tip=c+delta
            if self.lod==2:self.limb([c,tip],[.004,.0015],self.tones[0])
            for k in range(2 if self.lod==1 else 6):
                t=(k+1)/7;start=c+delta*(.35+t*.86)
                self.blade(start,a+(-1)**k*r.uniform(.45,1.1),radius*r.uniform(.30,.63),
                           radius*(.065 if droop else .129),r.uniform(-.96,-.35) if droop else r.uniform(-.4,.42),self.tones[r.randrange(1,4)])
    def hardwood(self):
        r=self.r;weeping=self.species=='willow'
        trunk=[Vector(p) for p in [(0,0,0),(.008,.005,.19),(-.018,.013,.35),(.021,-.008,.57),(.02,.01,.79)]]
        self.limb(trunk,[.043,.032,.026,.018,.005])
        # Primary branch positions are identical at all LODs.
        for i in range(15):
            r=random.Random(3169+i*71+self.variant*117)
            t=i/14;a=i*2.40+r.uniform(-.36,.36)
            z=.30+t*.46;extent=.23+.12*math.sin(t*math.pi)-.14*t
            p=Vector((.008,.0,z));d=Vector((math.cos(a),math.sin(a),0))
            elbow=p+d*extent*.48+Vector((0,0,.090));end=p+d*extent+Vector((0,0,.19-.06*t))
            self.limb([p,elbow,end],[.018*(1-.6*t),.011,.003])
            count=1 if self.lod==0 else (2 if self.lod==1 else (3 if weeping else 4))
            for k in range(count):
                b=a+(k-1.4)*.78;tip=end+Vector((.080*math.cos(b),.080*math.sin(b),.045+r.uniform(-.02,.05)))
                if self.lod:self.limb([elbow,tip],[.007,.0025])
                self.spray(tip,.078 if weeping else .104,1000+i*79+k*19+self.variant,weeping)
                if weeping:
                    lower=tip+Vector((.031*math.cos(b),.031*math.sin(b),-.18-r.uniform(0,.10)))
                    self.limb([tip,lower],[.0032,.0014],self.tones[0])
                    for j in range(3 if self.lod==0 else 8):
                        self.blade(tip.lerp(lower,j/8),b+j*2.3,.064,.010,-.87,self.tones[1+j%3])
    def conifer(self):
        self.limb([(0,0,0),(.007,0,.54),(0,0,1)],[.027,.019,.002])
        if self.lod==0:
            for row in range(6):
                z=.17+row*.12;r=.246*(1-row*.129)
                verts=[(0,0,z+.25)]
                for k in range(14):
                    a=k*TAU/14+row*.36;rad=r*(1 if k%2 else .71)
                    verts.append((rad*math.cos(a),rad*math.sin(a),z+.025*(k%2)))
                self.shape(verts,[(0,1+j,1+(j+1)%14) for j in range(14)],self.tones[1+row%2])
            return
        for row in range(9):
            z=.20+row*.087;length=.245*(1-row*.091)
            for k in range(6):
                a=k*TAU/6+row*.53+self.variant*.7
                tip=Vector((math.cos(a)*length,math.sin(a)*length,z-.023))
                root=Vector((0,0,z+.052))
                self.limb([root,tip],[.009*(1-.07*row),.002])
                for j in range(3):
                    c=root.lerp(tip,.45+j*.26)
                    self.lobe(c,length*.39,length*.28,length*.24+0.013,k*41+row*91+j)
                    if self.lod:
                        for l in range(3 if self.lod==1 else 10):
                            self.blade(c,a+(l-4)*.45,length*.49,length*.078,.12,self.tones[1+l%3])
    def reeds(self):
        for stalk in range(6):
            a=stalk*2.40;h=.67+self.r.random()*.33;rad=.09*self.r.random()
            start=Vector((rad*math.cos(a),rad*math.sin(a),0));bend=Vector((.15*math.cos(a),.15*math.sin(a),0))
            pts=[start+bend*t*t+Vector((0,0,t*h)) for t in [0,.25,.5,.75,1]]
            self.limb(pts,[.009,.0085,.0073,.0052,.0021],self.tones[1])
            for j in range(5):
                t=.42+j*.115;b=a+j*1.75
                p=start+bend*t*t+Vector((0,0,h*t));end=p+Vector((math.cos(b)*.12,math.sin(b)*.12,.04))
                if self.lod:self.limb([p,end],[.0035,.001],self.tones[0])
                for l in range(3 if self.lod==0 else (6 if self.lod==1 else 14)):
                    self.blade(p.lerp(end,(l+1)/15),b+(-1)**l*.67,.095,.011,-.53,self.tones[1+l%3])
    def export(self):
        if self.lod==3:
            if self.species=='fir':
                for j in range(3):
                    h=.18+j*.22;r=.23-j*.055
                    v=[(0,0,h+.38)]+[(r*math.cos(k*TAU/7),r*math.sin(k*TAU/7),h) for k in range(7)]
                    self.shape(v,[(0,k+1,1+(k+1)%7) for k in range(7)],self.tones[j])
            else:
                for j in range(4):
                    a=j*2.4;r=.15 if j<3 else 0
                    self.lobe(Vector((r*math.cos(a),r*math.sin(a),.58+.075*j)),.23,.19,.23,j+10*self.variant)
            self.limb([(0,0,0),(0,0,.67)],[.027,.018])
        elif self.species=='fir':self.conifer()
        elif self.species=='bamboo':self.reeds()
        else:self.hardwood()
        height=max(p[2] for p in self.v);low=min(p[2] for p in self.v)
        mesh=bpy.data.meshes.new(self.species);mesh.from_pydata([(x/(height-low),y/(height-low),(z-low)/(height-low)) for x,y,z in self.v],[],self.f);mesh.update()
        for face in mesh.polygons:face.use_smooth=True
        attr=mesh.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='POINT')
        for v,col in zip(attr.data,self.colors):v.color=col
        obj=bpy.data.objects.new(f'{self.species}_{self.variant}_{self.lod}',mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat)
for species in PALETTE:
    for variant in range(2):
        for lod in [0,1,2,3]:Crown(species,variant,lod).export()
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/green-groves.glb'),export_format='GLB',export_yup=True,export_animations=False,
    export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression')
print('GREEN GROVES: 4 species, 8 silhouettes, 32 original mesh LODs')

