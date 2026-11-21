"""North Long March historic dioramas. Run with Blender --background --python.

No scanned textures or modern monuments. Geometry is authored in metres, Blender
Z up, forward -Y; glTF export converts to Y up, front +Z. Base ground datum is 0.
Use -- [station ...] [--render] to limit export / render QA to the system temp dir.
"""
import bpy, math, random, json, sys, os, tempfile
from pathlib import Path
from mathutils import Vector
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'models' / 'history'
MATS = [
    ('Paper limestone', (.78,.77,.73,1)),
    ('Snow chalk', (.94,.93,.89,1)),
    ('Weathered ash timber', (.43,.43,.41,1)),
    ('Charcoal recess', (.105,.115,.12,1)),
    ('Pale shale', (.61,.61,.59,1)),
    ('Signal red cloth', (.56,.025,.022,1)),
    ('Still grey water', (.28,.32,.33,1)),
]
PAPER,SNOW,TIMBER,DARK,SHALE,RED,WATER = range(7)
SCENES = {}
RNG = random.Random(1935)

def reg(id, title, note):
    def decorate(fn): SCENES[id]=(title,note,fn); return fn
    return decorate

class Geo:
    def __init__(self): self.parts=defaultdict(lambda:[[],[]])
    def mesh(self, vs, fs, mat=PAPER):
        v,f=self.parts[mat]; start=len(v); v.extend(vs); f.extend(tuple(i+start for i in p) for p in fs)
    def box(self, pos, size, mat=PAPER, yaw=0):
        x,y,z=pos; w,d,h=[s/2 for s in size]; c,s=math.cos(yaw),math.sin(yaw)
        pts=[]
        for a,b,t in [(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)]:
            pts.append((x+a*c-b*s,y+a*s+b*c,z+t))
        self.mesh(pts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],mat)
    def beam(self, a,b,r,mat=TIMBER,sides=7,r2=None):
        a,b=Vector(a),Vector(b); axis=(b-a).normalized(); u=axis.cross(Vector((0,0,1)))
        if u.length<.01: u=axis.cross(Vector((0,1,0)))
        u.normalize(); v=axis.cross(u); r2=r if r2 is None else r2
        pts=[]
        for pt,rr in [(a,r),(b,r2)]:
            pts += [tuple(pt+rr*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides))) for i in range(sides)]
        faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        self.mesh(pts,faces,mat)
    def ball(self,p,scale,mat=PAPER,segments=10,rings=6,rough=0):
        pts=[]
        for j in range(rings+1):
            theta=math.pi*j/rings
            for i in range(segments):
                phi=math.tau*i/segments; rr=1+RNG.uniform(-rough,rough)
                pts.append((p[0]+scale[0]*math.sin(theta)*math.cos(phi)*rr,p[1]+scale[1]*math.sin(theta)*math.sin(phi)*rr,p[2]+scale[2]*math.cos(theta)*rr))
        self.mesh(pts,[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i) for j in range(rings) for i in range(segments)],mat)
    def poly(self,outline,z,h,mat=PAPER):
        n=len(outline); pts=[(x,y,z) for x,y in outline]+[(x,y,z+h) for x,y in outline]
        self.mesh(pts,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)
    def ribbon(self,path,width,mat=PAPER,thick=.025):
        vs=[]
        for i,p in enumerate(path):
            prv=path[max(0,i-1)]; nxt=path[min(len(path)-1,i+1)]
            dx,dy=nxt[0]-prv[0],nxt[1]-prv[1]; ln=math.hypot(dx,dy) or 1
            vs.extend([(p[0]-dy/ln*width/2,p[1]+dx/ln*width/2,p[2]+thick),(p[0]+dy/ln*width/2,p[1]-dx/ln*width/2,p[2]+thick)])
        self.mesh(vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(path)-1)],mat)

G=Geo()
def box(*a,**k): G.box(*a,**k)
def beam(*a,**k): G.beam(*a,**k)
def ball(*a,**k): G.ball(*a,**k)

def rock(x,y,z,s=1,mat=SHALE):
    ball((x,y,z+s*.27),(s,s*.69,s*.65),mat,7,4,.18)

def noise2(x,y):
    """Deterministic low-frequency value noise, independent of mesh sampling order."""
    ix,iy=math.floor(x),math.floor(y);tx=x-ix;ty=y-iy
    tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
    def val(a,b):
        n=math.sin(a*127.1+b*311.7+17.9)*43758.5453123
        return (n-math.floor(n))*2-1
    return (val(ix,iy)*(1-tx)+val(ix+1,iy)*tx)*(1-ty)+(val(ix,iy+1)*(1-tx)+val(ix+1,iy+1)*tx)*ty

def organic_terrain(width,depth,height,res=57):
    """Jittered triangulation with coherent snow/rock exposure, no regular tiled mask."""
    rr=random.Random(193506)
    pts=[]
    for j in range(res+1):
        for i in range(res+1):
            x=-width/2+i*width/res;y=-depth/2+j*depth/res
            if i not in [0,res] and j not in [0,res]:
                x+=rr.uniform(-.38,.38)*width/res;y+=rr.uniform(-.38,.38)*depth/res
            pts.append((x,y,height(x,y)))
    for j in range(res):
        for i in range(res):
            a=j*(res+1)+i;b=a+1;c=a+res+1;d=c+1
            triangles=[(a,b,d),(a,d,c)] if rr.random()>.5 else [(a,b,c),(b,d,c)]
            for face in triangles:
                vs=[pts[k] for k in face];normal=(Vector(vs[1])-Vector(vs[0])).cross(Vector(vs[2])-Vector(vs[0])).normalized()
                x=sum(p[0] for p in vs)/3;y=sum(p[1] for p in vs)/3
                # Large, connected leeward rock faces interrupted by irregular snow gullies.
                exposure=1-normal.z+.16*noise2(x*.34,y*.29)+.10*normal.x
                mat=DARK if exposure>.58 else (SHALE if exposure>.38 else SNOW)
                G.mesh(vs,[(0,1,2)],mat)
    for j in range(res):
        for side in [0,res]:
            a=pts[j*(res+1)+side];b=pts[(j+1)*(res+1)+side]
            G.mesh([a,b,(b[0],b[1],-.8),(a[0],a[1],-.8)],[(0,1,2,3)],SHALE)
    for i in range(res):
        for row in [0,res]:
            a=pts[row*(res+1)+i];b=pts[row*(res+1)+i+1]
            G.mesh([a,b,(b[0],b[1],-.8),(a[0],a[1],-.8)],[(0,1,2,3)],SHALE)
    box((0,0,-.81),(width,depth,.08),SHALE)

def angular_crag(x,y,z,sx,sy,h,snow=False):
    """Tilted strata with a broken crest, in place of rounded ellipsoid boulders."""
    rings=[];n=7
    for j,(zz,rad) in enumerate([(0,.9),(.27,1),(.56,.84),(.83,.66),(1,.33)]):
        for i in range(n):
            a=i*math.tau/n;shape=1+RNG.uniform(-.19,.19)
            rings.append((x+math.cos(a)*sx*rad*shape+zz*sx*.24,y+math.sin(a)*sy*rad*shape-zz*sy*.13,z+h*(zz+RNG.uniform(-.035,.035))))
    for j in range(4):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n
            mat=SHALE if (i+j)%4 else TIMBER
            if snow and j==3 and i%3:mat=SNOW
            G.mesh([rings[a],rings[b],rings[c],rings[d]],[(0,1,2),(0,2,3)],mat)
    G.mesh(rings[-n:],[tuple(range(n))],SNOW if snow else PAPER)

def terrain(width=32,depth=28,fn=None,kind='earth',res=45):
    fn=fn or (lambda x,y:0)
    vs=[]
    for j in range(res+1):
        y=-depth/2+j*depth/res
        for i in range(res+1):
            x=-width/2+i*width/res; vs.append((x,y,fn(x,y)))
    for j in range(res):
        for i in range(res):
            a=j*(res+1)+i; q=[vs[t] for t in [a,a+1,a+res+1,a+res+2]]
            h=sum(p[2] for p in q)/4
            slope=max(p[2] for p in q)-min(p[2] for p in q)
            mat=SNOW if kind=='snow' else (SHALE if kind=='marsh' else PAPER)
            # Exposed rock follows coherent steep faces, never random checkerboard patches.
            if kind=='snow' and slope>1.12: mat=SHALE if slope<1.7 else DARK
            G.mesh(vs[a:a+2]+vs[a+res+1:a+res+3],[(0,1,3),(0,3,2)],mat)
    edges=[[(i,-depth/2,fn(i,-depth/2)) for i in [-width/2+k*width/res for k in range(res+1)]],[(width/2,i,fn(width/2,i)) for i in [-depth/2+k*depth/res for k in range(res+1)]],[(i,depth/2,fn(i,depth/2)) for i in [width/2-k*width/res for k in range(res+1)]],[(-width/2,i,fn(-width/2,i)) for i in [depth/2-k*depth/res for k in range(res+1)]]]
    for edge in edges:
        for a,b in zip(edge,edge[1:]):G.mesh([a,b,(b[0],b[1],-.8),(a[0],a[1],-.8)],[(0,1,2,3)],SHALE)
    box((0,0,-.81),(width,depth,.08),SHALE)
    return fn

def path_curve(points,width=1.5,mat=PAPER,fn=None):
    path=[]
    for a,b in zip(points,points[1:]):
        for i in range(8):
            t=i/8; x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
            z=fn(x,y) if fn else (a[2]*(1-t)+b[2]*t if len(a)>2 else .05)
            path.append((x,y,z+.035))
    a=points[-1]; path.append((a[0],a[1],(fn(a[0],a[1]) if fn else (a[2] if len(a)>2 else .05))+.035))
    G.ribbon(path,width,mat)

def shrub(x,y,z,s=.8,bare=False):
    beam((x,y,z),(x+.08,y,z+s*1.9),s*.09,TIMBER)
    for k in range(4):
        a=k*2.3; ex=x+math.sin(a)*s*.65; ey=y+math.cos(a)*s*.65; ez=z+s*(1.3+k*.25)
        beam((x,y,z+s*.65),(ex,ey,ez),s*.045,TIMBER,5)
        if not bare:ball((ex,ey,ez),(s*.65,s*.55,s*.45),SHALE,7,4,.2)
        else:
            for turn in [-.6,.6]:
                beam((ex,ey,ez),(ex+math.cos(a+turn)*s*.32,ey+math.sin(a+turn)*s*.32,ez+s*.35),s*.022,TIMBER,5,r2=s*.009)

def grass(x,y,z,s=.4):
    for k in range(4):
        a=k*2.1; beam((x,y,z),(x+math.sin(a)*s*.35,y+math.cos(a)*s*.3,z+s*(.6+k*.1)),.018,TIMBER,3,r2=.004)

def flag(x,y,z,h=3,w=1.6):
    beam((x,y,z),(x,y,z+h),.042,TIMBER)
    vs=[]
    for j in range(3):
        for i in range(7):
            u=i/6;v=j/2
            vs.append((x+w*u,y+math.sin(u*7+v)*.13*u,z+h-.12-v*.95-u*.16))
    G.mesh(vs,[(j*7+i,j*7+i+1,(j+1)*7+i+1,(j+1)*7+i) for j in range(2) for i in range(6)],RED)

def person(x,y,z,s=1,yaw=0,pose='walk',pack=True):
    def p(a,b,c):return (x+s*(a*math.cos(yaw)-b*math.sin(yaw)),y+s*(a*math.sin(yaw)+b*math.cos(yaw)),z+s*c)
    # Quiet faceted human figures; no faces, weapons, injury, or likeness claims.
    seated=pose=='sit'; waist=.62 if seated else .84
    for a in [-1,1]:
        hip=p(a*.12,0,waist); knee=p(a*.13,-.25 if a<0 else .2,.4 if not seated else .45)
        ankle=p(a*.14,-.32 if a<0 else .28,.09)
        beam(hip,knee,s*.105,DARK);beam(knee,ankle,s*.08,DARK)
        box(p(a*.14,-.38 if a<0 else .21,.065),(s*.2,s*.34,s*.13),DARK,yaw)
    ball(p(0,.01,waist+.26),(s*.24,s*.16,s*.33),TIMBER,8,5)
    beam(p(0,0,waist+.51),p(0,0,waist+.59),s*.07,PAPER)
    ball(p(0,-.02,waist+.73),(s*.135,s*.13,s*.17),PAPER,8,5)
    ball(p(0,0,waist+.85),(s*.155,s*.15,s*.055),DARK,8,3)
    box(p(0,-.125,waist+.82),(s*.22,s*.13,s*.035),DARK,yaw)
    for a in [-1,1]:
        shoulder=p(a*.2,0,waist+.43)
        if pose=='greet' and a>0: elbow=p(.45,-.02,waist+.68); hand=p(.48,-.03,waist+.99)
        elif seated:elbow=p(a*.28,-.23,waist+.22);hand=p(a*.15,-.43,waist+.25)
        else:elbow=p(a*.28,-a*.12,waist+.15);hand=p(a*.32,-a*.26,waist-.02)
        beam(shoulder,elbow,s*.075,TIMBER);beam(elbow,hand,s*.058,TIMBER);ball(hand,(s*.062,)*3,PAPER,6,3)
    if pack and not seated:
        box(p(0,.24,waist+.28),(s*.4,s*.22,s*.47),SHALE,yaw)
        beam(p(-.25,.24,waist+.57),p(.25,.24,waist+.57),s*.105,PAPER)
        for a in [-.13,.13]:beam(p(a,.36,waist+.05),p(a,.36,waist+.5),s*.018,DARK,4)
    if pose=='walk':beam(p(.32,-.27,.05),p(.32,-.26,waist+.1),s*.025,TIMBER,5)

def bench(x,y,z,w=2,yaw=0):
    box((x,y,z+.48),(w,.48,.13),TIMBER,yaw)
    for a in [-1,1]:
        dx=a*w*.37; beam((x+dx*math.cos(yaw),y+dx*math.sin(yaw),z),(x+dx*math.cos(yaw),y+dx*math.sin(yaw),z+.43),.07,TIMBER)

def table(x,y,z,w=2,d=1):
    box((x,y,z+.83),(w,d,.12),TIMBER)
    for a in [-1,1]:
        for b in [-1,1]:box((x+a*w*.39,y+b*d*.37,z+.4),(.11,.11,.8),TIMBER)
    # folded map / newspapers: three-dimensional paper sheets and sparse ink lines
    box((x-.2,y,z+.91),(w*.55,d*.65,.025),SNOW)
    for k in range(5):box((x-.24,y-.23+k*.09,z+.926),(w*.35,.014,.008),DARK)

def steps(x,y,z,w,n=4,rise=.22,run=.38):
    for i in range(n):box((x,y-i*run,z+rise*(n-i)/2),(w,run+.06,rise*(n-i)),PAPER)

def lattice(x,y,z,w=1.1,h=1.4):
    box((x,y,z),(w,.09,h),DARK)
    for a in range(5):box((x-w/2+a*w/4,y-.06,z),(.032,.055,h),PAPER)
    for a in range(6):box((x,y-.06,z-h/2+a*h/5),(w,.055,.03),PAPER)

def roof(x,y,z,w,d,h=2,tiles=True,hip=False):
    # Slight eave lift, segmented tile ribs and thick ridge caps.
    ridgew=w*.63 if hip else w
    pts=[(x-w/2,y-d/2,z+.15),(x+w/2,y-d/2,z+.15),(x+w/2,y+d/2,z+.15),(x-w/2,y+d/2,z+.15),(x-ridgew/2,y,z+h),(x+ridgew/2,y,z+h)]
    G.mesh(pts,[(0,1,5,4),(2,3,4,5),(1,2,5),(3,0,4)],TIMBER)
    # Parallel cylindrical tile rows plus short cross-battens produce real relief.
    for i in range(int(w/.28)+1):
        xx=x-w/2+i*w/int(w/.28)
        for side in [-1,1]:
            beam((xx,y+side*d/2,z+.19),(x+(xx-x)*ridgew/w,y,z+h),.055,SHALE if i%4 else TIMBER,6)
    for side in [-1,1]:
        beam((x-w/2,y+side*d/2,z+.15),(x+w/2,y+side*d/2,z+.15),.115,TIMBER)
        for j in range(1,7):
            t=j/7;half=(w*(1-t)+ridgew*t)/2
            beam((x-half,y+side*d/2*(1-t),z+.15+(h-.15)*t),(x+half,y+side*d/2*(1-t),z+.15+(h-.15)*t),.024,SHALE,4)
    beam((x-ridgew/2-.2,y,z+h+.06),(x+ridgew/2+.2,y,z+h+.06),.15,PAPER)
    if hip:
        for a in [-1,1]:
            for b in [-1,1]:
                beam((x+a*w/2,y+b*d/2,z+.16),(x+a*ridgew/2,y,z+h),.115,PAPER)
                beam((x+a*w/2,y+b*d/2,z+.16),(x+a*(w/2+.3),y+b*(d/2+.15),z+.5),.09,PAPER)

def house(x,y,z,w=8,d=5,h=3.3,porch=False,hip=False,roofmat=None):
    box((x,y,z+.16),(w+.6,d+.6,.32),PAPER)
    box((x,y+d*.08,z+h/2),(w,d*.84,h),PAPER)
    front=y-d/2-.015
    box((x,front+.1,z+h*.43),(w-.5,.14,h*.79),DARK)
    for i in range(4):
        xx=x-w*.39+i*w*.26
        if i in [0,3]:lattice(xx,front-.03,z+h*.55,w*.18,h*.47)
        else:
            box((xx,front-.03,z+h*.43),(w*.2,.11,h*.79),TIMBER)
            for k in range(3):box((xx-w*.07+k*w*.07,front-.1,z+h*.43),(.035,.055,h*.72),SHALE)
    if porch:
        for i in range(5):
            xx=x-w*.47+i*w*.235
            beam((xx,front-.65,z+.35),(xx,front-.65,z+h+.2),.13,TIMBER)
            box((xx,front-.65,z+h-.1),(.5,.5,.2),PAPER)
        beam((x-w*.52,front-.65,z+h),(x+w*.52,front-.65,z+h),.18,TIMBER)
        steps(x,front-1,z-.05,w*.48)
    roof(x,y,z+h,w+1.3,d+1.5,1.6 if w<10 else 2.2,hip=hip)

def stonewall(x,y,z,w,h=.9,depth=.7):
    box((x,y,z+h/2),(w,depth,h),SHALE)
    rows=max(2,int(h/.34));cols=max(1,int(w/.68))
    for j in range(rows):
        for i in range(cols):
            xx=x-w/2+(i+.5)*w/cols+(j%2)*.12
            box((xx,y-depth/2-.025,z+(j+.5)*h/rows),(w/cols-.035,.1,h/rows-.035),PAPER)

def courtyard_paving(x,y,w,d,z=.03):
    for j in range(int(d/.85)):
        for i in range(int(w/1.3)):
            xx=x-w/2+(i+.5)*1.3
            box((xx,y-d/2+(j+.5)*.85,z),(1.265,.815,.045),PAPER if (i+j)%5 else SHALE)

def archwall(x,y,z,w,d,h,r,mat=PAPER,spring_height=None):
    # Real open arch: no painted black patch. Segment wedge masonry up to lintel.
    spring=z+(r*1.05 if spring_height is None else spring_height)
    box((x-w/4-r/2,y,z+h/2),((w-2*r)/2,d,h),mat)
    box((x+w/4+r/2,y,z+h/2),((w-2*r)/2,d,h),mat)
    seg=16
    for i in range(seg):
        a=math.pi*i/seg;b=math.pi*(i+1)/seg
        xa=x+r*math.cos(a);xb=x+r*math.cos(b);za=spring+r*math.sin(a);zb=spring+r*math.sin(b)
        G.mesh([(xa,y-d/2,za),(xb,y-d/2,zb),(xb,y-d/2,z+h),(xa,y-d/2,z+h),(xa,y+d/2,za),(xb,y+d/2,zb),(xb,y+d/2,z+h),(xa,y+d/2,z+h)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7)],mat)
        # Visible voussoirs around arch edge.
        rr=r+.32
        pts=[(x+r*math.cos(a),y-d/2-.06,spring+r*math.sin(a)),(x+r*math.cos(b),y-d/2-.06,spring+r*math.sin(b)),(x+rr*math.cos(b),y-d/2-.08,spring+rr*math.sin(b)),(x+rr*math.cos(a),y-d/2-.08,spring+rr*math.sin(a))]
        G.mesh(pts,[(0,1,2,3)],SHALE if i%2 else PAPER)

@reg('jiajin','Jiajin snowy pass','June 1935 alpine crossing; terrain and anonymous people are interpretive, not a surveyed summit.')
def jiajin():
    def height(x,y):
        center=.3+1.1*math.sin(y*.31)
        ridge=(3.3+5.8*(y+15)/30)*math.exp(-(abs(x-center)/4.1)**1.42)
        peaks=0
        for cx,cy,h,rx,ry in [(-9,5,9,8,12),(-11,12,11,7,7),(9.4,8,12,7,9),(12,-2,6.5,7,11)]:
            warp=.35*noise2(x*.3,y*.3)
            peak=h*max(0,1-(abs(x-cx+warp)/rx)**1.15-(abs(y-cy)/ry)**1.27)
            peaks=max(peaks,peak)
        return .5+max(ridge,peaks)+.62*noise2(x*.72,y*.61)+.23*noise2(x*1.8,y*1.5)
    organic_terrain(34,30,height,59)
    pts=[(.3+1.1*math.sin(y*.31),y) for y in [-14,-11,-8,-5,-2,1,4,7,10,13]]
    path_curve(pts,.92,SNOW,height)
    for i in range(13):
        yy=-12+i*1.9; xx=.3+1.1*math.sin(yy*.31)
        person(xx,yy,height(xx,yy)+.05,.85,yaw=math.pi,pose='walk')
    # Asymmetric broken rock towers partly buried in snow, leaving the centre route clear.
    for i in range(26):
        x=RNG.uniform(-15,15);y=RNG.uniform(-13,13)
        if abs(x-1)>3:
            hh=RNG.uniform(1.3,3.2)
            angular_crag(x,y,max(-.48,height(x,y)-hh*.6),RNG.uniform(.5,1.25),RNG.uniform(.7,1.6),hh,True)
    fx=.3+1.1*math.sin(6*.31);flag(fx,6,height(fx,6),2.3,1.1)

@reg('dawei','Dawei timber meeting bridge','13.6 x 2.8 m uncovered plank bridge based on Xiaojin government; compressed banks and surrounding settlement.')
def dawei():
    def height(x,y):return .1+2.1*(1-math.exp(-((x)/4.3)**4))+.5*math.exp(-((x+13)**2+(y-8)**2)/30)
    terrain(34,28,height,res=45)
    G.ribbon([(math.sin(t*.4)*.25,t,.24) for t in range(-14,15)],5.3,WATER)
    for j in range(20):
        yy=-13+j*1.3;xx=math.sin(j*1.3)
        beam((xx-.45,yy,.28),(xx+.45,yy+.13,.28),.026,PAPER,4)
    for i in range(24):
        y=RNG.uniform(-13,13);x=RNG.choice([-1,1])*RNG.uniform(2.3,4.1)
        rock(x,y,.1,RNG.uniform(.3,.8))
    # Open bridge with battered stone abutments, multiple round beams and close planks.
    for a in [-1,1]:
        stonewall(a*6.4,0,.2,2.2,2.7,4.6)
        for j in range(5):beam((a*(6.5-j*.36),-1.15,2.48-j*.22),(a*(6.5-j*.36),1.15,2.48-j*.22),.18,TIMBER)
    for y in [-1.13,-.58,0,.58,1.13]:beam((-6.8,y,2.55),(6.8,y,2.55),.16,TIMBER)
    for i in range(46):box((-6.8+(i+.5)*13.6/46,0,2.77),(.28,2.8,.17),TIMBER if i%5 else PAPER)
    for y in [-1.32,1.32]:
        for i in range(11):beam((-6.65+i*1.33,y,2.85),(-6.65+i*1.33,y,3.9),.065,TIMBER)
        for z in [3.22,3.83]:beam((-6.8,y,z),(6.8,y,z),.07,TIMBER)
    path_curve([(-16,-3,2.2),(-9,-.2,2.2),(-6.8,0,2.85)],2.6)
    path_curve([(6.8,0,2.85),(10,1.5,2.2),(16,7,2.2)],2.6)
    house(-10,6,2.2,6,4.5,3,True)
    house(11,7,2.2,5.5,5,3)
    for i in range(5):person(-5.3+i*1.6,(-1)**i*.33,2.89,.95,yaw=(-math.pi/2 if i<3 else math.pi/2),pose='greet' if i in [2,3] else 'walk')
    flag(-7.7,-1.3,2.25,3.8,1.4)
    for x,y in [(-14,8),(15,9),(-14,-8),(12,-8)]:shrub(x,y,height(x,y),1.6)

@reg('lianghekou','Lianghekou Guandi temple meeting','June 26-28 1935; Guandi temple identification is sourced. Courtyard furniture and detailed dimensions are interpretive.')
def lianghekou():
    terrain(34,29,lambda x,y:.1+2*math.exp(-((y-13)/4)**2),res=34)
    courtyard_paving(0,-.3,25,20,.14)
    house(0,7,.2,15,7,4.1,True,True)
    house(-12,2,.2,5,9,3)
    house(12,2,.2,5,9,3)
    house(-10,-9,.2,5,4,3)
    stonewall(9,-10,.2,9,.9)
    table(0,1.8,.25,4,1.8)
    for x in [-2.5,0,2.5]:
        bench(x,.25,.2,1.7)
        person(x,.3,.25,.9,pose='sit',pack=False)
    for x in [-2.4,0,2.4]:person(x,3.3,.25,.95,yaw=math.pi,pose='sit',pack=False)
    # Small cloth banner / curtains; never add invented historical writing.
    box((0,3.3,3.4),(2.7,.04,1),RED)
    flag(8,5,.2,5,1.7)
    for p in [(-14,10),(14,10),(-14,-10)]:shrub(*p,.15,1.8)
    for x in [-5,4,7]:person(x,-5,.22,.95,yaw=.2)
    bench(-6,-7,.2,2.4)

@reg('songpan','Northwest Sichuan marsh passage','August 1935 grassland crossing; regional historical scene rather than present Chuanzhusi memorial POI.')
def songpan():
    def h(x,y):return .1+.16*math.sin(x*.66)*math.cos(y*.73)+.1*math.sin(x*.24+y*.9)
    terrain(36,29,h,kind='marsh',res=45)
    # Irregular shallow pools with peat margins, floating grass islets and a narrow meandering passage.
    for cx,cy,rx,ry in [(-10,-7,4,3),(3,-7,5,3),(-6,5,5,2.8),(10,5,4.7,3),(1,11,5,2),(11,-11,3.5,1.7)]:
        ol=[]
        for i in range(18):
            a=i*math.tau/18;rr=1+.13*math.sin(i*2.4)
            ol.append((cx+rx*math.cos(a)*rr,cy+ry*math.sin(a)*rr))
        G.poly(ol,.23,.025,WATER)
        for i in range(13):
            a=i*math.tau/13;xx=cx+rx*math.cos(a)*1.08; yy=cy+ry*math.sin(a)*1.08
            ball((xx,yy,.24),(.45,.35,.13),SHALE,7,3,.1);grass(xx,yy,.25,.45)
    path_curve([(-3,-14),(-2,-9),(-4,-4),(0,0),(2,5),(5,9),(6,14)],1.05,PAPER,h)
    for i in range(9):
        yy=-11+i*2.7;xx=-1.8+yy*.28+math.sin(yy*.4)
        person(xx,yy,.36,.95,yaw=math.pi,pose='walk')
    for i in range(360):
        xx=RNG.uniform(-17,17);yy=RNG.uniform(-13,13)
        grass(xx,yy,h(xx,yy),RNG.uniform(.18,.45))
    # Supplies and a pair helping each other, avoiding combat spectacle.
    person(-1,-.7,.38,.95,yaw=.2,pose='greet');person(.15,-.2,.38,.9,yaw=-.3)
    flag(5.5,9,.36,2.6,1.15)

@reg('baxi','Baxi region temple assembly','Composite interpretation of Sept 2 1935 Baxi temple meeting, not the Sept 9 Yalong emergency meeting. Flat Tibetan main hall, hip-roofed gate.')
def baxi():
    terrain(35,30,lambda x,y:.15+2.1*math.exp(-((y-14)/4)**2),res=35)
    courtyard_paving(0,-1,26,22,.2)
    # Tapered rammed-earth walls and flat parapet of the Tibetan assembly hall.
    box((0,8,2.35),(16,8,4.3),PAPER)
    box((0,8,4.5),(16.6,8.5,.35),TIMBER)
    box((0,8,4.73),(16.5,8.4,.15),PAPER)
    for yy in [4,12]:box((0,yy,5.05),(16.5,.45,.65),PAPER)
    for xx in [-8,8]:box((xx,8,5.05),(.45,8,.65),PAPER)
    for i in range(7):
        xx=-6.7+i*2.23
        box((xx,3.95,2.5),(1.65,.14,2.9),DARK)
        beam((xx-1,3.3,.5),(xx-1,3.3,4.35),.15,TIMBER)
        box((xx-1,3.3,4.1),(.6,.6,.25),TIMBER)
        if i!=3:lattice(xx,3.84,2.5,1.2,1.8)
    beam((-8,3.3,4.2),(8,3.3,4.2),.21,TIMBER)
    steps(0,3,.2,7,5,.18,.42)
    house(-12,2,.2,5,10,2.8)
    house(12,2,.2,5,10,2.8)
    # Gate specifically has a double-eaved hipped roof, rather than making every hall Han-style.
    for xx in [-3,3]:box((xx,-10,1.65),(1.2,3,2.9),PAPER)
    roof(0,-10,3.2,9,4.8,1.3,hip=True);box((0,-10,4.2),(5.5,2.4,.65),PAPER);roof(0,-10,4.8,7,3.8,1.5,hip=True)
    for x,y in [(-4,0),(-2,-1),(0,-1.5),(2,-1),(4,0)]:person(x,y,.25,.95,pose='sit',pack=False)
    person(0,1.4,.9,1.05,yaw=math.pi,pose='greet',pack=False)
    table(0,.5,.3,2.4,1.2)
    for x in [-13.5,14]:shrub(x,12,.3,1.6)
    flag(7,2.2,.3,4.2,1.5)

@reg('lazikou','Lazikou gorge bridge','Sept 16-17 1935 narrow timber bridge and cliffside path; there is no invented gatehouse or temple at the pass.')
def lazikou():
    terrain(32,29,lambda x,y:.12,res=22)
    def cliff_height(side,y):
        cut=.38+.62*max(0,min(1,(y+8)/16)) if side>0 else 1
        return (12.8+1.8*noise2(y*.25,side*4)+.8*math.sin(y*.57))*cut
    def frontdist(y,t,side):
        return 4.3+.50*math.sin(y*.43+side)+1.9*t+.35*noise2(y*.7,t*8+side*3)+(.24 if int(t*14)%2 else -.19)
    # Each cliff is a solid stack of irregular strata, with broken ledges and a jagged rim.
    ys=[-14.5]+[-14.5+j*29/17+RNG.uniform(-.26,.26) for j in range(1,17)]+[14.5]
    bands=[0,.10,.23,.38,.54,.69,.83,1]
    for side in [-1,1]:
        profiles=[]
        for y in ys:
            hh=cliff_height(side,y)
            profiles.append([(side*frontdist(y,t,side),y,.3+t*hh) for t in bands])
        top_profiles=[]
        for j,yy in enumerate(ys):
            inside=profiles[j][-1];pts=[inside]
            for m in range(1,4):
                xx=inside[0]+(side*16-inside[0])*m/3
                pts.append((xx,yy,inside[2]+max(.12,.54*m+.75*noise2(xx*.55,yy*.49))))
            top_profiles.append(pts)
        for j in range(len(ys)-1):
            for k in range(len(bands)-1):
                a,b,c,d=profiles[j][k],profiles[j+1][k],profiles[j+1][k+1],profiles[j][k+1]
                mat=[SHALE,PAPER,SHALE,TIMBER,SHALE,PAPER,TIMBER][k]
                if (j+k*3)%9==0:mat=TIMBER
                G.mesh([a,b,c,d],[(0,1,2),(0,2,3)],mat)
                # Dark bedding fracture inset under every rock ledge, visible at map scale.
                if k>0:
                    q1=(a[0]-side*.045,a[1],a[2]+.04);q2=(b[0]-side*.045,b[1],b[2]+.04)
                    G.mesh([q1,q2,(q2[0],q2[1],q2[2]+.10),(q1[0],q1[1],q1[2]+.10)],[(0,1,2,3)],TIMBER)
            for m in range(3):
                G.mesh([top_profiles[j][m],top_profiles[j+1][m],top_profiles[j+1][m+1],top_profiles[j][m+1]],[(0,1,2),(0,2,3)],PAPER if (j+m)%5==0 else SHALE)
            outera,outerb=top_profiles[j][-1],top_profiles[j+1][-1]
            G.mesh([outera,outerb,(side*16,ys[j+1],.12),(side*16,ys[j],.12)],[(0,1,2,3)],SHALE)
        for end in [0,-1]:
            prof=profiles[end];yy=ys[end]
            for k in range(len(prof)-1):
                a,b=prof[k],prof[k+1]
                G.mesh([a,b,(side*16,yy,b[2]),(side*16,yy,a[2])],[(0,1,2,3)],SHALE if k%2 else PAPER)
            # Seal the uneven crown against the displayed cut face, without a black slit.
            for m in range(3):
                a,b=top_profiles[end][m],top_profiles[end][m+1]
                G.mesh([a,b,(b[0],yy,prof[-1][2]),(a[0],yy,prof[-1][2])],[(0,1,2,3)],SHALE)
        # Layered mountain noses interrupt the planar curtain, varied in length and lean.
        for j in range(8):
            yy=-12+j*3.6+RNG.uniform(-.7,.7);hh=cliff_height(side,yy)
            xx=side*(5.2+RNG.uniform(-.2,.8))
            angular_crag(xx,yy,.4,1.0,1.1+RNG.random()*.7,hh*.86)
        for j in range(17):
            yy=RNG.uniform(-13,13);t=RNG.uniform(.2,.82);hh=cliff_height(side,yy);xx=side*frontdist(yy,t,side)
            # Diagonal fissures with flat, charcoal geometry instead of painted texture.
            G.mesh([(xx-side*.06,yy-.08,.3+t*hh),(xx-side*.07,yy+.04,.3+t*hh),(xx-side*.11,yy+.25,.3+t*hh-1.2),(xx-side*.1,yy+.14,.3+t*hh-1.3)],[(0,1,2,3)],DARK)
        for j in range(21):
            yy=RNG.uniform(-12.7,12.7);dist=RNG.uniform(7.5,14.6);xx=side*dist
            hh=.3+cliff_height(side,yy)+.54*(dist-6)/3
            angular_crag(xx,yy,hh-.2,RNG.uniform(.5,1.1),RNG.uniform(.55,1.35),RNG.uniform(.65,1.8))
    # Uneven channel and white broken foam ribbons give the tiny bridge its rapid-water setting.
    flow=[(math.sin(t*.28)*.33,t,.29+.035*math.sin(t*1.7)) for t in [-14.5+j*.5 for j in range(59)]]
    G.ribbon(flow,4.6,WATER)
    for j in range(55):
        yy=RNG.uniform(-14,13);xx=RNG.uniform(-1.95,1.95);ln=RNG.uniform(.35,1.4)
        path=[(xx+.10*math.sin(k*2+j),yy+k*ln/4,.39+.035*math.sin((yy+k*ln/4)*1.7)) for k in range(5)]
        G.ribbon(path,RNG.uniform(.035,.10),PAPER)
    for j in range(12):
        yy=-12+j*2.1;xx=RNG.uniform(-1.5,1.5)
        rock(xx,yy,.28,RNG.uniform(.20,.48),SHALE)
        for s in [-1,1]:G.ribbon([(xx,yy-.3,.43),(xx+s*.3,yy-.65,.44),(xx+s*.42,yy-1,.43)],.07,SNOW)
    for i in range(95):
        yy=RNG.uniform(-14,14);side=RNG.choice([-1,1]);xx=side*RNG.uniform(2.8,4.4)
        angular_crag(xx,yy,.15,RNG.uniform(.15,.6),RNG.uniform(.2,.65),RNG.uniform(.25,1.0))
    for yy in [-.55,.55]:beam((-4.6,yy,2),(4.6,yy,2),.14,TIMBER)
    for i in range(35):box((-4.6+(i+.5)*9.2/35,0,2.2),(.24,1.25,.14),TIMBER)
    for xx in [-4.6,4.6]:stonewall(xx,0,.1,1.8,2.1,2)
    # Narrow cliffside boardwalk, braces and a trail climbing to a saddle.
    for i in range(19):
        yy=-10+i*.48;xx=-3.75-.18*math.sin(yy*.3)
        box((xx,yy,2.2),(1.35,.44,.13),TIMBER)
        if i%3==0:beam((xx-.7,yy,1.1),(xx+.6,yy,2.17),.08,TIMBER)
    for i in range(7):person(-3.7,-9+i*1.25,2.3,.85,yaw=math.pi)
    person(-2.2,0,2.3,.85,yaw=-math.pi/2);person(.2,0,2.3,.85,yaw=-math.pi/2)
    for i in range(3):
        yy=6+i*2.3;hh=.3+cliff_height(1,yy);xx=frontdist(yy,1,1)+.65
        person(xx,yy,hh,.75,yaw=math.pi)
    for side,yy in [(-1,-7),(-1,10),(1,10)]:
        shrub(side*12.4,yy,.8+cliff_height(side,yy),1.1)

@reg('hadapu','Hadapu pharmacy street','September 1935 rest, supply and newspaper information; street/shop furniture compressed around the documented Yihechang pharmacy theme.')
def hadapu():
    terrain(34,30,res=28)
    courtyard_paving(0,-.5,8,28,.13)
    for side in [-1,1]:
        for j in range(3):
            yy=-8+j*8
            # Shops face the centre, rotate whole locally-generated building.
            before={mat:len(data[0]) for mat,data in G.parts.items()}
            bay_width=[[6.9,7.7,6.6],[6.2,7.5,7.1]][int(side>0)][j]
            bay_depth=[[5.2,6.0,4.8],[5.3,5.7,4.6]][int(side>0)][j]
            house(0,0,.2,bay_width,bay_depth,4.4 if j==1 else (3.05+.38*(side>0)),j!=2,hip=j==2)
            if j==0 and side<0:
                # Open apothecary counter, rows of wooden drawers and pulls.
                box((1.4,-bay_depth/2-.31,1.07),(2.42,.55,1.44),TIMBER)
                for col in range(6):
                    for row in range(4):
                        cx=.42+col*.39;cz=.55+row*.32;fy=-bay_depth/2-.60
                        box((cx,fy,cz),(.35,.047,.28),SHALE)
                        beam((cx-.048,fy-.045,cz),(cx+.048,fy-.045,cz),.018,DARK,6)
            if j==2:
                # Stepped fire wall and exposed board shutters for the rear bays.
                for tier in range(3):
                    box((bay_width*.48,0,3.35+tier*.34),(.22,bay_depth*(1-tier*.25),.57),PAPER)
                for leaf in range(4):
                    box((-bay_width*.31+leaf*.24,-bay_depth/2-.16,1.46),(.21,.11,1.64),TIMBER)
            # Add second-storey lattices and timber divisions in tall central building.
            if j==1:
                for xx in [-2.4,-.8,.8,2.4]:lattice(xx,-3.02,3.6,1.15,1)
            angle=math.pi/2 if side<0 else -math.pi/2
            c,s=math.cos(angle),math.sin(angle)
            for mat,(vs,fs) in G.parts.items():
                start=before.get(mat,0)
                for k in range(start,len(vs)):
                    x,y,z=vs[k];vs[k]=(side*9.1+x*c-y*s,yy+x*s+y*c,z)
    # Low end buildings frame the receding street, leaving view through the foreground.
    house(0,12.6,.2,7,3.4,3.2)
    # Medicinal supplies, baskets, open newspapers and a cloth awning.
    for xx in [-5.1,5.1]:
        for yy in [-9,-2,5]:
            table(xx,yy,.2,1.8,.8)
            for k in range(3):ball((xx-.5+k*.48,yy,.9),(.22,.22,.25),PAPER,8,4)
    for x,y in [(-3.9,-7),(-4.2,-5.7),(4.2,2.5),(4.5,3.5)]:ball((x,y,.5),(.35,.35,.4),SHALE,9,5)
    table(-2.9,-10.5,.2,2.6,1.2)
    for i in range(7):
        xx=(-1)**i*(.7+i%3*.6);yy=-8+i*2.8
        person(xx,yy,.22,.95,yaw=(i%2)*math.pi,pose='greet' if i==2 else 'walk')
    flag(-5.6,-3,.2,4.5,1.1)
    # Distinct pharmacy drawer cabinet beside front table, no fabricated inscription.
    box((-5,-10,1),(1.1,.8,1.6),TIMBER)
    for a in range(3):
        for b in range(5):box((-5.55,-10.3+a*.26,.42+b*.27),(.035,.22,.21),PAPER)

@reg('wuqi','Wuqi cave-dwelling courtyard','October 1935 northwest landing; five southern-courtyard cave fronts based on the documented Wuqi old site, compressed not a survey.')
def wuqi():
    def h(x,y):
        rear=max(0,min(1,(y-5.9)/1.5))
        return .15+rear*(6.3*math.exp(-((y-10)/5)**2)+1.1*math.exp(-((x+15)/5)**2))
    terrain(34,29,h,res=44)
    # Five truly open arched cave mouths on a continuous earthen frontage.
    for i in range(5):
        xx=-11.8+i*5.9
        archwall(xx,5.2,.2,5.9,1.7,4.8,1.35,PAPER,spring_height=2.2)
        box((xx,8,2.15),(2.5,.1,3.7),DARK)
        # Timber doors, arched transom lattice, jamb trim and a visible dark interior.
        for side in [-1,1]:box((xx+side*.74,4.28,1.25),(.68,.12,2),TIMBER)
        for j in range(6):box((xx-1.04+j*.416,4.24,3),(.033,.07,1.05),TIMBER)
        for zz in [2.55,2.8,3.05,3.3]:box((xx,4.23,zz),(2.05,.07,.025),TIMBER)
        for side in [-1,1]:beam((xx+side*1.23,4.26,.2),(xx+side*1.23,4.26,2.5),.09,SHALE)
        box((xx,7.2,3.9),(5.9,4,.2),PAPER)
    courtyard_paving(0,-1,25,10,.2)
    stonewall(-10,-7,.2,10,1.1)
    stonewall(9,-7,.2,8,1.1)
    for xx in [-3,3]:box((xx,-7,1.7),(.6,.6,3),PAPER)
    roof(0,-7,3.3,7.7,2.2,.75)
    house(12,-1,.2,5.2,6,2.7)
    shrub(-13.5,-2,.2,2.5,True)
    table(-3,1,.2,2.8,1.5);bench(-3,-.3,.2,2.6)
    # Millstone with radial axle; jars, sacks and stacked firewood.
    beam((6,-1,.3),(6,-1,.65),1.1,PAPER,20)
    beam((6,-1,.68),(6,-1,.95),.72,SHALE,20)
    beam((6,-1,.95),(7.3,-1,1.13),.08,TIMBER)
    for i in range(6):beam((-9+i*.24,2,.3),(-9+i*.24,3.7,.3),.1,TIMBER)
    for x,y in [(9,2),(-8,-3),(8,1)]:ball((x,y,.6),(.33,.33,.5),SHALE,9,5)
    for x,y in [(-1,-3),(2,-1),(5,2),(-5,2)]:person(x,y,.23,.95,yaw=.4,pose='greet' if x==-1 else 'walk')
    flag(-1,3.5,.25,3.4,1.05)

@reg('huining','Huining Xijin gate reunion','October 9 1936 First and Fourth Front Armies meet; two-storey hip-roof gate and surviving wall interpreted from Huining government description.')
def huining():
    terrain(36,30,res=30)
    courtyard_paving(0,-6,30,14,.1)
    archwall(0,2,.15,24,4.4,6.3,2.05,PAPER)
    for i in range(25):
        xx=-12+i
        box((xx,0,6.8),(.64,.8,1.05),PAPER)
        box((xx,4,6.8),(.64,.8,1.05),PAPER)
    for side in [-1,1]:
        box((side*14,2,2.75),(4,4.4,5.2),PAPER)
        for i in range(5):box((side*(12.3+i*.85),0,5.85),(.6,.8,1),PAPER)
    # Individually proud masonry units with both bed joints and staggered perpends.
    # These cover the former unbroken face with actual relief, including the side wings.
    r=2.05;spring=.15+r*1.05;outer=r+.68
    for row in range(18):
        zz=.36+row*.345
        for col in range(33):
            xx=-15.6+col*.975+(row%2)*.4875
            if abs(xx)>15.65:continue
            if abs(xx)>12.05 and zz>5.20:continue
            if zz<spring+.01:
                if abs(xx)<outer+.48:continue
            elif zz<spring+outer:
                dx=max(0,abs(xx)-.48);dy=max(0,zz-spring-.17)
                if dx*dx+dy*dy<outer*outer:continue
            # Dark mortar backing is slightly recessed behind shallow, uneven brick faces.
            box((xx,-.265,zz),(.975,.11,.345),TIMBER)
            face=SHALE if (col+row*3)%7<4 else PAPER
            box((xx,-.34-RNG.uniform(0,.035),zz),(.93,.17,.302),face)
    # Double concentric radial brick rings, their deep soffit visible through the portal.
    for ring in range(2):
        ri=r+ring*.34;ro=ri+.315
        for i in range(24):
            a=math.pi*i/24+.009;b=math.pi*(i+1)/24-.009
            front=-.66 if ring==0 else -.57;back=-.18
            poly=[(ri*math.cos(a),spring+ri*math.sin(a)),(ri*math.cos(b),spring+ri*math.sin(b)),(ro*math.cos(b),spring+ro*math.sin(b)),(ro*math.cos(a),spring+ro*math.sin(a))]
            pts=[(x,y,z) for y in [front,back] for x,z in poly]
            G.mesh(pts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],PAPER if (i+ring)%4 else SHALE)
    # Quoined jambs and keystone at the crown emphasize the real open arch.
    for side in [-1,1]:
        for row in range(7):
            box((side*(r+.30),-.43,.31+row*.30),(.59,.42,.268),PAPER if row%3 else SHALE)
    box((0,-.60,spring+r+.36),(.44,.35,.66),PAPER)
    for side in [-1,1]:
        # Open timber leaves with six plank boards, iron straps and sparse studs.
        angle=side*(-math.pi*.36);hinge=Vector((side*r,.04,0))
        def doorp(u,v,z):
            return (hinge.x+u*math.cos(angle)-v*math.sin(angle),hinge.y+u*math.sin(angle)+v*math.cos(angle),z)
        for k in range(6):
            u=-side*(k+.5)*1.95/6
            box(doorp(u,0,1.96),(.308,.17,3.62),TIMBER,angle)
        for zz in [.60,1.75,3.25]:
            box(doorp(-side*.975,-.13,zz),(1.94,.095,.13),DARK,angle)
            for u in [.25,.57,.9,1.23,1.55,1.82]:ball(doorp(-side*u,-.20,zz),(.041,.041,.041),PAPER,6,3)
        beam(doorp(0,0,.24),doorp(0,0,3.77),.10,DARK)
    # Two storeys, each with real timber bays and lattice windows.
    for level in [0,1]:
        z=6.4+level*3.5;w=14-level*2;d=7-level*.9
        box((0,2,z+1.25),(w-1,d-1,2.5),TIMBER)
        for xx in [-4,-2,0,2,4]:lattice(xx,2-d/2-.02,z+1.45,1.3,1.4)
        for xx in [-w*.46,-w*.23,0,w*.23,w*.46]:
            beam((xx,2-d/2-.3,z),(xx,2-d/2-.3,z+2.75),.13,TIMBER)
            box((xx,2-d/2-.3,z+2.45),(.54,.65,.18),PAPER)
        roof(0,2,z+2.7,w+2,d+2,2,hip=True)
        fy=2-d/2-.36
        # Dense timber posts, transoms, dougong arms and exposed rafter tails.
        for zz in [.22,2.17,2.54]:beam((-w*.48,fy,z+zz),(w*.48,fy,z+zz),.105,DARK)
        for xx in [-w*.46,-w*.23,0,w*.23,w*.46]:
            beam((xx,fy,z+.12),(xx,fy,z+2.67),.17,TIMBER)
            for tier in range(3):
                box((xx,fy-.10-tier*.10,z+2.25+tier*.15),(.52+tier*.20,.5+tier*.2,.13),TIMBER)
            beam((xx-.42,fy-.12,z+2.7),(xx,fy-.10,z+2.15),.075,DARK)
            beam((xx+.42,fy-.12,z+2.7),(xx,fy-.10,z+2.15),.075,DARK)
        for j in range(int((w+1)/.42)):
            xx=-(w+1)/2+(j+.5)*.42
            beam((xx,2-(d+2)/2-.05,z+2.65),(xx,fy+.65,z+3.11),.058,DARK,6)
    flag(-5.8,-2.6,6.4,3.2,1.3);flag(5.1,-2.6,6.4,3.2,1.3)
    for i in range(9):person(-7+i*1.6,-4+(i%3)*1.2,.2,.98,yaw=(math.pi/2 if i<5 else -math.pi/2),pose='greet' if i in [4,5] else 'walk')
    for side in [-1,1]:stonewall(side*12,-11,.1,6,.8)
    shrub(-15,10,.1,1.8);shrub(15,10,.1,1.8)

@reg('jiangtai','Jiangtaibao earthen fortress reunion','October 22 1936 First and Second Front Armies meet; rammed-earth fortress, compressed footprint and period dwellings, no modern memorial.')
def jiangtai():
    def h(x,y):return .3+1.8*math.exp(-((x/17)**4+(y/15)**4))
    terrain(36,32,h,res=42)
    # Square earthen fortress on a raised loess table; hand-built strata and battered profile.
    ground=2
    archwall(0,-8,ground,27,3,6,1.65,PAPER)
    for xx in [-13.1,13.1]:box((xx,2,ground+3),(2.7,21,6),PAPER)
    box((0,12,ground+3),(27,2.5,6),PAPER)
    for j in range(16):
        zz=ground+.2+j*.36
        box((-8,-9.53,zz),(10,.04,.025),SHALE);box((8,-9.53,zz),(10,.04,.025),SHALE)
        for side in [-1,1]:box((side*14.48,2,zz),(.04,21,.025),SHALE)
    for xx in [-13,13]:
        for yy in [-8,12]:
            box((xx,yy,ground+6),(3.3,3.3,1),PAPER)
    for i in range(16):box((-12.7+i*1.7,-8,ground+6.4),(.75,1.2,.9),PAPER)
    # Plain historically sympathetic gate cap; no fabricated historic lettering.
    roof(0,-8,ground+5.9,6,3.6,.8)
    box((0,-9.58,ground+4.5),(2.2,.12,.55),TIMBER)
    house(-6,7,ground,8,5,2.7)
    house(6,7,ground,7,5,2.7)
    # Flat-roofed village building adds local vernacular distinction.
    box((-7,0,ground+1.4),(6,4.5,2.8),PAPER)
    box((-7,0,ground+2.9),(6.5,5,.35),TIMBER)
    for xx in [-8.3,-5.7]:lattice(xx,-2.3,ground+1.5,1,1.1)
    # Footpath ascends from foreground to gate.
    path_curve([(0,-15,.4),(0,-12,1.4),(0,-9.5,2.03),(0,-5,2.03)],3.4,PAPER)
    for i in range(7):
        xx=-4.5+i*1.4;yy=-11+(i%2)*.6
        person(xx,yy,h(xx,yy)+.05,.95,yaw=(math.pi/2 if i<4 else -math.pi/2),pose='greet' if i in [3,4] else 'walk')
    flag(4,-8,ground+6.3,4.3,1.4)
    shrub(-11,7,ground+6,2.7,True)
    for i in range(35):
        xx=RNG.uniform(-17,17);yy=RNG.uniform(-15,15)
        if abs(xx)>14 or yy<-11:grass(xx,yy,h(xx,yy),.4)

def build(id):
    global G
    G=Geo();RNG.seed(1935+sum(ord(c) for c in id))
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.meshes):
        if data.users==0:bpy.data.meshes.remove(data)
    title,note,fn=SCENES[id];fn()
    materials=[]
    for name,color in MATS:
        mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.diffuse_color=color;mat.use_nodes=True
        bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if bsdf is None:
            bsdf=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output=next((n for n in mat.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)
        if output is None:output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        if not output.inputs['Surface'].is_linked:mat.node_tree.links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
        bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=.93
        mat.use_backface_culling=False
        materials.append(mat)
    root=bpy.data.objects.new(id,None);bpy.context.collection.objects.link(root)
    root['title']=title;root['historicalBoundary']=note;root['unit']='interpretive metre';root['front']='+Z after glTF Y-up export';root['groundDatum']=0.0
    pts=[];triangles=0
    for mat,(vs,fs) in G.parts.items():
        if not vs:continue
        mesh=bpy.data.meshes.new(id+'_'+MATS[mat][0]);mesh.from_pydata(vs,[],fs);mesh.update()
        obj=bpy.data.objects.new(id+'_'+MATS[mat][0],mesh);bpy.context.collection.objects.link(obj);obj.parent=root
        obj.data.materials.append(materials[mat]);pts.extend(vs)
        triangles+=sum(len(f)-2 for f in fs)
    mins=[min(p[i] for p in pts) for i in range(3)];maxs=[max(p[i] for p in pts) for i in range(3)]
    root['boundsBlender']=mins+maxs;root['dimensionsGLTF']=[maxs[0]-mins[0],maxs[2]-mins[2],maxs[1]-mins[1]]
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_materials='EXPORT',export_animations=False,export_apply=True,export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression')
    print('HISTORY_REPORT '+json.dumps({'id':id,'dimensionsXYZ':root['dimensionsGLTF'][:],'groundY':0,'boundsBlender':mins+maxs,'triangles':triangles,'bytes':(OUT/(id+'.glb')).stat().st_size,'materials':len(G.parts)},ensure_ascii=False),flush=True)
    return root,maxs

def render(id,maxs):
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24
    sc.render.resolution_x=1000;sc.render.resolution_y=850;sc.render.resolution_percentage=100
    sc.world.color=(.35,.35,.35)
    # Transparent background eases comparison; ground plane is only for QA, not in GLB.
    sc.render.film_transparent=False
    world=sc.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.79,.78,.75,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
    bpy.ops.object.light_add(type='AREA',location=(-18,-25,45));light=bpy.context.object;light.data.energy=25000;light.data.shape='DISK';light.data.size=30
    bpy.ops.object.camera_add(location=(42,-58,43));cam=bpy.context.object;target=Vector((0,0,maxs[2]*.29));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=48;sc.camera=cam
    sc.view_settings.view_transform='Standard';sc.view_settings.look='Medium High Contrast'
    sc.render.filepath=str(Path(tempfile.gettempdir())/('history-north-'+id+'.png'));bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    ids=[a for a in argv if a in SCENES] or list(SCENES)
    for id in ids:
        obj,maxs=build(id)
        if '--render' in argv:render(id,maxs)
