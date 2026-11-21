"""Regional domestic architecture for the civilian landscape around the landmarks."""
import math
import history_south as art

def village_house(env,x,y,w,d,h,place_local):
    sid=env.sid
    family=('gannan' if sid in ['yudu','ruijin','xiangjiang'] else
            'waterfront' if sid in ['chishui','liping','jiaoping','anshun'] else
            'highland' if sid in ['baxi','dawei','lianghekou'] else
            'earth' if sid in ['hadapu','huining','jiangtai','wuqi'] else 'sichuan')
    turn=env.rng.uniform(-.28,.28)+(math.pi if env.rng.random()<.28 else 0)
    if sid=='luding':
        turn=math.copysign(math.pi/2,-x)+.12*math.sin(y*.13)
    c,s=math.cos(turn),math.sin(turn)
    floor=[env.height(x+a*c-b*s,y+a*s+b*c) for a in [-w/2,w/2] for b in [-d/2,d/2]]
    base=max(floor)+.14;low=min(floor)-.65
    tall=h*(1.46 if family=='waterfront' and env.rng.random()<.58 else 1)
    def body():
        art.part('01_plinth')
        art.box((0,0,(low+base)/2),(w+.18,d+.20,base-low),'stone' if family!='earth' else 'earth')
        wall={'gannan':'limewash','waterfront':'plankwall','sichuan':'limewash','earth':'earth','highland':'hillstone'}[family]
        # Hollow envelope. The front is built around the openings, so the
        # porch, sash and door reveal an actual interior and structural frame.
        thick=.18 if family in ['waterfront','sichuan'] else .29
        art.part('02_walls_with_openings')
        art.box((0,d/2-thick/2,base+tall/2),(w,thick,tall),wall)
        for sign in [-1,1]:
            art.box((sign*(w/2-thick/2),0,base+tall/2),(thick,d-.05,tall),wall)
        door_at=-w*.13; door_w=min(1.07,w*.235); door_h=min(1.96,tall*.82)
        win_w=min(w*.14,1.04);win_h=min(1.05,tall*.40);sill=tall*.47-win_h/2
        openings=[(-w*.36,win_w,sill,sill+win_h),(door_at,door_w,0,door_h),(w*.28,win_w,sill,sill+win_h)]
        face=-d/2+thick/2;prev=-w/2
        for cx,opening,lo,hi in openings:
            left,right=cx-opening/2,cx+opening/2
            if left>prev:art.box(((prev+left)/2,face,base+tall/2),(left-prev,thick,tall),wall)
            if lo:art.box((cx,face,base+lo/2),(opening,thick,lo),wall)
            art.box((cx,face,base+(hi+tall)/2),(opening,thick,tall-hi),wall)
            for jamb in [left,right]:
                art.box((jamb,face-.06,base+(hi+lo)/2),(.082,thick+.045,hi-lo+.10),'timber')
            art.box((cx,face-.06,base+hi+.025),(opening+.17,thick+.07,.09),'timber')
            if lo:
                art.box((cx,face-.13,base+lo),(opening+.20,thick+.21,.094),'dressed_stone')
                for f in [-.24,0,.24]:art.box((cx+f*opening,face,base+(lo+hi)/2),(.024,.055,hi-lo),'wood')
                art.box((cx,face-.012,base+(lo+hi)/2),(opening,.055,.032),'wood')
            prev=right
        art.box(((prev+w/2)/2,face,base+tall/2),(w/2-prev,thick,tall),wall)
        # A half-open door is a volumetric leaf with battens and an iron pull.
        hinge=door_at-door_w/2; ang=.78
        art.part('03_hinged_door')
        def door_pt(u,z):return (hinge+u*math.cos(ang),face+u*math.sin(ang),base+z)
        for board in range(7):
            art.box(door_pt((board+.5)*door_w/7,door_h/2),(door_w/7-.009,.071,door_h-.06),'plankwall',ang)
        for h0 in [.25,door_h-.28]:art.box(door_pt(door_w/2,h0),(door_w-.045,.10,.084),'timber',ang)
        art.part('04_columns_braces_and_ties')
        for u in [-.39,.02,.39]:
            for sign in [-1,1]:
                art.beam((u*w,sign*(d/2-.24),base),(u*w,sign*(d/2-.24),base+tall-.08),.085,'timber',8)
                if family!='highland' or sid!='baxi':
                    art.beam((u*w,sign*(d/2-.14),base+tall),(u*w,0,base+tall+d*.30),.087,'timber',8)
            art.beam((u*w,-d/2,base+tall-.10),(u*w,d/2,base+tall-.10),.10,'timber',8)
        front=-d/2-.055
        art.part('05_roof_and_parapets')
        if family=='highland' and sid=='baxi':
            art.box((0,0,base+tall+.12),(w+.48,d+.48,.26),'earth')
            for side in [-1,1]:
                art.box((0,side*d*.49,base+tall+.36),(w,.18,.46),'hillstone')
                art.box((side*w*.49,0,base+tall+.36),(.18,d,.46),'hillstone')
        else:
            hip=family=='sichuan';rise=min(2.1,d*.34)
            art.roof(0,0,base+tall,w+1,d+1.05,rise,hip,tiles=False)
            if family=='gannan':
                for side in [-1,1]:
                    for j in range(3):
                        width=d*(1-j*.27);height=.38+j*.25
                        art.box((side*w/2,0,base+tall+j*.49+.12),(.23,width,height+.45),'limewash')
                        art.box((side*w/2,0,base+tall+j*.49+.37+height*.5),(.36,width+.18,.13),'tile')
            if family=='earth':
                art.box((w*.24,d*.26,base+tall+rise*.8),(.5,.53,1.35),'greybrick')
        art.part('06_porches_and_steps')
        if family in ['waterfront','sichuan']:
            depth=min(1.24,d*.27)
            art.box((0,front-depth/2,base+.06),(w+.22,depth,.16),'wood')
            for xx in [-w*.44,-w*.15,w*.17,w*.44]:
                soffit=base+tall*(.91-.21*(depth+.12)/(depth+.45))
                art.beam((xx,front-depth,low),(xx,front-depth,soffit-.015),.10,'timber',7)
            art.mesh([(-w*.56,front+.12,base+tall*.91),(w*.56,front+.12,base+tall*.91),
                      (w*.56,front-depth-.33,base+tall*.70),(-w*.56,front-depth-.33,base+tall*.70)],[(0,1,2,3)],'tile')
            for a,b in [(-w*.48,-w*.24),(w*.03,w*.48)]:art.fence((a,front-depth),(b,front-depth),base+.16,.66,spacing=.36)
            for xx in [-w*.42,-w*.23,.02*w,.23*w,.42*w]:art.box((xx,front-.023,base+tall*.51),(.075,.085,tall*.95),'timber')
        else:
            for j in range(3):
                art.box((-w*.17,front-.20-j*.25,base+.035-j*.10),(1.46,.28,.15),'dressed_stone')
        if family in ['gannan','earth']:
            for i in range(2):
                art.jar(w*.32+i*.42,front-.43,base+.03,.21+i*.04,.40+i*.12,'clay')
    place_local(x,y,turn,'regional_dwellings',body)
    env.houses.append((x,y,w,d))

