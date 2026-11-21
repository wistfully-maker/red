"""Street profiles, green groves and terraces extend the principal historic sets."""
import math,random
import history_south as art
from historical_sets import basket,table

def lane(env,points,width,paved=True):
    rng=env.rng;centre=[]
    for (x0,y0),(x1,y1) in zip(points,points[1:]):
        dx=x1-x0;dy=y1-y0;dist=math.hypot(dx,dy)
        if dist<.1:continue
        count=max(1,round(dist/(.78 if paved else 1.4)))
        for k in range(count):
            f=k/count;centre.append((x0+dx*f,y0+dy*f,dy/dist,-dx/dist))
    if not centre:return
    centre.append((*points[-1],*centre[-1][2:]))
    for j in range(len(centre)-1):
        ax,ay,nx,ny=centre[j];bx,by,mx,my=centre[j+1]
        columns=max(1,round(width/(1.03 if paved else width)))
        for k in range(columns):
            f=(k/columns-.5)*width+.018;g=((k+1)/columns-.5)*width-.018
            outline=[(ax+nx*f,ay+ny*f),(ax+nx*g,ay+ny*g),(bx+mx*g,by+my*g),(bx+mx*f,by+my*f)]
            vs=[(x,y,env.height(x,y)+.072+.017*math.sin(j*1.7+k)) for x,y in outline]
            art.mesh(vs,[(0,1,2,3)],rng.choice(['paving','dressed_stone','paving']) if paved else 'packedearth')
        if paved and j%2==0:
            end=-width*.51
            a=(ax+end*nx,ay+end*ny);b=(bx+end*mx,by+end*my)
            art.beam((*a,env.height(*a)+.105),(*b,env.height(*b)+.105),.078,'stone',5)

def wing(env,x,y,w,d,h,yaw,style):
    c,s=math.cos(yaw),math.sin(yaw)
    def xy(u,v):return (x+c*u-s*v,y+s*u+c*v)
    corners=[xy(u,v) for u,v in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]
    levels=[env.height(u,v) for u,v in corners]
    base=max(levels)+.11
    def p(u,v,z):return (*xy(u,v),base+z)
    def cub(u,v,z,w0,d0,h0,m):art.box(p(u,v,z),(w0,d0,h0),m,yaw)
    art.mesh([(u,v,lev-.35) for (u,v),lev in zip(corners,levels)]+[(u,v,base) for u,v in corners],
        [(k,(k+1)%4,4+(k+1)%4,k+4) for k in range(4)],'stone')
    m={'alley':'plankwall','court':'limewash','quay':'plankwall','pass':'hillstone','loess':'earth'}[style]
    cub(0,0,h*.5,w,d,h,m)
    over=.48;rise=d*env.rng.uniform(.27,.39);end=w*.41
    pts=[p(u,v,z) for u,v,z in [(-w/2-over,-d/2-over,h),(w/2+over,-d/2-over,h),
       (w/2+over,d/2+over,h),(-w/2-over,d/2+over,h),(-end,0,h+rise),(end,0,h+rise)]]
    art.mesh(pts,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],'tile')
    art.beam(pts[4],pts[5],.085,'tilerib',7)
    for k in range(4):art.beam(pts[k],pts[(k+1)%4],.078,'timber',6)
    for side in [-1,1]:
        if style in ['alley','court'] and env.rng.random()<.53:
            for j in range(3):
                cub(side*w*.49,0,h+.22+j*.37,.20,d*(1.04-.31*j),.53,'limewash')
                cub(side*w*.49,0,h+.52+j*.37,.35,d*(1.07-.31*j),.10,'tile')
    wall=-d/2-.041
    bays=max(2,min(6,round(w/2.1)))
    for j in range(bays):
        u=w*((j+.5)/bays-.5);ww=min(1.0,w/bays*.54)
        bottom=.08 if j==bays//2 else h*.32
        hh=min(2.0 if j==bays//2 else 1.18,h*.75)
        cub(u,wall,bottom+hh/2,ww,.08,hh,'recess')
        for dx in [-ww*.5,ww*.5]:cub(u+dx,wall-.04,bottom+hh/2,.068,.11,hh+.11,'timber')
        cub(u,wall-.052,bottom+hh,ww+.19,.15,.09,'timber')
        if j!=bays//2:
            for q in [-.26,0,.26]:cub(u+ww*q,wall-.07,bottom+hh/2,.027,.048,hh,'wood')
            cub(u,wall-.075,bottom+.54*hh,ww,.05,.030,'wood')
        if style=='quay' or style=='alley':
            v=wall-1.05
            art.beam(p(u,v,-.4),p(u,v,h*.71),.089,'timber',7)
    if style in ['alley','quay']:
        art.mesh([p(-w*.54,wall+.03,h*.81),p(w*.54,wall+.03,h*.81),p(w*.54,wall-1.23,h*.69),p(-w*.54,wall-1.23,h*.69)],[(0,1,2,3)],'tile')
        cub(0,wall-.51,.04,w+.19,1.19,.17,'wood')
    if style=='loess':cub(w*.27,.09,h+rise*.76,.58,.58,1.14,'greybrick')
    env.houses.append((x,y,w,d))

def terrain_sets(env):
    sid=env.sid;r=env.rng
    def block(x,y,w,d,h,yaw,style):
        if any(abs(x-a)<.49*(w+c) and abs(y-b)<.49*(d+e) for a,b,c,e in env.houses):return
        wing(env,x,y,w,d,h,yaw,style)
    if sid=='liping':
        for side in [-1,1]:
            for j in range(14):
                y=-45+j*6.8; x=3+math.sin(y*.078)*1.9
                if -9<y<10:continue
                block(x+side*(5.1+r.uniform(-.5,.7)),y,6.0,4.9,r.uniform(2.8,5.2),side*-math.pi/2+r.uniform(-.06,.06),'alley')
            for j in range(10):
                y=-30+j*6.6;block(side*(16.4+1.8*math.sin(y*.10)),y,5.4,4.6,r.uniform(2.6,4.5),side*math.pi/2,'court')
        for lo,hi in [(-47,-7),(7,48)]:lane(env,[(3+math.sin(k*.078)*1.9,k) for k in range(lo,hi+1,2)],3.4)
        for x in [-13,13]:lane(env,[(x,-31),(x+1,0),(x-1,32)],2.4)
    elif sid=='zunyi':
        for j in range(12):
            y=-39+j*6.7;block(-26.5,y,r.uniform(5.0,6.2),r.uniform(3.7,4.6),r.uniform(3.1,4.9),math.pi/2,'alley')
            if abs(y)>12:block(-16.1,y,5.7,4.7,3.1,-math.pi/2,'alley')
        for j in range(10):
            x=-14+j*5.9;block(x,19.5+1.3*math.sin(j),5.3,4.1,r.uniform(3,4.5),0,'court')
            block(x,-19.8,5.0,3.7,3,math.pi,'alley')
        lane(env,[(-22,-44),(-22,9),(-21,32)],3.4)
        lane(env,[(-23,-15),(-7,-14.3),(41,-15.4)],3.2)
        lane(env,[(-18,15),(2,14.5),(41,15.7)],2.6)
        for x in [-11,9]:
            for y in [-5,6,13]:env.plant(x+r.random(),y,env.height(x,y),r.uniform(3.1,5.9),r.uniform(3.1,4.6))
    elif sid=='chishui':
        for row in range(3):
            for j in range(15):
                x=-55+j*8.;c,w,_=env.channel(x,0);edge=-c+w;y=edge+8+row*8.8+r.uniform(-1,1)
                if row==0 and abs(x)<13:continue
                block(x,y,r.uniform(5.4,7.2),r.uniform(3.8,5.0),r.uniform(3,5.4),.10*math.sin(j),'quay' if row==0 else 'alley')
        for row in range(3):
            route=[]
            for x in range(-60,64,3):
                c,w,_=env.channel(x,0);route.append((x,-c+w+4+row*8.7))
            lane(env,route,2.6)
        for x in [-39,-20,17,42]:
            c,w,_=env.channel(x,0);v=-c+w
            lane(env,[(x,v+3),(x+1,v+13),(x-.2,v+32)],1.9)
    elif sid in ['hadapu','huining','baxi','lianghekou','wuqi','jiangtai','dawei']:
        style='loess' if env.family=='loess' else 'pass'
        for j in range(15):
            a=j*2.4;dist=r.uniform(21,47);xx=math.cos(a)*dist;yy=math.sin(a)*dist
            if sid in ['wuqi','jiangtai','huining'] and yy<0 and abs(xx)<28:continue
            if env.bank and abs(env.channel(xx,yy)[0])<env.channel(xx,yy)[1]+4:continue
            if sid=='baxi':continue
            block(xx,yy,r.uniform(4.7,7.3),r.uniform(3.5,4.7),r.uniform(2.6,4.3),r.uniform(-.4,.4),style)
        lane(env,[(-31,-19),(-14,-14),(0,-15),(19,-15),(35,-10)],2.8,paved=sid in ['hadapu','huining'])
    if sid not in ['jiajin','songpan']:
        for j in range(80 if sid in ('luding','yudu','chishui','jiaoping','anshun') else 44):
            ang=r.random()*math.tau;dist=r.uniform(15,74);x=math.cos(ang)*dist;y=math.sin(ang)*dist
            if env.bank:
                c,w,_=env.channel(x,y)
                if abs(c)<w+1.4:continue
            if any(abs(x-a)<w*.73+1.7 and abs(y-b)<d*.75+1.7 for a,b,w,d in env.houses):continue
            hh=r.uniform(2.9,7.5)
            env.plant(x,y,env.height(x,y)-.06,hh,hh*r.uniform(.7,1.12))
    if sid in ['yudu','xiangjiang','chishui','ruijin','wuqi','jiangtai','lianghekou','baxi']:
        # Banded cultivated plots are actual raised banks and furrow meshes.
        for j in range(16):
            x=r.choice([-1,1])*r.uniform(23,81);y=r.uniform(-55,53)
            if env.bank:
                c,w,_=env.channel(x,y)
                if abs(c)<w+10:continue
            if any(abs(x-a)<w*.5+8 and abs(y-b)<d*.5+7 for a,b,w,d in env.houses):continue
            w,d=r.uniform(8,16),r.uniform(4,9)
            for row in range(10):
                yy=y-d/2+d*row/10;vs=[];fs=[]
                for k in range(12):
                    xx=x-w/2+w*k/11
                    for off,up in [(-.19,.02),(0,.22),(.19,.02)]:vs.append((xx,yy+off,env.height(xx,yy+off)+up))
                    if k:
                        q=k*3;fs.extend([(q-3,q,q+1,q-2),(q-2,q+1,q+2,q-1)])
                art.mesh(vs,fs,'cropgreen' if row%4 else 'cropgold')

