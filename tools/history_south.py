"""Nine handcrafted history dioramas, after the researched 3x3 reference sheet.

Run with Blender 5.2: blender -b --python tools/history_south.py -- [id ...]
Optional --preview-dir ABS_PATH renders 720px inspection images (outside source tree).
Blender Z up is converted to glTF Y up; the principal front is glTF +Z.
All geometry is authored here, without downloaded/generated mesh assets.
"""
import bpy, math, random, sys, os, json
from pathlib import Path
from mathutils import Vector
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'models' / 'history'
PI = math.pi
R = random.Random(1934)
B = {}
PART = 'landscape'
MATS = {}
COLORS = {
    'paper': (.82,.805,.77,1), 'plaster': (.75,.74,.70,1),
    'stone': (.60,.595,.56,1), 'lightstone': (.70,.69,.65,1),
    'rock': (.53,.53,.50,1), 'sand': (.72,.705,.66,1),
    'timber': (.29,.285,.265,1), 'wood': (.48,.46,.415,1),
    'tile': (.37,.375,.355,1), 'tilerib': (.48,.48,.45,1),
    'recess': (.13,.135,.13,1), 'iron': (.205,.215,.205,1),
    'foliage': (.43,.455,.415,1), 'leaflight': (.56,.57,.52,1),
    'water': (.59,.63,.625,1), 'ripple': (.79,.80,.765,1),
    'red': (.48,.095,.065,1), 'cloth': (.65,.625,.56,1),
}

def part(s):
    global PART
    PART=s

def mesh(v, f, mat='stone'):
    key=(PART,mat)
    if key not in B: B[key]=[[],[]]
    vv,ff=B[key]; n=len(vv)
    vv.extend(v); ff.extend([tuple(n+i for i in face) for face in f])

def box(c,s,mat='stone',a=0):
    x,y,z=c; w,d,h=[i/2 for i in s]; ca,sa=math.cos(a),math.sin(a)
    v=[(x+u*ca-t*sa,y+u*sa+t*ca,z+k) for u,t,k in
       [(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)]]
    mesh(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)

def beam(a,b,r,mat='timber',n=8,r2=None):
    a,b=Vector(a),Vector(b); axis=(b-a).normalized()
    u=axis.cross(Vector((0,0,1)))
    if u.length<.01:u=axis.cross(Vector((1,0,0)))
    u.normalize(); v=axis.cross(u); r2=r if r2 is None else r2
    pts=[tuple(p+(u*math.cos(i*2*PI/n)+v*math.sin(i*2*PI/n))*rad)
         for p,rad in [(a,r),(b,r2)] for i in range(n)]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(pts,faces,mat)

def line(points,r=.025,mat='timber',n=6):
    for a,b in zip(points[:-1],points[1:]):beam(a,b,r,mat,n)

def poly_prism(poly,z0,z1,mat='stone'):
    n=len(poly); v=[(x,y,z) for z in [z0,z1] for x,y in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    f += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(v,f,mat)

def slab(w,d,h=.28):
    part('cut_paper_base'); cut=.6
    poly=[(-w/2+cut,-d/2),(w/2-cut,-d/2),(w/2,-d/2+cut),(w/2,d/2-cut),
          (w/2-cut,d/2),(-w/2+cut,d/2),(-w/2,d/2-cut),(-w/2,-d/2+cut)]
    poly_prism(poly,0,h,'paper')
    return h

def rock(c,s,mat='rock',seed=None):
    rr=R if seed is None else random.Random(seed)
    x,y,z=c; sx,sy,sz=s; rings=[]; n=7
    for k,(h,rad) in enumerate([(-.48,.66),(-.08,1),(.36,.76),(.58,.24)]):
        rings.extend([(x+math.cos(i*2*PI/n+.16*k)*sx*rad*(.85+rr.random()*.22),
                       y+math.sin(i*2*PI/n+.16*k)*sy*rad*(.85+rr.random()*.22),
                       z+h*sz+(rr.random()-.5)*sz*.13) for i in range(n)])
    f=[]
    for k in range(3):
        for i in range(n):
            a=k*n+i;b=k*n+(i+1)%n;c1=b+n;d=a+n
            f.extend([(a,b,c1),(a,c1,d)])
    f += [tuple(range(3*n,4*n)),tuple(range(n-1,-1,-1))]
    mesh(rings,f,mat)

def mound(x,y,z,w,d,h,mat='rock'):
    n=36; pts=[]
    profiles=[(1,0),(.88,.33),(.68,.7),(.46,.93),(.05,1)]
    for k,(rad,hf) in enumerate(profiles):
        for i in range(n):
            t=i*2*PI/n; uneven=1+.08*math.sin(5*t)+.035*math.cos(11*t+k)
            pts.append((x+math.cos(t)*w*.5*rad*uneven,y+math.sin(t)*d*.5*rad*uneven,
                        z+h*hf+(math.sin(i*2.3+k)*.08*h if k not in (0,4) else 0)))
    f=[tuple(range(n-1,-1,-1))]
    for k in range(4):
        for i in range(n):
            a=k*n+i;b=k*n+(i+1)%n
            f.extend([(a,b,b+n),(a,b+n,a+n)])
    f.append(tuple(range(n*4,n*5)));mesh(pts,f,mat)

def cliff(x,y,z,w,d,h):
    """Stratified, near-vertical rock wall, with a jagged plateau instead of a cone."""
    nx=22;nz=13;vv=[]
    for k in range(nz+1):
        t=k/nz
        for i in range(nx+1):
            u=i/nx;xx=x-w/2+u*w
            top=h*(.91+.07*math.sin(u*19)+.025*math.cos(u*43))
            yy=y-d/2+.25*math.sin(u*31)+.13*math.cos(u*47+k*.8)+.22*math.sin(k*1.1)
            vv.append((xx,yy,z+top*t))
    ff=[]
    for k in range(nz):
        for i in range(nx):
            a=k*(nx+1)+i;b=a+1;c=b+nx+1;dd=a+nx+1
            ff.extend([(a,b,c),(a,c,dd)])
    # Return around the sides and rear, including the rugged top edge.
    front_top=[vv[nz*(nx+1)+i] for i in range(nx+1)]
    topv=[];nd=9
    for j in range(nd+1):
        t=j/nd
        for i,p in enumerate(front_top):
            u=i/nx
            topv.append((p[0]+.12*math.sin(j*2+i),p[1]*(1-t)+(y+d*.5)*t,
                         p[2] if not j else z+h*(.93-.17*t+.065*math.sin(u*24+j*.72)+.025*math.cos(i*2-j))))
    topf=[]
    for j in range(nd):
        for i in range(nx):
            a=j*(nx+1)+i;topf.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
    mesh(topv,topf,'stone')
    mesh(vv,ff,'rock')
    for side,idx in [(-1,0),(1,nx)]:
        sidev=[];nside=9
        for j in range(nside+1):
            s=j/nside
            for k in range(nz+1):
                t=k/nz;top=z+h*(.93-.17*s+.06*math.sin(idx*.8+j*.7))
                sidev.append((x+side*(w/2+.15*math.sin(j*2.1+k*1.2)),y-d/2+s*d,z+(top-z)*t))
        sidef=[]
        for j in range(nside):
            for k in range(nz):
                a=j*(nz+1)+k;sidef.extend([(a,a+1,a+nz+2),(a,a+nz+2,a+nz+1)])
        mesh(sidev,sidef,'rock')
    # Long ledges break the wall into nonrepeating sediment and fracture layers.
    for k in range(18):
        zz=z+R.uniform(.15,h*.9);start=x+R.uniform(-w*.46,w*.2);length=R.uniform(w*.18,w*.37)
        pts=[(start+j*length/7,y-d*.5-.04+.22*math.sin(j*.8+k),zz+.07*math.sin(j*.8+k)+j*.018) for j in range(8)]
        line(pts,.025,'stone',5)
    for i in range(25):
        xx=x+R.uniform(-w*.48,w*.48);zz=z+R.uniform(.2,h*.86)
        rock((xx,y-d*.5-.06,zz),(.25+R.random()*.25,.28,.40+R.random()*.45),'stone')

def stones(x0,x1,y0,y1,z,step=.55,mat='lightstone'):
    row=0;y=y0
    while y<y1:
        x=x0-(step*.5 if row%2 else 0)
        while x<x1:
            left=max(x,x0);right=min(x+step*.96,x1)
            if right>left:box(((left+right)/2,y+step*.44,z-.035),(right-left,step*.84,.07),mat)
            x+=step
        row+=1;y+=step*.9

def masonry(x,y,z,w,d,h,unit=.55):
    box((x,y,z+h*.5),(w,d,h),'stone')
    for row in range(max(1,int(h/.3))):
        zz=z+row*.3+.14
        for i in range(int(w/unit)+1):
            xx=x-w/2+i*unit+(.25*unit if row%2 else -.25*unit)
            if abs(xx-x)>w/2-unit*.35:continue
            box((xx,y-d/2-.012,zz),(unit*.92,.035,.265),'lightstone' if R.random()<.3 else 'stone')

def stairs(x,y,z,w,n=12,tread=.32,rise=.17,rail=False):
    # Ascend away from the camera, towards positive Blender Y.
    for i in range(n):
        box((x,y+(i+.5)*tread,z+(i+1)*rise*.5),(w,tread*.97,(i+1)*rise),'lightstone')
        for j in range(max(1,int(w/.55))):
            beam((x-w/2+j*.55,y+(i+.08)*tread,z+(i+1)*rise+.006),
                 (x-w/2+j*.55,y+(i+.92)*tread,z+(i+1)*rise+.006),.009,'stone',4)
    if rail:
        for side in [-1,1]:
            for i in range(0,n,3):
                xx=x+side*(w/2+.08);yy=y+(i+.5)*tread;zz=z+(i+1)*rise
                box((xx,yy,zz+.37),(.12,.12,.74),'timber')
            line([(x+side*(w/2+.08),y+.12,z+.75),
                  (x+side*(w/2+.08),y+(n-.2)*tread,z+n*rise+.75)],.055,'timber')

def window(x,y,z,w=.8,h=1.05,lattice=True,mat='timber'):
    # Frame and deeply recessed panel face Blender -Y.
    box((x,y,z),(w,.075,h),'recess')
    for dx in [-w/2,w/2]:box((x+dx,y-.045,z),(.075,.10,h+.14),mat)
    for dz in [-h/2,h/2]:box((x,y-.045,z+dz),(w+.12,.1,.075),mat)
    count=5 if lattice else 3
    for i in range(1,count):box((x-w/2+w*i/count,y-.07,z),(.028,.045,h),mat)
    for j in range(1,5 if lattice else 3):
        dz=-h/2+h*j/(5 if lattice else 3)
        box((x,y-.075,z+dz),(w,.045,.026),mat)
    box((x,y-.10,z-h/2-.07),(w+.21,.22,.08),'lightstone')

def door(x,y,z,w=.9,h=1.7,open=False):
    box((x,y,z+h/2),(w,.10,h),'recess')
    if not open:
        for i in range(8):box((x-w/2+(i+.5)*w/8,y-.06,z+h/2),(w/8*.91,.07,h-.1),'wood')
    for dx in [-w/2,w/2]:box((x+dx,y-.12,z+h/2),(.10,.15,h+.15),'timber')
    box((x,y-.12,z+h+.03),(w+.20,.15,.12),'timber')
    for dx in [-w*.14,w*.14]:beam((x+dx,y-.13,z+h*.45),(x+dx,y-.20,z+h*.45),.035,'iron',8)

def roof(x,y,z,w,d,rise=1.35,hip=False,mat='tile',tiles=True):
    part0=PART
    # Individual rolled tiles follow curved eaves, with raised eave tips.
    ridgehalf=max(w*.145,w*.5-d*.38) if hip else w*.5
    def pt(xx,t,side):
        edge=abs(xx)/(w*.5)
        zz=z+rise*(1-t)**.76+.13*t**6+.20*max(0,(edge-.8)/.2)**2*t**3
        xx2=xx*((1-t)*ridgehalf/(w*.5)+t)
        return (x+xx2,y+side*t*d*.5,zz)
    n=12
    for side in [-1,1]:
        cuts=16
        vv=[pt(-w*.5+w*j/cuts,i/n,side) for i in range(n+1) for j in range(cuts+1)]
        faces=[]
        for i in range(n):
            for j in range(cuts):
                k=i*(cuts+1)+j
                faces.append((k,k+1,k+cuts+2,k+cuts+1))
        mesh(vv,faces,mat)
        if tiles:
            cols=max(8,int(w/.16))
            for k in range(cols+1):
                xx=-w/2+k*w/cols
                points=[pt(xx,t/12,side) for t in range(13)]
                line(points,.026,'tilerib',5)
            for j in range(1,10):
                t=j/10
                line([pt(-w/2+u*w/20,t,side) for u in range(21)],.009,'tile',4)
        edge=[pt(-w/2+u*w/20,1,side) for u in range(21)]
        line(edge,.065,'tilerib',8)
        mesh(edge+[(a,b,c-.11) for a,b,c in edge],[(j,j+1,22+j,21+j) for j in range(20)],'timber')
    if hip:
        # Each curved end shares both hip curves with the adjacent slopes.
        for side in [-1,1]:
            def end_point(t,u):
                return (x+side*(ridgehalf*(1-t)+w*.5*t),y+d*.5*t*u,
                        z+rise*(1-t)**.76+.13*t**6+.20*abs(u)**4*t**3)
            vv=[end_point(0,0)]
            for i in range(1,n+1):
                vv.extend(end_point(i/n,j/6-1) for j in range(13))
            faces=[(0,1+j,2+j) for j in range(12)]
            for i in range(n-1):
                for j in range(12):
                    k=1+i*13+j
                    faces.append((k,k+1,k+14,k+13))
            mesh(vv,faces,mat)
            for u in [-1,1]:
                line([end_point(i/n,u) for i in range(n+1)],.063,'tilerib',8)
            if tiles:
                for j in range(1,20):
                    line([end_point(i/n,j/10-1) for i in range(2,n+1)],.022,'tilerib',5)
            line([end_point(1,j/6-1) for j in range(13)],.061,'tilerib',7)
    else:
        for side in [-1,1]:
            line([(x+side*w/2,y-d/2,z+.14),(x+side*w/2,y,z+rise+.04),
                  (x+side*w/2,y+d/2,z+.14)],.075,'tilerib',8)
    line([(x-ridgehalf,y,z+rise+.06),(x+ridgehalf,y,z+rise+.06)],.087,'tilerib',10)
    for side in [-1,1]:
        line([(x+side*(ridgehalf-.17),y,z+rise+.08),(x+side*(ridgehalf+.12),y,z+rise+.19)],.065,'tile',8)

def timber_house(x,y,z,w=4,d=3,h=2.5,floors=1,hip=False,plaster=True):
    front=y-d/2
    box((x,y,z+h/2),(w,d,h),'plaster' if plaster else 'wood')
    box((x,y,z+.13),(w+.12,d+.12,.26),'stone')
    for floor in range(floors):
        zz=z+floor*h/floors
        box((x,front-.08,zz+.12),(w,.12,.15),'timber')
        for i in range(6):
            xx=x-w*.5+i*w/5
            box((xx,front-.12,zz+h/floors*.5),(.10,.13,h/floors),'timber')
        for i in range(4):window(x-w*.35+i*w*.235,front-.11,zz+h/floors*.57,w*.17,h/floors*.42)
    door(x,front-.14,z+.25,w*.20,min(1.7,h/floors*.8))
    for side in [-1,1]:
        for j in range(1,4):box((x+side*(w/2+.012),y-d/2+j*d/4,z+h/2),(.05,.08,h),'timber')
    roof(x,y,z+h,w+.65,d+.7,min(1.35,w*.22),hip)

def fence(a,b,z,h=.8,mat='timber',spacing=.32):
    ax,ay=a;bx,by=b;length=math.hypot(bx-ax,by-ay);n=max(1,int(length/spacing))
    for i in range(n+1):
        t=i/n;beam((ax+(bx-ax)*t,ay+(by-ay)*t,z),(ax+(bx-ax)*t,ay+(by-ay)*t,z+h),.035,mat,6)
    for zz in [z+.13,z+h]:beam((ax,ay,zz),(bx,by,zz),.047,mat,6)

def arch(x,y,z,w,h,depth=.25,mat='lightstone'):
    spring=h-w/2
    for side in [-1,1]:box((x+side*(w/2+.09),y,z+spring/2),(.18,depth,spring),mat)
    n=16
    for i in range(n):
        t0=i*PI/n;t1=(i+1)*PI/n;outer=w/2+.19;inner=w/2
        poly=[(x+math.cos(t0)*inner,z+spring+math.sin(t0)*inner),
              (x+math.cos(t1)*inner,z+spring+math.sin(t1)*inner),
              (x+math.cos(t1)*outer,z+spring+math.sin(t1)*outer),
              (x+math.cos(t0)*outer,z+spring+math.sin(t0)*outer)]
        vv=[(xx,yy,zz) for yy in [y-depth/2,y+depth/2] for xx,zz in poly]
        mesh(vv,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat)
        # Solid spandrel above the curved opening gives the arcade a readable silhouette.
        top=z+h+.20
        poly2=[poly[0],poly[1],(poly[1][0],top),(poly[0][0],top)]
        vv2=[(xx,yy,zz) for yy in [y-depth/2+.01,y+depth/2] for xx,zz in poly2]
        mesh(vv2,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat)

def leaf_blob(c,s,mat='foliage'):
    x,y,z=c;sx,sy,sz=s;n=9;vv=[(x,y,z+sz*.6)]
    for k in range(1,5):
        t=k*PI/5
        for i in range(n):
            a=i*2*PI/n+.2*k;r=1+.14*math.sin(i*3.7+k*2)
            vv.append((x+sx*.5*math.sin(t)*math.cos(a)*r,y+sy*.5*math.sin(t)*math.sin(a)*r,z+sz*.55*math.cos(t)))
    vv.append((x,y,z-sz*.55));f=[]
    for i in range(n):f.append((0,1+i,1+(i+1)%n))
    for k in range(3):
        for i in range(n):
            a=1+k*n+i;b=1+k*n+(i+1)%n;f.extend([(a,b,b+n),(a,b+n,a+n)])
    for i in range(n):f.append((len(vv)-1,1+3*n+(i+1)%n,1+3*n+i))
    mesh(vv,f,mat)

def tree(x,y,z,h=4,spread=3):
    beam((x,y,z),(x+.12,y+.08,z+h*.75),h*.058,'wood',9,r2=h*.023)
    for i in range(8):
        a=i*2.399;rr=spread*.33*(.7+R.random()*.4)
        end=(x+math.cos(a)*rr,y+math.sin(a)*rr,z+h*(.68+.21*R.random()))
        start=(x+.10,y+.06,z+h*(.4+.035*i))
        beam(start,end,h*.025,'wood',7,r2=.025)
        for j in range(3):
            aa=a+j*1.9
            p=(end[0]+math.cos(aa)*spread*.16,end[1]+math.sin(aa)*spread*.16,end[2]+(.2 if j==1 else -.1))
            beam(end,p,.022,'wood',6)
            leaf_blob(p,(spread*.53,spread*.48,h*.24),'leaflight' if (i+j)%4==0 else 'foliage')

def bush(x,y,z,s=.6):leaf_blob((x,y,z+s*.3),(s,s*.8,s*.65),'leaflight')

def reeds(x,y,z,s=1):
    for i in range(7):
        a=i*2.4;dx=math.cos(a)*s*.20;dy=math.sin(a)*s*.20;h=s*(.55+.3*R.random())
        line([(x+dx,y+dy,z),(x+dx*1.3,y+dy*1.3,z+h*.6),(x+dx*2,y+dy*2,z+h)],.012,'foliage',5)
        for j in [-1,1]:line([(x+dx,y+dy,z+h*.45),(x+dx+j*.18*s,y+dy,z+h*.72)],.014,'leaflight',4)

def jar(x,y,z,r=.25,h=.45,mat='wood'):
    n=14;profiles=[(0,.65),(.08,1),(.62,1),(.85,.76),(1,.65)];v=[]
    for zz,rr in profiles:
        v.extend([(x+math.cos(i*2*PI/n)*r*rr,y+math.sin(i*2*PI/n)*r*rr,z+zz*h) for i in range(n)])
    f=[]
    for k in range(4):
        f.extend([(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for i in range(n)])
    f.append(tuple(range(n*4,n*5)));mesh(v,f,mat)
    for zz in [.18,.7]:
        line([(x+math.cos(i*2*PI/14)*r*1.02,y+math.sin(i*2*PI/14)*r*1.02,z+zz*h) for i in range(15)],.018,'timber',5)

def crates(x,y,z,n=4):
    for i in range(n):
        xx=x+(i%3)*.48;yy=y+(i//3)*.50;h=.38
        box((xx,yy,z+h/2),(.43,.43,h),'wood')
        for off in [-.13,.13]:box((xx+off,yy-.23,z+h/2),(.027,.025,h),'timber')
        for off in [-.12,.12]:box((xx,yy-.23,z+h/2+off),(.43,.025,.025),'timber')

def person(x,y,z,h=1.35,pose=0):
    # Subtle anonymous civilians provide scale; no uniforms or weaponry.
    mat='timber';part0=PART
    for s in [-1,1]:
        beam((x+s*.08,y,z+.05),(x+s*.095,y,z+h*.43),.055,mat,7)
        box((x+s*.08,y-.06,z+.04),(.13,.24,.08),mat)
    beam((x,y,z+h*.42),(x,y,z+h*.78),.14,'wood',9,r2=.115)
    for s in [-1,1]:
        elbow=(x+s*.24,y-.02,z+h*.55)
        beam((x+s*.11,y,z+h*.71),elbow,.043,mat,7)
        beam(elbow,(x+s*.24,y-.09,z+h*(.49 if pose==0 else .7)),.035,mat,7)
    rock((x,y,z+h*.9),(.105,.10,.23),'sand')
    beam((x,y,z+h*.98),(x,y,z+h*1.01),.145,'cloth',12)

def water(w,d,y=0,z=.33):
    part('water_and_ripples');box((0,y,z-.055),(w,d,.07),'water')
    nx=max(32,int(w*5));ny=max(24,int(d*5));vv=[]
    def level(x,yy):return z+.010*math.sin(x*5.4+yy*6.7)+.007*math.cos(x*2.1-yy*9.1)
    for j in range(ny+1):
        yy=y-d/2+j*d/ny
        for i in range(nx+1):
            xx=-w/2+i*w/nx;vv.append((xx,yy,level(xx,yy)))
    ff=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;ff.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
    mesh(vv,ff,'water')
    for i in range(int(w*d*2.0)):
        x=R.uniform(-w*.48,w*.48);yy=y+R.uniform(-d*.47,d*.47);length=R.uniform(.14,.68)
        pts=[]
        for j in range(6):
            xx=x-length/2+j*length/5;yt=yy+math.sin(j*.64+i)*.045
            pts.append((xx,yt,level(xx,yt)+.014))
        line(pts,.010,'ripple',4)

def slope_bank(w,edge,back,low=.35,high=1.2,mat='sand'):
    """Undulating shore, gravel beach, and rising bank without a rectangular cut edge."""
    side=1 if back>edge else -1;nx=54;ny=8;v=[]
    def shoreline(x):return edge+.22*math.sin(x*1.25)+.14*math.cos(x*2.7)+.08*math.sin(x*5)
    def height(x,t):return low+(high-low)*t**.76+.10*math.sin(x*.9)*t+.04*math.sin(x*3.3)*math.sin(t*PI)
    for j in range(ny+1):
        t=j/ny
        for i in range(nx+1):
            x=-w/2+i*w/nx;ed=shoreline(x);yy=ed+(back-ed)*t
            v.append((x,yy,height(x,t)))
    f=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;f.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
    mesh(v,f,mat)
    # Vertical exposed substrate closes the perimeter at the outside of the diorama.
    for ind in [list(range(nx+1)),list(range(ny*(nx+1),(ny+1)*(nx+1))),
                [j*(nx+1) for j in range(ny+1)],[j*(nx+1)+nx for j in range(ny+1)]]:
        pp=[v[i] for i in ind];mesh(pp+[(p[0],p[1],.28) for p in pp],
          [(i,i+1,len(pp)+i+1,len(pp)+i) for i in range(len(pp)-1)],mat)
    for i in range(115):
        x=R.uniform(-w*.48,w*.48)
        if abs(x)<1.8:continue
        t=R.uniform(.0,.67);yy=shoreline(x)+(back-shoreline(x))*t;zz=height(x,t)
        scale=R.uniform(.07,.25)
        rock((x,yy,zz+scale*.2),(scale*1.2,scale,scale*.7),'lightstone' if i%3 else 'stone')
        if i%8==0:reeds(x,yy,zz,.40+R.random()*.35)
    return shoreline,height

def boat(x,y,z,L=4,W=1.25,a=0,canopy=False,railing=False):
    # A genuinely hollow planked wooden hull with ribs, gunwales, and seats.
    ca,sa=math.cos(a),math.sin(a)
    def tr(p):u,v,k=p;return(x+u*ca-v*sa,y+u*sa+v*ca,z+k)
    n=24;v=[]
    for ring,(scale,zz) in enumerate([(.65,-.12),(1,.28),(.89,.265),(.58,-.035)]):
        for i in range(n):
            t=i*2*PI/n;u=math.cos(t)*L*.5*scale;vv=math.sin(t)*W*.5*scale
            height=zz+.22*abs(math.cos(t))**6
            v.append(tr((u,vv,height)))
    f=[]
    for k in range(3):
        for i in range(n):f.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    f.append(tuple(range(n*3,n*4)));mesh(v,f,'wood')
    for scale,zz in [(1,.3),(.91,.28)]:
        line([tr((math.cos(i*2*PI/n)*L*.5*scale,math.sin(i*2*PI/n)*W*.5*scale,
                   zz+.22*abs(math.cos(i*2*PI/n))**6)) for i in range(n+1)],.045,'timber',7)
    for k in range(9):
        u=-L*.35+k*L*.7/8;wid=W*.82*math.sqrt(max(.1,1-(u/(L*.48))**2))
        # hull ribs inside, and cross benches as separate wood components
        if k%2==0:
            beam(tr((u,-wid*.5,.19)),tr((u,wid*.5,.19)),.065,'wood',4)
        line([tr((u,-wid*.5,.19)),tr((u,-wid*.36,0)),tr((u,wid*.36,0)),tr((u,wid*.5,.19))],.026,'timber',6)
    for k in range(7):
        vv=-W*.25+k*W*.5/6
        beam(tr((-L*.35,vv,-.015)),tr((L*.35,vv,-.015)),.018,'timber',4)
    if railing:
        for side in [-1,1]:
            for k in range(6):
                u=-L*.34+k*L*.68/5
                beam(tr((u,side*W*.38,.20)),tr((u,side*W*.38,.92)),.025,'wood',6)
            beam(tr((-L*.34,side*W*.38,.92)),tr((L*.34,side*W*.38,.92)),.035,'wood',6)
    if canopy:
        # Woven barrel shelter, as in the river-town reference.
        length=L*.49;nr=10;vv=[]
        for end in [-length/2,length/2]:
            for j in range(nr+1):
                t=j*PI/nr
                vv.append(tr((end,math.cos(t)*W*.44,.34+math.sin(t)*W*.59)))
        mesh(vv,[(j,j+1,nr+2+j,nr+1+j) for j in range(nr)],'cloth')
        for k in range(7):
            u=-length/2+k*length/6
            line([tr((u,math.cos(j*PI/nr)*W*.45,.34+math.sin(j*PI/nr)*W*.60)) for j in range(nr+1)],.025,'wood',6)
    # Long sweep oar and its blade.
    line([tr((L*.30,W*.15,.35)),tr((L*.62,W*.9,.20))],.025,'timber',7)
    beam(tr((L*.62,W*.9,.20)),tr((L*.73,W*1.12,.14)),.065,'wood',4)
    return tr

def roof_gate(x,y,z,w=2.6):
    for side in [-1,1]:
        box((x+side*w*.39,y,z+1.05),(.25,.30,2.1),'lightstone')
        box((x+side*w*.39,y,z+.1),(.45,.48,.2),'stone')
    box((x,y,z+1.95),(w,.38,.22),'timber');roof(x,y,z+2.12,w+.55,1.35,.58)

def flag(x,y,z,h=2.2):
    beam((x,y,z),(x,y,z+h),.025,'wood',7)
    v=[(x,y,z+h-.07),(x+.6,y-.03,z+h-.16),(x+.57,y+.035,z+h-.54),(x,y,z+h-.43)]
    mesh(v,[(0,1,2,3)],'red')

def ruijin():
    slab(17,15);part('yunshishan_cliff')
    mound(0,.6,.28,15,12,3.3)
    for i in range(38):
        t=i*2.399;x=math.cos(t)*R.uniform(4.8,7);y=.7+math.sin(t)*R.uniform(3.8,5.4)
        rock((x,y,1.6),(.6+R.random(),.6+R.random(),2.1+R.random()*1.4))
    part('temple_courtyard');poly_prism([(-5,-2.7),(5,-2.7),(5,4.4),(-5,4.4)],3.28,3.6,'lightstone')
    stones(-4.7,4.7,-2.4,4.2,3.62,.5)
    for side in [-1,1]:
        masonry(side*4.9,.1,3.6,.25,5.8,.75)
    timber_house(0,2.8,3.6,7.6,3.3,2.7,hip=False)
    for x in [-2.8,-1.4,0,1.4,2.8]:
        beam((x,.8,3.6),(x,.8,6.24),.10,'timber',10)
        beam((x,.8,5.7),(x+(.34 if x<2 else -.34),.8,6.1),.045,'wood',6)
    for x in [-1.15,1.15]:box((x,.64,5.4),(.18,.07,1.25),'red')
    timber_house(-3.7,-.05,3.6,2.1,3.0,1.9)
    timber_house(3.7,-.05,3.6,2.1,3.0,1.9)
    part('winding_stone_stair');stairs(2,-6.5,.28,2.4,18,.23,.18)
    roof_gate(2,-2.36,3.50,2.7)
    part('ancient_pines');tree(-5.7,3.7,2.7,5.9,4.9);tree(5.5,3.4,2.6,4.6,3.4);tree(-6,-3.5,.8,3.9,3.7)
    for i in range(30):
        t=i*2.4;bush(math.cos(t)*R.uniform(5,7),math.sin(t)*R.uniform(4,6),.4+R.random()*.4,.4+R.random()*.5)
    part('courtyard_objects');jar(0,-.3,3.6,.34,.65,'iron');person(-1.4,-1.1,3.65);person(2,-4.9,1.5)

def yudu():
    slab(19,15);water(18.7,10,-1.8)
    part('earthen_banks');slope_bank(18.6,-5.15,-7.2,.33,1.25);slope_bank(18.6,3.55,7.2,.33,1.45)
    part('stone_landings');stairs(.80,3.7,.60,2.65,8,.30,.11)
    # Exposed weathered stones at the pontoon ends, then uneven footpaths inland.
    masonry(.8,3.63,.34,2.7,.70,.68)
    masonry(-.9,-5.2,.33,2.7,.62,.67)
    for i in range(5):
        yy=-5.4-i*.28
        box((-.9,yy,.92+i*.08),(2.6,.27,.12),'lightstone')
    part('civilian_boat_pontoon')
    # Bridge is skewed gently across the water, not a repetition of the old bridge mesh.
    for i in range(7):
        yy=-4.7+i*1.35;xx=.18*yy
        boat(xx,yy,.46,3.8,1.02,0)
    for k in range(66):
        yy=-5.2+k*.15;xx=.18*yy
        box((xx,yy,.99),(2.40,.139,.09),'wood' if k%4 else 'paper')
        for s in [-1,1]:
            beam((xx+s*1.05,yy,.99),(xx+s*1.05,yy,1.04),.025,'iron',6)
    for yy in [-5,-3.5,-2,-.5,1,2.5,4]:
        xx=.18*yy
        for s in [-1,1]:beam((xx+s*1.22,yy,.87),(xx+s*1.22,yy,1.85),.045,'timber',7)
    for s in [-1,1]:line([(.18*yy+s*1.22,yy,1.70) for yy in [-5,-3.5,-2,-.5,1,2.5,4]],.018,'wood',6)
    part('riverbank_life');person(-2.5,-6.6,1.0);person(.7,6.2,1.5);crates(3,6.1,1.25,6)
    for i in range(28):
        side=-1 if i%2 else 1;x=R.uniform(-8.5,8.5);y=R.uniform(5.2,6.8)*side
        if abs(x)<2:continue
        rock((x,y,.48),(.15+R.random()*.3,.15+R.random()*.2,.15+R.random()*.15),'lightstone')
        if i%3==0:reeds(x,y,.65,.6)
    tree(-6,5.7,1.08,2.9,3.2)
    for i in range(7):
        a=i*2.399
        line([(-6,5.7,1.15),(-6+math.cos(a)*.45,5.7+math.sin(a)*.45,.97),
              (-6+math.cos(a)*.95,5.7+math.sin(a)*.95,.82)],.055,'wood',7)
    part('mooring_ropes_and_posts')
    for x,y in [(-2.1,-5.5),(2.2,4.5)]:
        beam((x,y,.45),(x,y,1.5),.085,'wood',9)
        line([(x,y,1.25),(x*.75,y*.8,.86),(x*.45,y*.65,.8)],.025,'wood',6)
        for j in range(4):
            rr=.13+j*.045
            line([(x+.2+math.cos(k*2*PI/20)*rr,y+.05+math.sin(k*2*PI/20)*rr,1.0) for k in range(21)],.016,'wood',6)

def xiangjiang():
    slab(21,15);water(20.7,14.6,0)
    part('xiangjiang_gravel_bars')
    poly_prism([(-10,5),(0,3.2),(7,4.5),(10,3.9),(10,7.2),(-10,7.2)],.30,.58,'sand')
    poly_prism([(-10,-7.2),(-3,-7.2),(-5,-4.6),(-10,-2.8)],.30,.75,'sand')
    for i in range(200):
        x=R.uniform(-9.8,9.8);y=R.uniform(4.7,7.1)
        rock((x,y,.61),(.05+R.random()*.12,.06+R.random()*.10,.05+R.random()*.09),'lightstone')
    part('canopy_ferry_and_supplies');tr=boat(1,-1,.45,8.5,2.1,.10,False,True)
    # Large open deck canopy, visually different from the covered cargo boats.
    for u in [-2.3,0,2.3]:
        for v in [-.81,.81]:beam(tr((u,v,.3)),tr((u,v,2.0)),.05,'timber',8)
    vv=[tr((-2.65,-1,1.92)),tr((2.65,-1,1.92)),tr((2.65,1,2.12)),tr((-2.65,1,2.12))]
    mesh(vv,[(0,1,2,3)],'cloth')
    for k in range(17):
        u=-2.65+k*5.3/16;beam(tr((u,-1,1.93)),tr((u,1,2.13)),.025,'wood',6)
    for i in range(10):
        p=tr((-2+i*.43,-.1,.30));jar(*p,.15,.32,'sand')
    for u in [-1,1,3.2]:
        p=tr((u,0,.26));person(*p,1.22)
    person(-7,-5.5,.75);part('willow_and_reeds');tree(-7.5,5.5,.6,2.3,3.4)
    for i in range(18):reeds(R.uniform(-9,-6),R.uniform(-6.7,-3.5),.75,.8)

def horsewall(x,y,z,d,h):
    part0=PART
    box((x,y,z+h/2),(.27,d,h),'plaster')
    for s in [-1,1]:
        box((x,y+s*d*.34,z+h+.18),(.32,d*.32,.36),'plaster')
        box((x,y+s*d*.34,z+h+.39),(.48,d*.35,.09),'tile')
    box((x,y,z+h+.48),(.32,d*.34,.96),'plaster')
    box((x,y,z+h+.99),(.48,d*.39,.10),'tile')

def liping():
    slab(19,15);part('rising_qiaojie_steps');stairs(2.7,-6.9,.28,3.3,28,.47,.115)
    for i,(x,y,z,w,d) in enumerate([(-5.6,-4.9,.28,3.7,3.1),(-4.8,-1.2,1.1,4.3,3.4),(-3.7,2.7,1.85,4.8,3.6),(-2.7,6,2.65,4.8,2.1)]):
        part('merchant_house_'+str(i))
        if z>.3:
            masonry(x,y,.28,w+.22,d+.24,z-.28)
            stones(x-w/2-.12,x+w/2+.12,y-d/2-.4,y+d/2+.12,z,.43)
        timber_house(x,y,z,w,d,3.45 if i else 2.4,2 if i else 1)
        horsewall(x-w/2,y,z,d,4.0 if i else 2.8);horsewall(x+w/2,y,z,d,4.0 if i else 2.8)
        # side-facing storefront towards the stair street, with detached awning
        front=y-d/2
        mat='red' if i==1 else 'cloth'
        mesh([(x-w*.4,front-.05,z+1.8),(x+w*.4,front-.05,z+1.8),
              (x+w*.4,front-.85,z+1.55),(x-w*.4,front-.85,z+1.55)],[(0,1,2,3)],mat)
        for xx in [x-w*.4,x+w*.4]:beam((xx,front-.85,z+.1),(xx,front-.85,z+1.55),.035,'timber',7)
        crates(x-w*.32,front-.5,z+.1,4)
        for k in range(3):jar(x+w*.15+k*.35,front-.5,z+.06,.14,.33)
    part('rear_courtyard_wing');timber_house(4.9,5.1,3.05,3.0,3.6,3.3,2)
    masonry(4.9,5.1,.28,3.12,3.73,2.77)
    part('retaining_wall');masonry(5.6,.4,.28,3.2,10.4,2.15)
    stones(4.3,7.05,-4.6,5.3,2.45,.45)
    person(2.8,-4.5,.95);person(2.7,2.4,2.60);person(-5.4,-6.8,.28)

def zunyi():
    slab(18,14);part('stone_forecourt');stones(-8.5,8.5,-6.5,5.8,.31,.66)
    masonry(0,.7,.32,13.2,7.2,.47)
    part('conference_main_building');w=11.8;d=5.7;z=.79;h=5.45;front=-2.65
    box((0,1,z+1.30),(w,4.5,2.60),'plaster')
    part('meeting_room_walls')
    box((0,3.18,4.76),(w,.14,2.65),'limewash')
    box((-5.82,1,4.76),(.15,4.48,2.65),'limewash')
    box((0,1,3.416),(11.65,4.55,.07),'wood')
    part('upper_cut_wall')
    box((5.82,1,4.76),(.16,4.48,2.65),'limewash')
    for i in range(8):
        box((-5.6+i*1.60,-1.22,4.76),(.48,.17,2.62),'greybrick')
    box((0,-1.22,3.68),(w,.17,.50),'greybrick')
    box((0,-1.22,5.86),(w,.17,.47),'greybrick')
    # True open two-storey perimeter arcades, not painted-on arch textures.
    for level in [0,1]:
        part('upper_cut_gallery' if level else 'conference_main_building')
        zz=z+level*2.65
        for i in range(8):
            xx=-5.6+i*1.6
            box((xx,front,zz+.90),(.23,.35,1.80),'lightstone')
            box((xx,front,zz+.12),(.40,.52,.23),'stone')
            box((xx,front,zz+2.13),(.39,.47,.18),'lightstone')
        for i in range(7):
            xx=-4.8+i*1.6
            arch(xx,front-.08,zz+.10,1.36,2.35,.38)
            if level: fence((xx-.68,front),(xx+.68,front),zz+.12,.85,spacing=.15)
            window(xx,-1.275,zz+1.25,1.05,1.55,False)
        # Floor and cornices wrap around the building.
        box((0,.3,zz+2.52),(13.15,5.95,.18),'lightstone')
        for side in [-1,1]:
            for j in range(3):
                yy=-1.2+j*1.8
                box((side*6.0,yy,zz+1.15),(.27,.25,2.3),'lightstone')
            for j in range(2):
                # Arch side wall is rotated 90 degrees via batching transform.
                old_keys={k:(len(v[0]),len(v[1])) for k,v in B.items()}
                arch(0,0,zz+.1,1.56,2.35,.3)
                for key,(vv,ff) in B.items():
                    start=old_keys.get(key,(0,0))[0]
                    for q in range(start,len(vv)):
                        px,py,pz=vv[q];vv[q]=(side*6+py,-.3+j*1.8+px,pz)
            if level:fence((side*6,-2.5),(side*6,3.3),zz+.12,.85,spacing=.17)
    door(0,-1.29,.80,1.35,2.0,True)
    part('tiled_hip_roof_and_dormer');roof(0,.3,6.29,14.0,7.0,1.85,True)
    # Researched dormer survives as a small feature above the front slope.
    box((1.9,-1.4,7.05),(1.05,.74,.68),'plaster');window(1.9,-1.80,7.08,.65,.50,False)
    roof(1.9,-1.42,7.42,1.55,1.23,.46)
    part('external_turning_stair');stairs(-6.9,-2.3,.79,1.05,15,.23,.177,True)
    box((-6.9,1.30,3.5),(1.4,1.3,.15),'wood');fence((-7.4,.9),(-7.4,2),3.54,.8)
    part('entry_steps');stairs(0,-4.6,.31,3.0,4,.40,.12)
    part('courtyard_life');tree(-7.5,3.4,.31,3.4,2.7);tree(7.5,3.9,.31,3.1,2.8)
    for xx in [-4.5,4.5]:jar(xx,-4.65,.32,.38,.43,'stone');bush(xx,-4.65,.75,1.1)
    person(.55,-4.4,.32);person(1.2,-4.1,.32)

def chishui():
    slab(21,16);water(20.7,5.8,-4.8)
    part('tucheng_granite_quay');masonry(0,1.5,.31,20,8.2,2.1)
    stones(-9.7,9.7,-2.3,5.4,2.43,.58)
    # Broad water steps interrupt the wall, terracing all the way to the river.
    stairs(2.1,-5.6,.36,4.1,12,.29,.173)
    part('riverside_shopfronts')
    for i,(x,y,w,d,h,f) in enumerate([(-6.9,0,4.0,3.1,3.7,2),(-2.8,.8,4.3,3.4,4.3,2),(5.7,1,4.0,3.4,3.5,2)]):
        timber_house(x,y,2.43,w,d,h,f,False,False)
        front=y-d/2
        for xx in [x-w*.42,x+w*.42]:beam((xx,front-.65,2.43),(xx,front-.65,4.16),.06,'timber',8)
        mesh([(x-w*.47,front,4.4),(x+w*.47,front,4.4),(x+w*.47,front-.9,4.07),(x-w*.47,front-.9,4.07)],[(0,1,2,3)],'red' if i==1 else 'cloth')
        crates(x-w*.3,front-.6,2.43,5)
    part('upper_hillside_houses');mound(0,5.5,2.1,19,5,2.5,'stone')
    timber_house(-4.2,5.2,3.4,3.7,2.8,2.6);timber_house(2.0,5.3,4.1,3.8,2.7,2.5);timber_house(7,5.3,3.2,2.9,2.6,2.7)
    part('canopied_river_barges');boat(-5.3,-5.2,.49,6.1,1.55,.04,True);boat(6.5,-5.25,.49,5.7,1.45,-.1,True)
    part('old_town_trees');tree(-8,5,3.2,4.0,3.9);tree(.5,6.2,4.3,3,3.7)
    person(2,-3.7,1.47);person(2.5,-1.1,2.43);person(-2,-2.15,2.43)

def cave(x,y,z,w=1.3,h=1.7,depth=1.7):
    # The front opening is empty; floor, vaulted tunnel, and dark rear wall are geometry.
    n=16;spring=h-w*.5;vv=[]
    for yy in [y,y+depth]:
        for i in range(n+1):
            a=i*PI/n;vv.append((x+math.cos(a)*w/2,yy,z+spring+math.sin(a)*w/2))
    mesh(vv,[(i,i+1,n+2+i,n+1+i) for i in range(n)],'rock')
    for s in [-1,1]:box((x+s*w/2,y+depth/2,z+spring/2),(.13,depth,spring),'rock')
    box((x,y+depth,z+h/2),(w,.10,h),'recess');box((x,y+depth/2,z+.03),(w,depth,.07),'sand')
    # Fractured natural lip around each aperture, avoiding a regular masonry arch.
    for i in range(8):
        a=i*PI/7
        rock((x+math.cos(a)*(w*.5+.12),y+.06,z+spring+math.sin(a)*(w*.5+.12)),
             (.21,.25,.26),'stone')

def jiaoping():
    slab(22,16);water(21.7,9.5,-3.0)
    part('jinsha_canyon_left');cliff(-8,4.3,.29,7.3,6.4,8.0)
    part('jinsha_canyon_right');cliff(8,4.8,.29,6.8,5.8,7.0)
    for side in [-1,1]:
        for i in range(14):rock((side*(7+R.random()*2.4),2+R.random()*4.8,2.2+R.random()*3.8),(.7+R.random(),.9,2.2),'rock')
    part('historic_cave_bank');poly_prism([(-7,0),(6,0),(8,2.2),(5.3,4.2),(-7,4)],.29,.78,'sand')
    # Segmented overburden, leaving real apertures between structural rock piers.
    for i in range(5):
        x=-4.4+i*2.0;cave(x,1.8,.77,1.35,1.75,1.3)
        rock((x,3,3.15),(1.2,1.5,1.45),'rock')
        if i<4:rock((x+1.0,2.6,1.9),(.36,1.0,2.4),'stone')
    part('boatmen_and_ferries');boat(-3.7,-3.7,.48,6,1.6,.12,False,True);boat(4,-1.7,.48,4.8,1.4,-.27,False,True)
    for i in range(50):
        x=R.uniform(-6,7);y=R.uniform(-.1,1.5);rock((x,y,.78),(.12+R.random()*.22,.10+R.random()*.2,.14),'lightstone')
    crates(4.8,.5,.8,7);person(2,.7,.80);person(3,.9,.8);flag(-1.2,1.2,.77,1.75)

def anshun():
    slab(20,15);water(19.7,9.5,2.1)
    part('anshun_pebble_beach');poly_prism([(-9.7,-7.2),(9.7,-7.2),(9.7,-2.2),(5.5,-.2),(0,-1.6),(-5,1),(-9.7,.5)],.29,.63,'sand')
    for i in range(250):
        x=R.uniform(-9.4,9.4);y=R.uniform(-6.95,-1.7)
        rock((x,y,.67),(.11+R.random()*.26,.10+R.random()*.25,.12+R.random()*.17),'lightstone' if i%3 else 'stone')
    part('ferry_shelter');x=-5;y=-1.2;z=.68
    for xx in [-6.8,-3.2]:
        for yy in [-2.7,.1]:beam((xx,yy,z),(xx,yy,z+2.4),.085,'timber',9)
    box((x,y,z+.7),(3.6,2.8,.16),'wood')
    for xx in [-6.7,-3.3]:box((xx,y,z+1.2),(.12,2.8,.85),'wood')
    for xx in [-6.55,-6,-5.45,-4.9,-4.35,-3.8,-3.3]:window(xx,-2.65,z+1.72,.40,.63)
    # Visibly fibrous straw roof, rather than a tiled house reused here.
    roof(x,y,z+2.4,4.9,4.0,1.12,False,'cloth',False)
    for i in range(90):
        xx=-7.4+i*4.8/89
        for side in [-1,1]:
            line([(xx,y,z+3.52),(xx+.03,y+side*1.0,z+2.9),(xx+.05,y+side*2,z+2.5+R.random()*.12)],.023,'wood',5)
    crates(-6.3,-3.3,.7,6);jar(-3.25,-2.2,.7,.30,.52,'cloth');jar(-3.5,-3.0,.7,.22,.47)
    box((-4.1,-2.82,2.62),(.14,.04,.75),'red')
    part('anshun_ferry');boat(3.9,.1,.48,7.9,1.75,.18,False,True)
    # Short landing of separate planks, with open supporting posts.
    for i in range(10):box((.2,-2.0+i*.19,.97),(1.4,.17,.08),'wood')
    for yy in [-2.0,-.4]:
        for xx in [-.65,.95]:beam((xx,yy,.37),(xx,yy,1.9),.045,'wood',7)
    part('river_people');person(-1.9,-4.8,.75);person(.1,-1.4,1.02);person(6.5,.3,.82)
    tree(-8.3,4.4,.5,3.4,3.8)

def chain(points,r=.037,links=100):
    # Alternating individual oval links, so the thirteen chains read as ironwork.
    for k in range(links):
        t=k/(links-1);i=min(len(points)-2,int(t*(len(points)-1)));u=t*(len(points)-1)-i
        p=Vector(points[i]).lerp(Vector(points[i+1]),u);tangent=(Vector(points[i+1])-Vector(points[i])).normalized()
        axis=Vector((0,0,1)) if k%2==0 else Vector((0,1,0));normal=tangent.cross(axis).normalized();up=normal.cross(tangent).normalized()
        # Link perimeter is a small oblong tube, eight circumference segments.
        ring=[p+tangent*(math.cos(j*2*PI/10)*.115)+up*(math.sin(j*2*PI/10)*.067) for j in range(11)]
        line([tuple(v) for v in ring],r,'iron',5)

def luding():
    slab(25,14);water(15.2,13.6,0)
    part('gorge_rock_banks')
    for side in [-1,1]:
        mound(side*10.0,1.8,.29,6.7,13,4.4)
        for i in range(15):rock((side*(8.9+R.random()*2.6),R.uniform(-6,6),1.2),(.5+R.random(),.7+R.random(),1.9+R.random()))
    part('stone_bridge_abutments')
    for side in [-1,1]:
        masonry(side*8.4,0,.3,2.8,4.1,3.45)
        stones(side*8.4-1.4,side*8.4+1.4,-2,2,3.78,.46)
    part('qing_bridge_pavilions')
    for side in [-1,1]:
        xx=side*8.6
        for dx in [-.85,.85]:
            for yy in [-1.45,1.45]:box((xx+dx,yy,4.85),(.23,.27,2.2),'plaster')
        for dx in [-.85,.85]:box((xx+dx,0,5.74),(.25,3.1,.32),'timber')
        roof(xx,0,5.95,3.1,4.0,1.0,True)
        box((xx,-1.56,5.65),(1.3,.06,.29),'timber')
        for dx in [-.65,.65]:box((xx+dx,-1.63,5.1),(.13,.05,.62),'red')
    part('thirteen_linked_iron_chains');span=14.3
    def zz(t):return 3.75-.91*(1-(2*t-1)**2)
    for i in range(9):
        yy=-1.08+i*2.16/8
        pts=[(-span/2+j*span/36,yy,zz(j/36)) for j in range(37)]
        chain(pts,.018,88)
    for side in [-1,1]:
        for level in [.70,1.33]:
            pts=[(-span/2+j*span/36,side*1.25,zz(j/36)+level) for j in range(37)]
            chain(pts,.022,88)
    part('wood_bridge_deck')
    for i in range(92):
        t=i/91;xx=-span/2+t*span
        box((xx,0,zz(t)+.09),(.145,2.39,.085),'wood' if i%5 else 'paper')
    part('chain_hangers')
    for i in range(36):
        t=i/35;xx=-span/2+t*span
        for side in [-1,1]:line([(xx,side*1.20,zz(t)+.1),(xx,side*1.25,zz(t)+1.33)],.021,'iron',6)
    part('bridge_travellers');person(-3.5,0,zz(.25)+.15,1.2);person(2.4,0,zz(.67)+.15,1.2)
    part('bank_trees');tree(-11,4.6,2.7,3.5,3.6);tree(11.1,5.1,2.8,3.6,3.5)

BUILDERS={k:v for k,v in list(globals().items()) if k in ['ruijin','yudu','xiangjiang','liping','zunyi','chishui','jiaoping','anshun','luding']}

def init_scene():
    global B
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);B={}
    for name,color in COLORS.items():
        if name not in MATS:
            m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
            bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if bs is None:
                bs=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
                output=next((n for n in m.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)
                if output is None:output=m.node_tree.nodes.new('ShaderNodeOutputMaterial')
                m.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
            bs.inputs['Base Color'].default_value=color;bs.inputs['Roughness'].default_value=.88
            bs.inputs['Specular IOR Level'].default_value=.22
            MATS[name]=m

def flush(sid):
    root=bpy.data.objects.new(sid+'_history_diorama',None);bpy.context.collection.objects.link(root)
    root['description']='Researched humanistic history scene; independently authored detailed geometry after project concept sheet.'
    for (section,mat),(v,f) in B.items():
        me=bpy.data.meshes.new(section+'_'+mat);me.from_pydata(v,[],f);me.materials.append(MATS[mat]);me.update()
        ob=bpy.data.objects.new(section+'_'+mat,me);bpy.context.collection.objects.link(ob);ob.parent=root
    return root

def render_preview(sid,path,root):
    scene=bpy.context.scene
    # Measure physical authoring bounds.
    coords=[obj.matrix_world @ Vector(c) for obj in root.children if obj.type=='MESH' for c in obj.bound_box]
    lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)));hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    center=(lo+hi)/2;extent=max(hi.x-lo.x,(hi.y-lo.y)*1.15,(hi.z-lo.z)*1.3)
    bpy.ops.object.camera_add(location=center+Vector((extent*.72,-extent*1.0,extent*.72)))
    cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=extent*1.25;scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=900;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.world.use_nodes=True
    bg=next((n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'),None)
    if bg:
        bg.inputs['Color'].default_value=(.79,.78,.74,1)
        bg.inputs['Strength'].default_value=.7
    bpy.ops.object.light_add(type='AREA',location=(center.x-7,center.y-9,center.z+18));lamp=bpy.context.object;lamp.data.energy=2200;lamp.data.shape='DISK';lamp.data.size=9
    bpy.ops.object.light_add(type='AREA',location=(center.x+8,center.y+4,center.z+12));bpy.context.object.data.energy=1700;bpy.context.object.data.size=12
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(path / (sid+'.png'))
    bpy.ops.render.render(write_still=True)

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    preview=None
    if '--preview-dir' in args:
        i=args.index('--preview-dir');preview=Path(args[i+1]);preview.mkdir(parents=True,exist_ok=True);args=args[:i]+args[i+2:]
    ids=args or list(BUILDERS);OUT.mkdir(parents=True,exist_ok=True);report=[]
    for sid in ids:
        if sid not in BUILDERS:raise ValueError(sid)
        R.seed(1934+list(BUILDERS).index(sid));init_scene();BUILDERS[sid]()
        # Clip submerged talus below the cut-paper base to the agreed ground plane.
        for vv,ff in B.values():
            for n,(x,y,z) in enumerate(vv):
                if z<0:vv[n]=(x,y,0)
        root=flush(sid)
        bpy.context.view_layer.update()
        vv=[v for pair in B.values() for v in pair[0]]
        lo=[min(p[i] for p in vv) for i in range(3)];hi=[max(p[i] for p in vv) for i in range(3)]
        target=OUT/(sid+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_apply=True,
                                  export_cameras=False,export_lights=False,export_extras=True,
                                  export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression')
        info={'id':sid,'blender_bounds':[lo,hi],'gltf_size':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],
              'vertices':sum(len(pair[0]) for pair in B.values()),'parts':len(B),'bytes':target.stat().st_size}
        report.append(info);print('HISTORY_MODEL '+json.dumps(info))
        if preview:render_preview(sid,preview,root)
    print('HISTORY_REPORT '+json.dumps(report))

if __name__=='__main__':main()
