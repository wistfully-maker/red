"""Explicit, station-local figure corrections for the reviewed historical scenes."""
import math


def _at(x,y,z,expected):
    return all(abs(a-b)<1e-4 for a,b in zip((x,y,z),expected))


def scene_actor_edit(sid,x,y,z,pose,role):
    if sid=='liping' and role=='local':
        if _at(x,y,z,(2.8,-4.5,.95)):
            return {'id':'liping-stair-porter','position':[x,y,z],'role':role,'asset':'old-porter'}
        if _at(x,y,z,(2.7,2.4,2.60)):
            return {'id':'liping-stair-soldier','position':[x,y,z],'role':'soldier','asset':'marcher-male'}
        if _at(x,y,z,(-5.4,-6.8,.28)):
            return {'id':'liping-shopkeeper-clears-wall','position':[-2,-7.5,.24],
                    'role':'farmer','asset':'farmer-greeting','yaw':.55}
        if pose=='walk' and -1.3<x<2.6 and -10.8<y<-9.7:
            if abs(x-1.59)<1e-4:
                return {'id':'liping-single-craftswoman','position':[x,y,z],
                        'role':role,'asset':'seated-civilian-woman','yaw':0}
            return {'id':'liping-remove-crowded-market-duplicate','remove':True}
    if sid=='zunyi' and role=='local':
        if _at(x,y,z,(.55,-4.4,.32)):
            return {'id':'zunyi-resident-before-steps','position':[-.50,-5.35,.332],
                    'role':role,'asset':'old-porter','yaw':-.12}
        if _at(x,y,z,(1.2,-4.1,.32)):
            return {'id':'zunyi-soldier-before-steps','position':[1.15,-5.35,.332],
                    'role':'soldier','asset':'marcher-male','yaw':.08}
    if sid=='chishui':
        if role=='boatman' and pose=='row' and abs(x+3.9930065)<1e-4:
            # Actual hull/deck triangle scan: the source soles intersected the
            # deck at z=.60-.67. Five centimetres puts the feet on its surface.
            return {'id':'chishui-boatman-on-deck','position':[x,y,z+.05],'role':role}
        # The seven generated market extras crossed the four actual waterfront
        # house envelopes. Three separate layers had also repeated the porter.
        if role=='porter' and pose=='walk' and 4.6<y<5.5:
            return {'id':'chishui-remove-market-duplicate','remove':True}
        if role=='local' and _at(x,y,z,(-2.4,3.32,1.87)):
            return {'id':'chishui-clear-workbench-neighbour','remove':True}
        if role=='porter' and pose=='greet' and abs(x-2.1)<1e-4:
            return {'id':'chishui-single-soldier','position':[x,y,z],
                    'role':'soldier','asset':'marcher-male','yaw':-.66}
        if role=='porter' and pose=='walk' and abs(x+2)<1e-4:
            return {'id':'chishui-single-porter','position':[x,y,z],'role':role,'asset':'old-porter'}
    # Old Lianghekou authoring coordinates are retained as selectors, while the
    # whole meeting now occupies the level paved forecourt, ahead of the steps.
    if sid=='lianghekou' and role=='local' and pose=='sit' and abs(z-.25)<1e-4:
        if abs(y-.3)<1e-4 and any(abs(x-v)<1e-4 for v in (-2.5,0,2.5)):
            return {'id':'lianghekou-front-row-faces-table','position':[x,-2.9,.165],'role':'delegate','yaw':math.pi}
        if abs(y-3.3)<1e-4 and any(abs(x-v)<1e-4 for v in (-2.4,0,2.4)):
            return {'id':'lianghekou-back-row-clears-porch','position':[x,.5,.165],
                    'role':'delegate','yaw':0}
    if sid=='baxi' and role=='local':
        if pose=='sit' and any(_at(x,y,z,p) for p in [(-4,0,.25),(-2,-1,.25),(0,-1.5,.25),(2,-1,.25),(4,0,.25)]):
            return {'id':'baxi-delegates-face-table','position':[x,y,z],'role':role,'yaw':math.pi}
        if pose=='greet' and _at(x,y,z,(0,1.4,.9)):
            return {'id':'baxi-speaker-faces-delegates','position':[x,y,z],'role':role,'yaw':0}
    if sid=='ruijin' and role=='local':
        if pose in ('stand','walk') and _at(x,y,z,(-1.4,-1.1,3.65)):
            return {'id':'ruijin-courtyard-farmer','position':[x,y,z],'role':'farmer'}
        if pose=='write' and _at(x,y,z,(-2.76,-.02,3.66)):
            # The left wing's east wall is x=-2.65. Keep the entire reader,
            # hands and journal on its courtyard side, behind the existing desk.
            return {'id':'ruijin-reader-clearance','position':[-1.85,-.02,3.66],'role':role}
    if sid=='dawei' and role=='walker' and pose=='greet':
        for position in [(-2.1,.33,2.89),(-.5,-.33,2.89)]:
            if _at(x,y,z,position):
                return {'id':'dawei-procedural-greeter','remove':True}
    return None
