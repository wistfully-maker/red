"""Vernacular landscape details and working animals. Local metres, Z-up."""
import math,random
import history_south as a
from field_waterfronts import vessel

def mule(x,y,z,angle,scale=1):
    c,s=math.cos(angle),math.sin(angle)
    def p(u,v,h):return (x+scale*(c*u-s*v),y+scale*(s*u+c*v),z+scale*h)
    def ellipsoid(u,v,h,ru,rv,rh,mat):
        vs=[];fs=[];n=12
        for j in range(9):
            t=(j/8-.5)*math.pi
            for k in range(n):
                q=k*math.tau/n
                vs.append(p(u+ru*math.cos(q)*math.cos(t),v+rv*math.sin(q)*math.cos(t),h+rh*math.sin(t)))
                if j:
                    i=(j-1)*n+k;l=(j-1)*n+(k+1)%n;fs.append((i,l,l+n,i+n))
        a.mesh(vs,fs,mat)
    ellipsoid(0,.04,1.04,.32,.75,.37,'mulecoat')
    ellipsoid(0,-.51,1.20,.26,.31,.38,'mulecoat')
    a.beam(p(0,-.46,1.15),p(0,-.75,1.65),.196,'mulecoat',11,r2=.136)
    ellipsoid(0,-.84,1.60,.143,.235,.145,'mulecoat')
    a.beam(p(0,-.88,1.61),p(0,-1.12,1.47),.113,'mulecoat',10,r2=.084)
    ellipsoid(0,-1.115,1.47,.092,.072,.068,'muzzle')
    for side in [-1,1]:
        a.beam(p(side*.068,-.74,1.685),p(side*.105,-.68,1.956),.049,'mulecoat',8,r2=.009)
        ellipsoid(side*.128,-.864,1.635,.016,.024,.019,'recess')
        for end in [-1,1]:
            vv=end*.46+.07*side
            points=[p(side*.188,vv,.97),p(side*.21,vv+.085*end,.60),p(side*.217,vv+.04*side,.22),p(side*.219,vv-.052,.09)]
            for i,r in enumerate([.103,.055,.041]):a.beam(points[i],points[i+1],r,'mulecoat',8,r2=r*.66)
            ellipsoid(side*.217,vv-.068,.070,.064,.091,.06,'tarred')
        # Opposed panniers are balanced across a padded saddle.
        ellipsoid(side*.31,.03,1.07,.154,.33,.23,'reedmat')
        for row in [-.18,.18]:
            a.line([p(0,row,1.439),p(side*.25,row,1.35),p(side*.425,row,1.16),p(side*.408,row,.95)],.021,'leather',6)
        a.line([p(side*.09,-1.071,1.52),p(side*.127,-.89,1.57),p(side*.119,-.725,1.70)],.014,'leather',6)
    for j in range(7):
        a.beam(p(0,-.49-j*.038,1.47+j*.033),p(0,-.44-j*.039,1.55+j*.029),.037,'hair',6,r2=.014)
    a.line([p(0,.71,1.16),p(.055,.88,.91),p(.09,.91,.64),p(.11,.84,.41)],.038,'hair',7)

def market(env):
    sid=env.sid;h=env.height;r=env.rng
    if sid=='liping':
        # Successive courts on the rising land: covered ranges surround open
        # work yards. Keep the central passage clear at thresholds.
        cx=-14.3
        for i,yy in enumerate([-5.8,2.4,11.1]):
            z=h(cx,yy)
            if i:
                a.timber_house(cx,yy,z,7.0,3.16,2.8+.15*i,hip=False,plaster=False)
            else:
                for dx in [-2.52,2.52]:a.timber_house(cx+dx,yy,z,3.0,3.1,2.9,plaster=False)
                a.roof(cx,yy,z+2.86,2.15,3.45,.84,False,tiles=False)
            if i<2:
                for side in [-1,1]:
                    xx=cx+side*3.91;y1=yy+4.3
                    a.box((xx,y1,z+1.25),(.22,5.95,2.5),'greybrick')
                    for dd in [-2.7,0,2.7]:a.beam((xx-side*.9,y1+dd,z),(xx-side*.9,y1+dd,z+2.16),.086,'chestnut')
                    a.mesh([(xx,y1-3,z+2.47),(xx,y1+3,z+2.47),(xx-side*1.22,y1+3,z+2.12),(xx-side*1.22,y1-3,z+2.12)],[(0,1,2,3)],'tile')
            env.houses.append((cx,yy,8.4,4.2))
        for xx,yy,b in [(7.4,-9.6,-.21),(8,-12.3,-.42)]:
            mule(xx,yy,h(xx,yy),b)
        for i in range(5):
            xx=-1.2+i*.93;yy=-10.2-.5*math.sin(i)
            env.figures.build(xx,yy,h(xx,yy)+.04,1.58+r.random()*.14,r.uniform(-1,1),'walk','local')
    elif sid=='chishui':
        # An open ribbed hull in the careening yard identifies the river trade
        # even before the visitor zooms down to a single panel.
        x,y=-14.8,2.65;z=h(x,y)
        for dx in [-2.0,2.0]:a.box((x+dx,y,z+.28),(.40,2.13,.56),'timber')
        a.beam((x-3.2,y,z+.61),(x+3.2,y,z+.61),.083,'boat_oak',7)
        for k in range(13):
            u=(k/12-.5)*6.4;w=.90*(1-(abs(u)/3.45)**2)
            a.line([(x+u,y-w,z+1.40+.24*abs(u)/3.2),(x+u,y-w*.70,z+.77),(x+u,y,z+.66),(x+u,y+w*.70,z+.77),(x+u,y+w,z+1.40+.24*abs(u)/3.2)],.044,'wood',7)
        for side in [-1,1]:
            a.line([(x+u,y+side*.90*(1-(abs(u)/3.45)**2),z+1.4+.24*abs(u)/3.2) for u in [j*.4-3.2 for j in range(17)]],.052,'boat_oak',8)
        for j in range(11):
            xx=14.5+(j%4)*.52;yy=4.7+(j//4)*.48;zz=h(xx,yy)
            a.box((xx,yy,zz+.22),(.49,.43,.38),'bag',.10*math.sin(j))
        mule(15.1,7.4,h(15.1,7.4),1.0)
        for i,xx in enumerate([-35,-23,24,39]):
            cross,w,_=env.channel(xx,0);shore=-cross+w;yy=shore+2.5
            landing=h(xx,yy)+.80
            a.masonry(xx,yy,.14,4.6,3.1,max(.40,landing-.14),.72)
            for k in range(8):
                a.box((xx,yy-1.34-k*.33,landing-.12-k*.108),
                      (2.6,.37,.24),'paving')
            if i in [0,2]:
                vessel(env,xx,shore-4.3,7.0+i*.58,1.73+i*.06,.13*(i-1),'ferry')
            for k in range(5):
                a.box((xx+1.21+(k%2)*.40,yy-.5+(k//2)*.39,landing+.20),
                      (.46,.38,.34),'bag',.2*math.sin(k))
            # Merchant's shade, open to the water, with three removable shutters.
            sx=xx+2.2;sy=shore+7.3;sz=h(sx,sy)
            for dx in [-1.6,1.6]:
                for dy in [-1.05,1.05]:a.beam((sx+dx,sy+dy,sz),(sx+dx,sy+dy,sz+2.25+.2*dy),.074,'timber',7)
            pts=[];faces=[]
            for v in range(5):
                for u in range(13):
                    pts.append((sx+(u/12-.5)*3.6,sy+(v/4-.5)*2.48,sz+1.98+.12*v-.12*math.sin(math.pi*u/12)+.037*math.cos(u*1.2)))
                    if u and v:
                        q=v*13+u;faces.append((q-14,q-13,q,q-1))
            a.mesh(pts,faces,'sailcloth' if i%2 else 'reedmat')
            for k in range(3):
                a.box((sx-1.4+k*.24,sy+.8,sz+.86),(.22,.13,1.7),'plankwall')
        for i in range(7):
            xx=-16.9+i*4.9;yy=4.6+r.random()*.74
            zz=1.89 if abs(xx)<10.48 else h(xx,yy)
            env.figures.build(xx,yy,zz+.03,1.6+r.random()*.15,r.uniform(-1.2,1.2),'walk','porter')
    elif sid in ['dawei','luding','jiaoping','anshun']:
        x,y={'dawei':(11,-5),'luding':(68,-12),'jiaoping':(9,6),'anshun':(-15,-4)}[sid]
        mule(x,y,h(x,y),1.4)
        env.figures.build(x+1.23,y-.74,h(x+1.23,y-.74)+.02,1.63,-.31,'stand','porter')

def ground_details(env):
    sid=env.sid;h=env.height;r=env.rng
    if sid in ('luding','lazikou','jiajin','jiaoping','ruijin','dawei'):
        for j in range(135 if sid!='luding' else 460):
            ang=r.random()*math.tau;dist=r.uniform(11,min(env.span*.44,320));x=math.cos(ang)*dist;y=math.sin(ang)*dist
            if env.bank:
                cross,w,_=env.channel(x,y)
                if abs(cross)<w+.45:continue
            if any(abs(x-a)<w*.55+1.5 and abs(y-b)<d*.6+1.5 for a,b,w,d in env.houses):continue
            slope=math.hypot(h(x+1,y)-h(x-1,y),h(x,y+1)-h(x,y-1))
            if slope<.4:continue
            size=r.uniform(.75,2.65)*(1.6 if sid=='luding' else 1)
            a.rock((x,y,h(x,y)-size*.25),(size,size*r.uniform(.7,1.8),size*(.6+slope*.22)),'rock')
    if sid in ('jiajin','songpan'):return
    vs=[];fs=[]
    for k in range(3800):
        x=r.uniform(-48,48);y=r.uniform(-48,48)
        if max(abs(x),abs(y))<9 and sid not in ('anshun','xiangjiang','jiaoping'):continue
        if env.bank:
            c,w,_=env.channel(x,y)
            if abs(c)<w+.60:continue
        if any(abs(x-a)<w*.57+1 and abs(y-b)<d*.62+1 for a,b,w,d in env.houses):continue
        if r.random()>.33+.30*math.sin(x*.34)*math.cos(y*.26):continue
        z=h(x,y)
        for b in range(5):
            aa=r.random()*math.tau;dx,dy=math.cos(aa),math.sin(aa)
            start=len(vs);height=r.uniform(.15,.48)
            vs.extend([(x-.021*dy,y+.021*dx,z),(x+.021*dy,y-.021*dx,z),
                       (x+.065*dx+.016*dy,y+.065*dy-.016*dx,z+height*.63),
                       (x+.14*dx,y+.14*dy,z+height)])
            fs.extend([(start,start+1,start+2),(start,start+2,start+3)])
    a.mesh(vs,fs,'fieldgrass')

