"""Near-field trees, contributed props and the rock positions driving the current shader."""
import json
import math
from pathlib import Path
import random
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ROCKS=['rock-a','rock-b','rock-c','rock-d']

def forked_tree(env,geometry,x,y,z,h,seed):
    rng=random.Random(seed)
    verts=[];faces=[];uv=[]
    def limb(centres,radii):
        length=0.; sides=16;start=len(verts)
        for j,(c,r) in enumerate(zip(centres,radii)):
            direction=(centres[min(j+1,len(centres)-1)]-centres[max(j-1,0)]).normalized()
            tangent=direction.cross(Vector((0,1,0))).normalized();across=direction.cross(tangent)
            if j:length+=(c-centres[j-1]).length
            for i in range(sides+1):
                a=2*math.pi*i/sides;fluted=r*(1+.065*math.sin(5*a+j*.2)+.035*math.cos(3*a))
                p=c+(tangent*math.cos(a)+across*math.sin(a))*fluted
                verts.append(tuple(p));uv.append((i/sides*max(.75,radii[0]*5),length/1.34))
                if i and j:
                    k=start+j*(sides+1)+i;faces.append((k-sides-2,k-sides-1,k,k-1))
    base=Vector((x,y,z-.12));lean=Vector((-.08*h,.035*h,0))
    def axis(t):return base+Vector((0,0,h*t))+lean*t*t
    limb([axis(t) for t in (0,.045,.23,.47,.72,.94)],[h*r for r in (.061,.048,.038,.032,.022,.009)])
    for j in range(6):
        a=2*math.pi*j/6+rng.uniform(-.20,.2);d=Vector((math.cos(a),math.sin(a),0))
        limb([axis(.06),base+d*h*.08+Vector((0,0,.16)),base+d*h*.15],
             [h*.033,h*.023,.024])
    leaf_batches={}
    for j in range(12):
        t=.34+j*.047;a=j*2.40+rng.uniform(-.23,.23);d=Vector((math.cos(a),math.sin(a),0))
        reach=h*(.34-.12*t)*rng.uniform(.82,1.15)
        start=axis(t);mid=start+d*reach*.5+Vector((0,0,h*.13));end=start+d*reach+Vector((0,0,h*.28))
        limb([start,mid,end],[h*.022,h*.014,h*.003])
        for k in range(2):
            side=Vector((-d.y,d.x,0))*(1 if k else -1)
            twig=end+side*reach*.37+Vector((0,0,h*.08))
            limb([mid,end,twig],[h*.010,h*.005,.009])
            # Actual folded leaves replace the large photographic branch cards.
            # Fine geometry has no black rectangular margins at grazing angles.
            for spray in range(90):
                c=twig+Vector((rng.gauss(0,h*.058),rng.gauss(0,h*.058),rng.gauss(0,h*.045)))
                turn=rng.uniform(0,math.tau);tilt=rng.uniform(-.55,.55)
                leaf_axis=Vector((math.cos(turn),math.sin(turn),tilt)).normalized()
                cross=leaf_axis.cross(Vector((0,0,1))).normalized()
                length=rng.uniform(.10,.18);width=length*rng.uniform(.29,.40)
                batch=leaf_batches.setdefault(rng.randrange(3),([],[]));vv,ff=batch;idx=len(vv)
                vv.extend([c-leaf_axis*length*.5,c+leaf_axis*length*.5,
                           c-cross*width*.5-Vector((0,0,.009)),c+cross*width*.5-Vector((0,0,.009)),c+Vector((0,0,.012))])
                ff.extend([(idx,idx+2,idx+4),(idx+2,idx+1,idx+4),(idx+1,idx+3,idx+4),(idx+3,idx,idx+4)])
    geometry('Textured trunk and boughs',verts,faces,'riparian_bark',uv,True)
    for shade,(leaves,faces) in leaf_batches.items():
        geometry('Fine folded leaflets',leaves,faces,'luding_leaf_'+str(shade))

def prepare_bank(env,ground,geometry):
    def patch(name,x,y,w,d,elevation=None):
        verts=[];uv=[];faces=[];n=20
        for j in range(n+1):
            for i in range(n+1):
                u=i/n;v=j/n;px=x+(u-.5)*w;py=y+(v-.5)*d
                pz=env.height(px,py)+.085 if elevation is None else elevation
                verts.append((px,py,pz));uv.append((u,v))
                if i and j:
                    k=j*(n+1)+i;faces.append((k-n-2,k-n-1,k,k-1))
        geometry(name,verts,faces,'path_verge',uv)
    patch('West bank path',-66,17,5.7,12.2)
    patch('East bank path',69,8,5.3,12.5)
    # Keep the bridgehead platform and its name-board sightline open.
    forked_tree(env,geometry,71,9,env.height(71,9),7.8,51)
    for j,(x,y,h) in enumerate([(-59,9,8.4),(58,11,7.3),(60,-30,9.6),(-58,-22,8.2),(71,25,10)]):
        forked_tree(env,geometry,x,y,env.height(x,y),h,308+j)

def place_contributions(env,ground):
    from luding_keyframe import available
    masters={};rng=random.Random(9383)
    def place(key,loc,scale,yaw=0,flip=False):
        if key not in masters:
            bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/luding/props'/(key+'.glb')))
            obj=next(o for o in bpy.context.selected_objects if o.type=='MESH')
            masters[key]=obj
        else:
            obj=masters[key].copy();bpy.context.collection.objects.link(obj)
        # glTF imports use QUATERNION mode. Only the reviewed carving needs an
        # X rotation; assigning Euler angles alone previously did nothing.
        if key=='carving':obj.rotation_mode='XYZ'
        obj.location=loc;obj.rotation_euler=(math.pi if flip else 0,0,yaw);obj.scale=scale
        if key=='carving':
            rotation=obj.rotation_euler.to_matrix()
            bottom=min((rotation@Vector(tuple(p[i]*scale[i] for i in range(3)))).z for p in obj.bound_box)
            obj.location.z-=bottom
        return obj
    for x,y,s in env.contributed_houses:
        if available('kf-house'):continue
        floor=env.height(x,y)
        place('house',(x,y,floor-.09),(s,s,s),.13*math.sin(y)+(math.pi if x<0 else 0))
    if not available('kf-pavilion'):
        place('gate',(67,-17,env.height(67,-17)-.09),(4.95,4.95,4.95),1.43)
    # Its source is tabletop-down. Turn the frame over, then bottom-align its
    # four leg ends to the terrain, beneath the separately authored tabletop.
    place('carving',(-60,4.5,env.height(-60,4.5)),(2.18,.96,.98),0,True)
    if available('kf-rock-a') and available('kf-rock-b'):return
    eddies=[]
    for j,y in enumerate([-85,-67,-45,-29,-16,17,29,43,55,72,84]):
        for side in [-1,1]:
            c,w,_=env.channel(0,y)
            x=-c+side*(w+rng.uniform(-2,5))
            for k in range(3):
                px=x+rng.uniform(-2.,2.);py=y+rng.uniform(-3.6,3.6);s=rng.uniform(1.2,4.1)
                place(ROCKS[(j+k+(side==1))%4],(px,py,env.height(px,py)-.08*s),(s,s,s),rng.uniform(0,6.28))
    # Boulders in the actual channel leave asymmetric downstream wakes.
    for j,(x,y,s) in enumerate([(-21,-23,3.5),(17,-39,4.5),(26,-56,3.3),(9,-68,5.0),(-30,36,3.8),(29,22,3.1)]):
        place(ROCKS[j%4],(x,y,-.29*s+.28),(s,s,s),.87*j)
        eddies.extend([x,-y,s*.44,s*.40])
    ground['riverObstacles']=eddies
