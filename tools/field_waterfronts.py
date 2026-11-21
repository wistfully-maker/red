"""Metre-scale river reaches and traditional civilian watercraft."""
import math
import history_south as art

def vessel(env,x,y,length,beam,yaw=0,kind='ferry',simple=False):
    previous_part=art.PART
    art.part('01_double_sided_hull_shell')
    water=env.height(x,y)
    c,s=math.cos(yaw),math.sin(yaw)
    def at(u,v,h):return (x+c*u-s*v,y+s*u+c*v,water+h)
    crescent=kind=='crescent'
    draft=.34 if crescent else .29
    rise=1.96 if crescent else (.98 if kind=='cargo' else .68)
    def section(t):
        # Fuller midships and a narrowing stem; the sheer climbs towards both ends.
        width=beam*.5*max(.026,(1-abs(t)**2.4)**.69)
        sheer=.44+(rise-.44)*abs(t)**(3.1 if t>0 else 2.7)*(1 if t>0 else .68)
        bottom=-draft+(.24+draft)*abs(t)**3.2
        return width,sheer,bottom
    count=10 if simple else 32
    verts=[];faces=[]
    for j in range(count+1):
        t=2*j/count-1;u=length*t/2;w,h,base=section(t)
        profile=[(-w,h),(-w*.86,base+.29),(-w*.53,base+.045),(0,base),
                 (w*.53,base+.045),(w*.86,base+.29),(w,h),
                 (w-.035,h-.025),(w*.65,max(.115,base+.09)),(-w*.65,max(.115,base+.09)),(-w+.035,h-.025)]
        verts.extend(at(u,v,z) for v,z in profile)
        if j:
            for k in range(11):
                a=(j-1)*11+k;b=(j-1)*11+(k+1)%11
                faces.append((a,b,b+11,a+11))
    faces.extend([tuple(range(10,-1,-1)),tuple(range(count*11,count*11+11))])
    art.mesh(verts,faces,'boat_oak')
    if not simple:
        # A deep keel follows the rocker under the bilge: it remains visible
        # in the isolated model and in the transverse cutaway.
        art.part('02_keel_and_stem')
        keel=[];keel_faces=[]
        for j in range(33):
            t=2*j/32-1;w,h,base=section(t);u=length*t/2
            half_keel=min(.058,w*.50)
            keel.extend(at(u,sign*half_keel,base+dz) for sign,dz in [(-1,.025),(1,.025),(1,-.010),(-1,-.010)])
            if j:
                for k in range(4):
                    a=(j-1)*4+k;b=(j-1)*4+(k+1)%4
                    keel_faces.append((a,b,b+4,a+4))
        art.mesh(keel,keel_faces,'tarred')
        art.part('03_plank_laps_and_gunwales')
        for sign in [-1,1]:
            for strake in [0,.24,.49,.71]:
                joints=[]
                for j in range(25):
                    t=2*j/24-1;w,h,base=section(t)
                    joints.append(at(t*length/2,sign*w*(1-.30*strake),h+(base-h)*strake))
                art.line(joints,.026 if strake==0 else .008,'tarred',6)
        art.part('04_bent_frames')
        for j in range(13):
            t=-.83+j*(1.66/12);u=t*length/2;w,h,_=section(t)
            art.line([at(u,-w+.045,h-.05),at(u,-w*.64,.14),at(u,w*.64,.14),at(u,w-.045,h-.05)],.036,'timber',6)
            if j in [2,6,10]:
                art.part('06_thwarts_and_knees')
                seat=[at(u+a,v,z) for z in [.35,.41] for a,v in [(-.165,-w*.86),(.165,-w*.86),(.165,w*.86),(-.165,w*.86)]]
                art.mesh(seat,[(0,3,2,1),(4,5,6,7)]+[(a,(a+1)%4,(a+1)%4+4,a+4) for a in range(4)],'deckplank')
                for sign in [-1,1]:art.beam(at(u,sign*w*.68,.22),at(u,sign*w*.81,.365),.039,'timber',6)
                art.part('04_bent_frames')
        art.part('05_slatted_floorboards')
        for lane in range(7):
            centre=(lane-3)*beam*.083
            vs=[];fs=[]
            for j in range(23):
                t=(2*j/22-1)*(.78-.063*abs(lane-3))
                u=length*t/2;z=.133+.085*abs(t)**4
                vs.extend(at(u,centre+d,z+dz) for d,dz in [(-beam*.039,0),(beam*.039,0),(beam*.039,.027),(-beam*.039,.027)])
                if j:
                    for k in range(4):
                        a=(j-1)*4+k;b=(j-1)*4+(k+1)%4
                        fs.append((a,b,b+4,a+4))
            art.mesh(vs,fs,'deckplank' if lane%3 else 'boat_oak')
        if kind=='cargo':
            art.part('07_woven_shelter')
            vs=[];fs=[]
            for j in range(9):
                u=length*(-.24+.48*j/8)
                for k in range(13):
                    a=k*math.pi/12;vs.append(at(u,math.cos(a)*beam*.46,.54+math.sin(a)*1.18))
                    if j and k:
                        b=j*13+k;fs.append((b-14,b-1,b,b-13))
            art.mesh(vs,fs,'reedmat')
            for j in [0,2,4,6,8]:
                art.line([vs[j*13+k] for k in range(13)],.027,'hemp',6)
            for k in [2,5,8,11]:
                art.beam(vs[k],vs[-13+k],.018,'timber',6)
        art.part('08_mooring_hardware')
        for t in [-.73,.76]:
            w,h,_=section(t)
            for sign in [-1,1]:
                pos=t*length/2
                art.beam(at(pos,sign*w*.85,h-.10),at(pos,sign*w*.85,h+.12),.041,'timber',8)
    # The visible reinforcing stem and narrow stern are part of the hull.
    for end in [-1,1]:
        u=end*length/2
        art.beam(at(u,0,.24),at(u,0,section(end)[1]),.035,'tarred',6)
    art.part(previous_part)
    return at

def landing(env,side,x=0,extent=4):
    # A modest landing follows the lateral position of the waterline.
    cross,width,_=env.channel(x,0)
    y=-cross+side*width
    env.landing_y=y
    for j in range(13):
        yy=y+side*(j*.33-1.05);z=.63+.035*j
        art.box((x,yy,z),(extent,.316,.13),'wood')
    for j in [-.8,1.1,2.9]:
        for edge in [-1,1]:
            xx=x+edge*(extent*.5-.12);yy=y+side*j
            art.beam((xx,yy,.06),(xx,yy,.97+max(0,j)*.045),.086,'timber',8)
    art.crates(x+3.3,y+side*3.0,env.height(x+3.3,y+side*3),4)
    return y

def boatman(env,at,u,v,h,yaw=0):
    env.figures.build(*at(u,v,h),height=1.68,yaw=yaw,pose='row',role='boatman')

def scene(env,scale):
    sid=env.sid; side=scale['side'];length,beam=scale['hull']
    env.hull_dimensions=(length,beam,scale.get('hullHeight',0))
    shore=landing(env,side,extent=3 if sid=='yudu' else 2.6)
    def land_person(x,y,pose='stand',yaw=0,role='porter'):
        floor=env.height(x,y)
        if sid=='chishui' and abs(x)<10.5 and .9<y<6.5:floor=max(1.86,floor)
        env.figures.build(x,y,floor+.025,height=env.rng.uniform(1.57,1.76),yaw=yaw,pose=pose,role=role)
    if sid=='yudu':
        width=scale['waterWidth']; bays=round(width/5.60)
        deck=lambda t:.83+.045*math.cos(t*math.pi*2)
        xx=lambda t:1.4*math.sin(t*math.pi*2)
        for j in range(bays):
            t=(j+.5)/bays
            vessel(env,xx(t),shore+t*width,length,beam,.035*math.sin(t*19),'pontoon',simple=j>3 and j<bays-2)
        pieces=math.ceil((width+1)/.72)
        for j in range(pieces):
            t=(j+.5)/pieces
            art.box((xx(t),shore+t*width,deck(t)),(2.28,width/pieces-.012,.12),'deckplank')
        for j in range(35):
            t=(j+.5)/35;px=xx(t)+.35*math.sin(j);py=shore+t*width
            env.figures.build(px,py,deck(t)+.06,height=env.rng.uniform(1.59,1.74),yaw=math.pi+.08*math.sin(j),pose='walk',role='walker')
        at=vessel(env,-7,shore+5.4,7.7,1.8,-.19,'ferry')
        boatman(env,at,2.55,0,.16,.5)
        land_person(2.7,shore-2,'greet',-1.4)
        env.boat_focus=(-6.2,shore+5,1.24)
    else:
        offset={'jiaoping':-6.3,'anshun':3.7,'chishui':-6.8,'xiangjiang':1.3}[sid]
        yy=shore-side*(3.4 if sid!='xiangjiang' else 5.4)
        kind={'anshun':'crescent','chishui':'cargo','xiangjiang':'cargo','jiaoping':'ferry'}[sid]
        angle={'anshun':.11,'jiaoping':-.21,'chishui':.08,'xiangjiang':-.13}[sid]
        at=vessel(env,offset,yy,length,beam,angle,kind)
        boatman(env,at,length*.32,0,.19,angle+1.02)
        if sid=='jiaoping':
            second=vessel(env,5.6,shore+side*-6.7,7.2,1.7,.20,'ferry')
            boatman(env,second,-2.05,0,.16,1.3)
        if sid=='chishui':
            vessel(env,6.4,yy-2.6,7.9,1.9,-.09,'cargo')
            # Old Tucheng's quay climbs inland, connecting the shops to water.
            art.masonry(0,3.7,.16,21,5.6,1.7)
            for j in range(9):art.box((1.5,.4+j*.45,.54+j*.166),(3.3,.46,.28),'dressed_stone')
        land_person(2.1,shore+side*3.1,'greet',-.66)
        land_person(-2.0,shore+side*4,'walk',.69)
        env.boat_focus=(offset,yy,1.2)
    # Human-level station objects share the exact ground function used by the mesh.
    for j in range(115):
        x=env.rng.uniform(-22,22);c,w,_=env.channel(x,0)
        y=-c+side*(w+env.rng.uniform(.4,8))
        if abs(x)<2.4:continue
        r=env.rng.uniform(.063,.26);art.rock((x,y,env.height(x,y)+r*.07),(r,r*.69,r*.44),'lightstone')

