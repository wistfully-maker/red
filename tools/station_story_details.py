"""Small narrative connections around existing station tableaux.

Anonymous people and the arrangement of everyday objects are interpretation.
No historical writing, specific named participant or new memorial is invented.
The Luding scene is deliberately excluded from this module.
"""
import math
import history_south as art
import historical_sets as props

TAU=math.tau


def rope_coil(x,y,z,r=.23,turns=3):
    points=[]
    for j in range(turns*32+1):
        t=j/32*TAU;radius=r*(.62+.38*j/(turns*32))
        points.append((x+radius*math.cos(t),y+radius*.77*math.sin(t),z+.020+.006*j/(turns*32)))
    art.line(points,.016,'hemp',5)


def tied_bundle(x,y,z,w=.49,d=.35,h=.37,yaw=0):
    c,s=math.cos(yaw),math.sin(yaw)
    def p(u,v,up):return (x+c*u-s*v,y+s*u+c*v,z+up)
    art.box(p(0,0,h/2),(w,d,h),'bag',yaw)
    for u in [-w*.29,w*.29]:
        art.line([p(u,-d*.51,.03),p(u,-d*.51,h),p(u,d*.51,h+.012),p(u,d*.51,.02)],.012,'hemp',5)
    art.line([p(-w*.49,0,h*.84),p(0,0,h+.022),p(w*.49,0,h*.84)],.012,'hemp',5)


def teacup(x,y,z):
    art.jar(x,y,z,.061,.083,'paper')
    art.beam((x,y,z+.081),(x,y,z+.091),.066,'paper',16)
    art.beam((x,y,z+.090),(x,y,z+.105),.019,'chestnut',10)


def ladle(x,y,z,angle=.1):
    c,s=math.cos(angle),math.sin(angle)
    art.beam((x,y,z+.035),(x+.43*c,y+.43*s,z+.055),.018,'wood',7)
    art.jar(x+.47*c,y+.47*s,z+.006,.075,.043,'wood')


def inkstone(x,y,z):
    art.box((x,y,z+.021),(.21,.13,.042),'tarred',.06)
    art.box((x-.025,y,z+.043),(.12,.075,.007),'ink',.06)
    art.beam((x-.04,y-.125,z+.032),(x+.18,y-.09,z+.038),.009,'pencil',6)
    for dx in [-.065,.04]:art.box((x+dx,y-.10,z+.014),(.028,.058,.024),'clay')


def medical_tray(x,y,z):
    art.box((x,y,z+.020),(.42,.29,.039),'wood')
    for j in [-1,0,1]:
        art.beam((x-.12+j*.11,y-.055,z+.064),(x-.12+j*.11,y+.048,z+.064),.037,'wraps',12)
    art.jar(x+.12,y+.047,z+.04,.046,.097,'clay')


def add(env):
    sid=env.sid
    if sid=='luding':return
    previous=art.PART;art.part('Story details '+sid)
    features=[]
    def feature(label,p):features.append({'label':label,'point':list(p)})
    h=env.height

    if sid in ('yudu','xiangjiang','chishui','jiaoping','anshun'):
        side={'yudu':-1,'xiangjiang':-1,'chishui':1,'jiaoping':1,'anshun':-1}[sid]
        shore=env.landing_y
        length,beam,_=env.hull_dimensions
        if sid=='yudu':bx,by,length,beam,angle=-7,shore+5.4,7.7,1.8,-.19
        else:
            bx,by,_=env.boat_focus
            angle={'xiangjiang':-.13,'chishui':.08,'jiaoping':-.21,'anshun':.11}[sid]
        water=h(bx,by);c,s=math.cos(angle),math.sin(angle)
        t=.76;u=t*length/2;w=beam*.5*(1-t**2.4)**.69
        rise=1.96 if sid=='anshun' else .98 if sid in ('xiangjiang','chishui') else .68
        sheer=.44+(rise-.44)*t**3.1
        # This exact point lies on the vessel's existing near-bank wooden cleat.
        end=(bx+c*u-s*side*w*.85,by+s*u+c*side*w*.85,water+sheer+.04)
        px=bx+c*u;py=shore+side*1.65;floor=h(px,py)
        if sid=='chishui' and abs(px)<10.5:floor=max(floor,1.86)
        art.beam((px,py,floor-.13),(px+.018,py,floor+.73),.088,'timber',10)
        for z in [.11,.52]:
            art.beam((px,py,floor+z),(px,py,floor+z+.042),.092,'iron',10)
        for j in range(3):props.hoop(px,py,floor+.61+j*.026,.100,.100,.015,'hemp',18)
        start=(px+.06,py,floor+.65)
        points=[]
        for j in range(31):
            a=j/30
            points.append(tuple(start[k]*(1-a)+end[k]*a-(.17*math.sin(math.pi*a) if k==2 else 0) for k in range(3)))
        art.line(points,.019,'hemp',6)
        for dz in [-.018,.014]:props.hoop(end[0],end[1],end[2]+dz,.055,.055,.012,'hemp',14)
        rope_coil(px+.43,py+side*.12,floor)
        feature('mooring rope connected to the existing boat cleat',(px,py,floor+.66))
        if sid=='yudu':
            tied_bundle(bx-.42*c,by-.42*s,water+.165,.49,.37,.36,angle)
            feature('tied luggage inside the existing ferry',(bx-.42*c,by-.42*s,water+.36))

    if sid=='jiajin':
        # The supplied resting marcher includes its rolled bedding. Keep the
        # neighbouring rocks, without putting the old supporting rock through it.
        x,y=2.84,3.62;floor=h(x,y)
        for x0,y0,sx,sy,sz in [(3.85,4.45,.58,.48,.67),(3.36,4.67,.52,.57,.60)]:
            art.rock((x0,y0,h(x0,y0)-.10),(sx,sy,sz),'rock',seed=round(x0*100))
        base=(3.53,4.02,h(3.53,4.02)-.10);top=(3.20,3.91,floor+1.24)
        from field_supplied import place_stick_between
        if place_stick_between(env,base,top) is None:
            art.beam(base,top,.024,'wood',8,r2=.019)
            art.line([(top[0],top[1],top[2]-.10),(top[0]-.09,top[1]-.025,top[2]-.18),(top[0]-.05,top[1]-.05,top[2]-.30)],.009,'hemp',5)
        for yy in [1.05,1.53,2.01,2.49]:
            for side in [-1,1]:
                xx=.3+1.1*math.sin(yy*.31)+side*.13;cy=yy+side*.13
                points=[(xx+.061*math.cos(j*TAU/12),cy+.126*math.sin(j*TAU/12),h(xx+.061*math.cos(j*TAU/12),cy+.126*math.sin(j*TAU/12))+.008) for j in range(12)]
                art.mesh(points,[tuple(range(12))],'lightstone')
        feature('resting marcher seated on rolled bedding',(x,y,floor+.47))
        feature('walking staff resting in the rock gap',top)

    if sid=='zunyi':
        floor=3.416;top=floor+.826;x,y=-.22,.92
        inkstone(x+.63,y-.28,top)
        for dx,dy in [(-1.80,.32),(.03,.32),(1.85,-.30)]:teacup(x+dx,y+dy,top)
        # Two existing folding chairs receive anonymous participants; the other
        # chairs and the central paper sightline remain readable.
        for j in [3,5]:
            env.figures.build(x-2.22+j*.634,y-1.02,floor,1.65,math.pi,'sit','delegate')
        art.box((-4.42,3.035,floor+1.78),(1.05,.075,.105),'chestnut')
        for xx in [-4.83,-4.42,-4.01]:art.beam((xx,3.01,floor+1.78),(xx,2.85,floor+1.78),.025,'wood',8)
        art.box((-4.77,2.88,floor+1.10),(.33,.12,.37),'bag',-.06)
        art.line([(-4.91,2.87,floor+1.27),(-4.84,2.83,floor+1.78),(-4.62,2.87,floor+1.26)],.020,'leather',6)
        art.beam((-5.2,2.77,floor+.02),(-5.0,2.91,floor+1.61),.025,'wood',8,r2=.018)
        feature('tea and inkstone on the existing meeting table',(x+.63,y-.28,top+.05))
        feature('satchel hanging on wall-side pegs',(-4.77,2.85,floor+1.10))

    if sid in ('xiangjiang','lazikou'):
        x,y=(-7.8,-5.2) if sid=='xiangjiang' else (7.8,3.3)
        floor=h(x,y);medical_tray(x+.95,y+.90,floor+.556)
        feature('rolled dressing on the existing care table',(x+.95,y+.90,floor+.63))
    if sid in ('ruijin','lianghekou','baxi','hadapu'):
        x,y,z={'ruijin':(-3.,-.8,3.66),'lianghekou':(-6.5,-3.7,.165),
               'baxi':(4.9,-4.,h(4.9,-4.)+.17),'hadapu':(-3.15,-7.3,.23)}[sid]
        top=z+(.786 if sid=='hadapu' else .856)
        # A wooden ruler rests on the table beside the existing paper stack.
        art.box((x-.40,y-.17,top+.018),(.37,.034,.036),'wood',.13)
        feature('wooden ruler beside the existing written papers',(x-.40,y-.17,top+.035))
    if sid=='liping':
        x,y,z=.10,-8.9,h(.10,-8.9)+.786
        for k in range(8):
            xx=x-.92+k*.027
            art.beam((xx,y-.30,z+.025),(xx+.045,y+.005,z+.045),.009,'hemp',5)
        art.line([(x-.99,y-.15,z+.02),(x-.77,y-.15,z+.059),(x-.69,y-.15,z+.02)],.012,'leather',5)
        feature('tied dry stems on the existing shop table',(x-.82,y-.15,z+.05))
    if sid=='dawei':
        x,y=-8.5,-1.;z=h(x,y)+.796
        ladle(x-.42,y-.25,z,.2)
        feature('dipper beside the bridgehead water kettle',(x-.2,y-.25,z+.05))
    if sid=='huining':
        x,y,z=-6.5,-5.8,.25+.856
        ladle(x-.90,y,z,-.12)
        feature('serving ladle between the existing meal bowls',(x-.65,y,z+.05))
    if sid=='jiangtai':
        x,y=4.1,-10.8;z=h(x,y)+.616
        art.beam((x+.32,y-.08,z+.028),(x+.60,y-.02,z+.032),.012,'wood',7)
        art.jar(x+.63,y-.01,z+.006,.041,.026,'wood')
        feature('small measure beside the existing salt box',(x+.51,y-.04,z+.03))

    env.story_details=features
    art.part(previous)
