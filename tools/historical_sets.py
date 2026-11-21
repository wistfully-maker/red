"""Human-scale historical set dressing. All terrain contacts use the station's mesh datum.
Sources/limits are in the published scene notes. Figures represent anonymous participants.
"""
import math,random
import history_south as a
TAU=math.tau

def hoop(x,y,z,rx,ry,tube,mat,steps=18):
    a.line([(x+rx*math.cos(k*TAU/steps),y+ry*math.sin(k*TAU/steps),z) for k in range(steps+1)],tube,mat,6)

def table(x,y,z,w=2.1,d=.85,h=.82):
    for k in range(4):
        a.box((x,y+((k+.5)/4-.5)*d,z+h),(w,d/4-.008,.072),'chestnut')
    for dx in [-w*.41,w*.41]:
        for dy in [-d*.37,d*.37]:
            a.box((x+dx,y+dy,z+h/2),(.075,.075,h),'timber')
        a.box((x+dx,y,z+.24),(.055,d*.78,.064),'timber')
    for dy in [-d*.37,d*.37]:a.box((x,y+dy,z+h-.09),(w*.9,.055,.10),'chestnut')
    return z+h+.036

def papers(x,y,z,amount=4):
    for k in range(amount):
        ang=.08*math.sin(k*2.1)
        a.box((x+.048*k,y+.021*k,z+.005*k),(.39,.28,.006),'pages',ang)
        for j in range(6):
            a.box((x+.048*k-.11+j*.041,y+.02*k,z+.005*k+.004),(.009,.168-(j%3)*.017,.002),'ink')

def folding_chair(x,y,z,rot):
    c,s=math.cos(rot),math.sin(rot)
    def p(u,v,h):return (x+c*u-s*v,y+s*u+c*v,z+h)
    for sign in [-1,1]:
        a.beam(p(sign*.216,-.224,.01),p(sign*.216,.155,.523),.029,'chestnut',8)
        a.beam(p(sign*.215,.243,.01),p(sign*.215,-.218,.477),.030,'chestnut',8)
        a.beam(p(sign*.228,.16,.46),p(sign*.228,.233,.925),.026,'chestnut',8)
    a.box(p(0,0,.468),(.472,.438,.034),'reedmat',rot)
    a.box(p(0,.220,.835),(.49,.061,.13),'chestnut',rot)
    for k in [-1,0,1]:a.beam(p(k*.11,.173,.53),p(k*.11,.221,.80),.017,'wood',6)
    a.beam(p(-.217,-.19,.16),p(.217,-.19,.16),.023,'wood')

def lantern(x,y,z,s=1):
    a.beam((x,y,z),(x,y,z+.10*s),.13*s,'iron',16)
    a.jar(x,y,z+.085*s,.104*s,.225*s,'lampglass')
    a.beam((x,y,z+.30*s),(x,y,z+.38*s),.071*s,'iron',12)
    for sign in [-1,1]:
        a.line([(x+sign*.09*s,y,z+.038*s),(x+sign*.13*s,y,z+.23*s),(x+sign*.076*s,y,z+.334*s)],.013*s,'iron',6)
    a.line([(x+.095*s*math.cos(j*math.pi/14),y,z+.35*s+.17*s*math.sin(j*math.pi/14)) for j in range(15)],.010*s,'iron',6)

def basket(x,y,z,r=.32,h=.40):
    a.jar(x,y,z,r,h,'reedmat')
    for k in range(7):hoop(x,y,z+h*(.13+k*.11),r*(.80+.16*math.sin(k*.51)),r*(.80+.16*math.sin(k*.51)),.009,'hemp')
    a.line([(x+r*.69*math.cos(j*math.pi/15),y,z+h*.91+.26*math.sin(j*math.pi/15)) for j in range(16)],.019,'hemp',6)

def bedroll(x,y,z,ang=0):
    c,s=math.cos(ang),math.sin(ang)
    a.beam((x-.40*c,y-.40*s,z+.14),(x+.40*c,y+.40*s,z+.14),.145,'wraps',16)
    for t in [-.23,.23]:
        a.beam((x+(t-.017)*c,y+(t-.017)*s,z+.14),(x+(t+.017)*c,y+(t+.017)*s,z+.14),.153,'leather',14)

def cart(x,y,z):
    for side in [-1,1]:
        xx=x+side*.70;cy=y+.23;cz=z+.55
        vs=[(xx,cy+.53*math.cos(i*TAU/30),cz+.53*math.sin(i*TAU/30)) for i in range(31)]
        a.line(vs,.047,'timber',7)
        for k in range(12):
            a.beam((xx,cy,cz),vs[round(k*30/12)],.023,'wood',5)
    for s in [-1,1]:a.beam((x+s*.49,y-2.03,z+.86),(x+s*.49,y+1,z+.62),.065,'wood')
    for k in range(10):a.box((x,y-.52+.157*k,z+.64),(1.27,.145,.074),'deckplank')
    a.beam((x-.78,y+.23,z+.55),(x+.78,y+.23,z+.55),.07,'iron')
    for sign in [-1,1]:a.box((x+sign*.65,y+.15,z+.8),(.052,1.72,.25),'wood')

def board(x,y,z,ang=0,patched=False):
    c,s=math.cos(ang),math.sin(ang)
    def p(u,v,h):return (x+c*u-s*v,y+s*u+c*v,z+h)
    for j in range(4):a.box(p(0,(j-1.5)*.163,.03),(1.89,.157,.061),'boat_oak' if j%2 else 'wood',ang)
    for u in [-.58,.57]:a.box(p(u,0,.089),(.099,.65,.066),'timber',ang)
    if patched:
        a.box(p(-.21,.071,.077),(.52,.19,.028),'deckplank',ang+.12)
        for u in [-.38,-.06]:a.beam(p(u,.07,.078),p(u,.07,.096),.015,'iron',8)
def rack(x,y,z,w=1.8):
    for side in [-1,1]:
        for leg in [-1,1]:
            a.beam((x+side*w*.38,y+leg*.33,z),(x+side*w*.38,y-leg*.08,z+.75),.043,'timber')
    a.box((x,y,z+.74),(w,.19,.10),'wood')
    return z+.79

def shelter(x,y,z,w,d):
    for dx in [-w*.45,w*.45]:
        for dy in [-d*.46,d*.46]:
            a.beam((x+dx,y+dy,z),(x+dx,y+dy,z+1.88+(.24 if dy>0 else 0)),.054,'timber',8)
    vs=[];fs=[]
    for j in range(7):
        v=j/6
        for k in range(12):
            u=k/11;vs.append((x+(u-.5)*w,y+(v-.5)*d,z+1.89+v*.27-.15*math.sin(math.pi*u)*math.sin(math.pi*v)+.036*math.sin(5*math.pi*u)))
            if j and k:
                n=j*12+k;fs.append((n-13,n-12,n,n-1))
    a.mesh(vs,fs,'sailcloth')

def litter(x,y,z):
    for sign in [-1,1]:a.beam((x+sign*.33,y-1.25,z+.16),(x+sign*.33,y+1.25,z+.16),.039,'wood',8)
    vs=[];fs=[]
    for j in range(8):
        for i in range(7):
            u=i/6;vs.append((x+(u-.5)*.69,y-.86+j*.249,z+.18-.055*math.sin(math.pi*u)))
            k=j*7+i
            if j and i:fs.append((k-8,k-7,k,k-1))
    a.mesh(vs,fs,'sailcloth');bedroll(x,y+.65,z+.17)

def kettle(x,y,z):
    a.jar(x,y,z,.198,.28,'iron')
    a.beam((x+.15,y,z+.16),(x+.31,y,z+.24),.042,'iron')
    a.line([(x+.14*math.cos(j*math.pi/12),y,z+.24+.19*math.sin(j*math.pi/12)) for j in range(13)],.016,'iron',6)

def packs(x,y,z):
    for k in range(3):
        xx=x+(k-1)*.64;yy=y+.17*math.sin(k)
        a.box((xx,yy,z+.24),(.47,.34,.44),'bag',.08*k)
        bedroll(xx,yy,z+.47,.06*k)

def workbench(x,y,z):
    top=table(x,y,z,2.3,.97)
    for k in range(3):
        a.box((x-.77+k*.37,y-.08,top+.04),(.23,.11,.072),'timber',.12*k)
        a.beam((x-.77+k*.37,y-.09,top+.063),(x-.77+k*.37,y+.17,top+.08),.013,'iron')
    return top

def bowl(x,y,z,r=.095):
    a.jar(x,y,z,r,r*.85,'clay')

def meal(x,y,z):
    top=table(x,y,z,3.1,1.08)
    for side in [-1,1]:
        a.box((x,y+side*.91,z+.43),(3.05,.34,.09),'wood')
        for dx in [-1.16,1.16]:a.box((x+dx,y+side*.91,z+.21),(.10,.26,.42),'timber')
        for j in range(4):bowl(x-1.11+j*.72,y+side*.33,top)
    kettle(x+.32,y,top);basket(x+1.96,y+.62,z)

def zunyi(env):
    # The long hall is opened architecturally in the "meeting room" camera.
    # Around the solid long table: eight chairs per side and two per end.
    z=3.416;x=-.22;y=.92
    top=table(x,y,z,4.95,1.28,.79)
    for side in [-1,1]:
        for j in range(8):folding_chair(x-2.22+j*.634,y+side*1.02,z,0 if side>0 else math.pi)
        for v in [-.38,.38]:folding_chair(x+side*2.88,y+v,z,(-math.pi/2 if side>0 else math.pi/2))
    for i in [-1,0,1]:papers(x+i*1.21,y+.09,top,2)
    a.jar(x+.18,y-.45,z,.22,.23,'iron')
    for cx in [-2.8,2.26]:
        a.box((cx,2.93,z+.93),(1.06,.43,1.85),'chestnut')
        for dx in [-.235,.235]:
            a.box((cx+dx,2.692,z+1.03),(.43,.043,1.37),'smoke_glass' if cx<0 else 'wood')
            a.beam((cx+dx*.3,2.65,z+.84),(cx+dx*.3,2.65,z+.94),.012,'brass')
    a.box((.18,2.90,z+1.67),(.36,.18,.75),'chestnut')
    a.beam((.18,2.80,z+1.84),(.18,2.77,z+1.84),.133,'clockface',32)
    a.line([(.18,2.755,z+1.935),(.18,2.752,z+1.84),(.255,2.751,z+1.81)],.008,'iron',5)
    a.beam((x,y,z+2.48),(x,y,z+2.00),.014,'iron')
    vv=[(x,y,z+2.08)]+[(x+.32*math.cos(i*TAU/40),y+.32*math.sin(i*TAU/40),z+1.91+.035*math.cos(i*TAU/5)) for i in range(40)]
    a.mesh(vv,[(0,i+1,(i+1)%40+1) for i in range(40)],'lampglass')
    a.jar(x,y,z+1.74,.085,.19,'lampglass')
    env.tableau=(-.2,.92,4.22,6.9,.85,.52)

def dress(env):
    sid=env.sid;h=env.height
    a.part('Historic tableau '+sid)
    def person(x,y,z,pose='stand',yaw=0,role='local'):env.figures.build(x,y,z,1.64+env.rng.uniform(-.07,.09),yaw,pose,role)
    def focus(x,y,z,d=6,b=.35,p=.40):env.tableau=(x,y,z,d,b,p)
    if sid=='zunyi':zunyi(env);return
    if sid=='ruijin':
        x,y=-3.0,-.8;z=3.66;top=table(x,y,z,2.45,.84)
        papers(x-.55,y,top,7);lantern(x+.71,y,top);packs(x-1,y-1.5,z);person(x+.24,y+.78,z,'write',.3)
        focus(x,y,z+.84,7.4)
    elif sid=='yudu':
        x,y=-5.0,-4.8;z=h(x,y);cart(x,y,z);board(x,y,z+.73);board(x+.10,y,z+.88,.08)
        basket(x-1.3,y+.1,z);basket(x+2.3,y-.8,z,.21,.23);person(x+1.1,y-.24,z,'greet',1.1)
        for j in range(3):bedroll(x+2.1,y-1.65-j*.35,z,.12*j)
        focus(x,y,z+.76,9.8,-.47,.43)
    elif sid in ('xiangjiang','lazikou'):
        x,y=(-7.8,-5.2) if sid=='xiangjiang' else (7.8,3.3)
        z=h(x,y);shelter(x,y,z,4.1,3.0);litter(x-.6,y,z);kettle(x+.72,y+.62,z)
        basket(x+1.1,y-.2,z,.25,.32);table(x+.95,y+.9,z,1.15,.53,.52);person(x+.72,y-.72,z,'sit',-.55)
        focus(x,y,z+.66,8.3,-.55,.39)
    elif sid=='liping':
        x,y=.10,-8.9;z=h(x,y)
        top=table(x,y,z,2.6,1.02,.75)
        for k in range(4):a.jar(x-.8+k*.42,y+.16,top,.12+.03*(k%2),.28+.06*(k%2),'clay')
        for i in range(3):basket(x-1.1+i*.53,y-1.04,z,.25,.34)
        cart(x+2.7,y-1.5,h(x+2.7,y-1.5));person(x+.42,y+.75,z,'write',.11);papers(x+.57,y-.19,top)
        focus(x+.2,y,z+.85,8.1,.12,.43)
    elif sid=='chishui':
        x,y=-3.8,2.5;z=1.87
        rack(x-1.1,y,z);board(x-1.1,y,z+.79,.08,True)
        for j in range(2):board(x+1.36,y-.40+j*.79,z+.02,.11*j,True)
        workbench(x-3.1,y+1.7,z);basket(x+.4,y+1.18,z)
        person(x-.8,y-.93,z,'greet',2.9);person(x+1.4,y+.82,z,'stand',-.32)
        focus(x,y,z+.63,8.2,-.46,.48)
    elif sid=='luding':
        x,y=-60.0,4.5;z=h(x,y)
        top=table(x,y,z,2.3,1.0);kettle(x-.5,y,top)
        for i in range(4):bowl(x+.22+.23*i,y-.17,top,.092)
        basket(x+.82,y+.85,z,.32,.42);packs(x-1.65,y+.34,z)
        folding_chair(x+.1,y+.86,z,0);person(x-.73,y+.71,z,'stand',.2)
        focus(x,y,z+.77,6.9,-.55,.53)
    elif sid in ('jiaoping','anshun'):
        x,y={'jiaoping':(6.4,2.3),'anshun':(-5.7,-4.1)}[sid];z=h(x,y)
        rack(x,y,z,2.35)
        for j in range(3):
            a.beam((x-1.42,y-.28+j*.25,z+.89),(x+1.3,y-.28+j*.25,z+.87),.031,'wood',8)
            a.box((x+1.44,y-.28+j*.25,z+.87),(.51,.16,.052),'boat_oak')
        kettle(x-.7,y+1.3,z);basket(x-1.65,y-.55,z);packs(x+.2,y+2.1,z)
        person(x+1.7,y-.48,z,'stand',2.3);focus(x,y,z+.8,9.5,.49,.37)
    elif sid in ('jiajin','songpan'):
        x,y=(1.9,3.3) if sid=='jiajin' else (2.5,1.4);z=h(x,y)
        bedroll(x,y,z);bedroll(x+.15,y+.42,z,.21);lantern(x-.61,y-.30,z,1.07);kettle(x+.54,y-.36,z)
        a.box((x+.24,y-.64,z+.095),(.34,.22,.17),'bag')
        person(x+.94,y+.32,h(x+.94,y+.32),'sit',-.56)
        focus(x,y,z+.51,7.0,-.59,.42)
    elif sid=='dawei':
        x,y=-8.5,-1.0;z=h(x,y);top=table(x,y,z,1.56,.82,.76)
        kettle(x,y,top);bowl(x+.38,y-.16,top);basket(x-.64,y+.64,z)
        person(x+.45,y+.91,z,'greet',.4);focus(x,y,z+.95,8,.93,.38)
    elif sid in ('lianghekou','baxi'):
        x,y=(-1.4,-3.7) if sid=='lianghekou' else (4.9,-4.0);z=h(x,y)+.17;top=table(x,y,z)
        papers(x-.52,y,top,3);a.box((x+.53,y+.08,top+.049),(.57,.38,.085),'bag')
        lantern(x+.70,y-.24,top);bedroll(x-1.45,y-.45,z);person(x-.46,y+.67,z,'write',.12)
        focus(x,y,z+.85,7.9,.61,.40)
    elif sid=='hadapu':
        x,y=-3.15,-7.3;z=.23;top=table(x,y,z,2.08,.87,.75)
        papers(x-.31,y-.04,top,7);a.box((x+.52,y+.09,top+.055),(.44,.30,.104),'pages')
        for j in range(3):bowl(x-.67+j*.22,y+.24,top,.081)
        person(x+.25,y+.72,z,'write',-.1);person(x-1.4,y-.42,z,'stand',-.82)
        focus(x,y,z+.87,7,-.64,.40)
    elif sid=='wuqi':
        x,y=1.4,.62;z=.25
        # Repaired earthenware water crock, described locally as the "Red Army pot".
        rings=[(.035,.242),(.10,.308),(.30,.38),(.53,.399),(.68,.371),(.76,.327),(.79,.341),
               (.81,.331),(.804,.302),(.755,.296),(.62,.343),(.30,.347),(.09,.212)]
        vs=[];fs=[]
        for j,(zz,rr) in enumerate(rings):
            for k in range(36):
                ang=k*TAU/36;r=rr*(1+.008*math.sin(ang*5+.7*j))
                vs.append((x+r*math.cos(ang),y+r*math.sin(ang),z+zz))
                if j:
                    q=(j-1)*36+k;b=(j-1)*36+(k+1)%36;fs.append((q,b,b+36,q+36))
        fs.append(tuple(range(12*36,13*36)));a.mesh(vs,fs,'firedclay')
        for t,r in [(.32,.385),(.51,.402),(.64,.382)]:hoop(x,y,z+t,r,r,.011,'hemp',36)
        basket(x+1.03,y-.26,z,.22,.28);bowl(x-.87,y-.22,z,.14)
        table(x-1.5,y+.9,z,1.8,.76,.64);person(x+.73,y+.57,z,'greet',.2)
        focus(x,y,z+.62,6.9,.38,.37)
    elif sid=='huining':
        x,y=-6.5,-5.8;z=.25;meal(x,y,z);meal(x+4.2,y+.21,z)
        person(x-.86,y+1.52,z,'stand',.8);person(x+2.4,y+1.4,z,'greet',-.28)
        focus(x+1.1,y,z+.80,10.5,.47,.36)
    elif sid=='jiangtai':
        x,y=4.1,-10.8;z=h(x,y)
        top=table(x,y,z,1.44,.72,.58)
        a.box((x,y,top+.10),(.31,.23,.20),'reedmat');a.box((x,y,top+.216),(.34,.25,.044),'reedmat')
        for dx in [-.11,.11]:a.box((x+dx,y,top+.12),(.022,.26,.24),'leather')
        packs(x-1.5,y+.5,z);person(x+.75,y+.4,z,'stand',-.6)
        focus(x,y,z+.74,7.5,.73,.38)

