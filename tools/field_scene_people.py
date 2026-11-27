"""Scoped figure corrections for Ruijin, Dawei and supplied meeting poses."""
import math


def _at(x,y,z,expected):
    return all(abs(a-b)<1e-4 for a,b in zip((x,y,z),expected))


def scene_actor_edit(sid,x,y,z,pose,role):
    if sid=='lianghekou' and role=='local' and pose=='sit' and abs(z-.25)<1e-4:
        if abs(y-.3)<1e-4 and any(abs(x-v)<1e-4 for v in (-2.5,0,2.5)):
            return {'id':'lianghekou-front-row-faces-table','position':[x,y,z],'role':role,'yaw':math.pi}
        if abs(y-3.3)<1e-4 and any(abs(x-v)<1e-4 for v in (-2.4,0,2.4)):
            # The house plinth starts at y=3.2 and its centre porch post is
            # (0,2.835). The model includes a stool and needs its whole footprint.
            return {'id':'lianghekou-back-row-clears-porch','position':[.65 if abs(x)<1e-4 else x,2.9,z],
                    'role':role,'yaw':0}
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
