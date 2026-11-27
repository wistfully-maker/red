"""Use user-returned people/props in historical scene generation.

All historical poses use shared textured user-supplied meshes, including the
numbered 01–09 set. The contemporary recorder keeps its independent anchor.
"""
from collections import Counter
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix,Vector

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'assets/models/field-supplied/catalog.json'
_ORIGINAL_PROPS={}


def catalog():
    return json.loads(CATALOG.read_text(encoding='utf-8'))['assets'] if CATALOG.is_file() else {}


def _template(env,key):
    records=catalog();record=records.get(key)
    if record is None:return None
    path=ROOT/record['file']
    if not path.is_file():return None
    cache=getattr(env,'_field_supplied_templates',None)
    if cache is None:cache={};env._field_supplied_templates=cache
    if key not in cache:
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported=[obj for obj in bpy.data.objects if obj not in before]
        meshes=[obj for obj in imported if obj.type=='MESH']
        if len(meshes)!=1:raise ValueError('Expected one prepared supplied mesh: '+key)
        obj=meshes[0];data=obj.data.copy();data.transform(obj.matrix_world);data.use_fake_user=True
        for mat in data.materials:
            mat['fieldFigureFinish']=True
            mat['ludingFinish']=True
            mat['fieldSuppliedAsset']=key
        for item in imported:bpy.data.objects.remove(item,do_unlink=True)
        cache[key]=(data,record)
    return cache[key]


def place_prop(env,key,position,yaw=0,height=None,span=None,seat_height=None):
    """Place a bottom-centred supplied prop; yaw follows its recorded source axes."""
    if env.sid=='luding':return None
    value=_template(env,key)
    if value is None:return None
    data,record=value;dim=record['dimensions_blender']
    scale=height/dim[2] if height is not None else span/max(dim[:2]) if span is not None else 1
    if seat_height is not None:scale=seat_height/record['seat_height']
    obj=bpy.data.objects.new('Supplied prop '+key,data);bpy.context.collection.objects.link(obj)
    obj.location=position;obj.rotation_euler.z=yaw;obj.scale=(scale,)*3
    obj['fieldSuppliedProp']=key;obj['sourceAsset']=record['source_name']
    obj['fieldSuppliedFinish']=True
    return obj


def place_stick_between(env,bottom,top):
    if env.sid=='luding':return None
    value=_template(env,'walking-stick')
    if value is None:return None
    data,record=value
    direction=Vector(top)-Vector(bottom)
    if direction.length<1e-8:return None
    rotation=Vector(record['principal_axis']).rotation_difference(direction.normalized()).to_matrix().to_4x4()
    scale=direction.length/record['principal_length']
    transform=Matrix.Translation(Vector(bottom))@rotation@Matrix.Scale(scale,4)@Matrix.Translation(-Vector(record['lower_endpoint']))
    obj=bpy.data.objects.new('Supplied prop walking-stick',data);bpy.context.collection.objects.link(obj)
    obj.matrix_world=transform;obj['fieldSuppliedProp']='walking-stick';obj['fieldSuppliedFinish']=True
    return obj


def try_build_person(f,x,y,z,height,yaw,pose,role):
    if not getattr(f.env,'use_supplied_people',True):return False
    from field_personnel import identity_for
    identity=identity_for(f.env.sid,role,pose,x,y)
    appearance=getattr(f,'appearance_index',0) or f.count+1
    key=person_asset(f.env.sid,identity,role,pose,appearance)
    value=_template(f.env,key)
    if value is None:raise ValueError('Missing supplied historical person: '+key)
    data,record=value
    source_identity=identity
    identity='porter' if record['role']=='civilian_porter' else record['role']
    actual_height=height*record.get('pose_height_ratio',1.)
    scale=actual_height/record['dimensions_blender'][2]
    obj=bpy.data.objects.new('People supplied '+key,data);bpy.context.collection.objects.link(obj)
    obj.location=(x,y,z);obj.rotation_euler.z=yaw+record.get('yaw_to_minus_y',-math.pi/2)
    obj.scale=(scale,)*3
    obj['fieldSuppliedActor']=key;obj['historicalRole']=identity
    obj['sourceRole']=role;obj['sourceIdentity']=source_identity
    obj['sourceAsset']=record['source_name']
    obj['sourcePose']=record['pose'];obj['requestedPose']=pose;obj['fieldFigureVersion']=4
    obj['nominalAdultHeight']=height;obj['posedHeight']=actual_height
    obj['embeddedSupport']=record.get('embedded_support') or ''
    obj['placementFloor']=z;obj['authorYaw']=yaw
    f.count+=1;f.people.append((x,y,z,actual_height))
    f.identities.append({'identity':identity,'source_role':role,'source_identity':source_identity,'pose':pose,'position':[x,y,z],
                         'height':actual_height,'supplied_asset':key})
    f.portrait_candidates.append((x,y,z,actual_height,yaw,pose,identity=='red_army'))
    actors=getattr(f.env,'_field_supplied_actors',None)
    if actors is None:actors=[];f.env._field_supplied_actors=actors
    actors.append(obj)
    return True


def person_asset(sid,identity,role,pose,appearance=1):
    """Use the closest authored pose without creating a procedural fallback."""
    if role=='boatman' or pose=='row':return 'boatman-rowing'
    if pose=='climb' or (sid=='jiajin' and identity=='red_army' and pose=='walk'):return 'staff-climber'
    if pose in ('kneel','care'):return 'kneeling-caregiver'
    if pose=='read' or (pose=='write' and sid in ('ruijin','hadapu')):return 'newspaper-reader'
    if pose=='write':return 'journal-writer'
    if pose=='sit':
        if sid in ('xiangjiang','lazikou'):return 'kneeling-caregiver'
        if sid in ('jiajin','songpan'):return 'resting-marcher'
        return 'seated-delegate' if identity=='red_army' else 'seated-civilian-woman'
    if identity=='red_army':
        key='soldier-female' if appearance%5==0 else 'marcher-male'
        return key
    if role=='farmer' or pose in ('greet','point'):return 'farmer-greeting'
    # Keep the established good supplied porter. A few villagers demonstrate
    # everyday seated craft rather than all repeating the same greeting.
    if identity=='civilian' and appearance%4==0:return 'seated-civilian-woman'
    return 'old-porter'


def bind_scene(env):
    """Replace only established prop calls and restore originals for Luding."""
    import historical_sets as props
    for name in ('bedroll','folding_chair'):
        _ORIGINAL_PROPS.setdefault(name,getattr(props,name))
        setattr(props,name,_ORIGINAL_PROPS[name])
    if env.sid=='luding' or not CATALOG.is_file():return
    def bedroll(x,y,z,ang=0):
        result=place_prop(env,'blanket-roll',(x,y,z),ang-math.pi/2,span=.72)
        return result if result is not None else _ORIGINAL_PROPS['bedroll'](x,y,z,ang)
    def chair(x,y,z,rot):
        result=place_prop(env,'folding-chair',(x,y,z),rot-math.pi/2,seat_height=.468)
        return result if result is not None else _ORIGINAL_PROPS['folding_chair'](x,y,z,rot)
    props.bedroll=bedroll;props.folding_chair=chair


def flush_supplied(f):
    counts=json.dumps(dict(Counter(item['identity'] for item in f.identities)))
    actors=getattr(f.env,'_field_supplied_actors',[])
    # The numbered seated people include their chair/stool. Remove only a
    # pre-existing supplied chair at the same exact author's seating position.
    for prop in list(bpy.context.scene.objects):
        if prop.get('fieldSuppliedProp')!='folding-chair':continue
        for actor in actors:
            if actor.get('embeddedSupport') not in ('chair','stool'):continue
            if math.hypot(prop.location.x-actor.location.x,prop.location.y-actor.location.y)<.43 and abs(prop.location.z-actor.location.z)<.20:
                bpy.data.objects.remove(prop,do_unlink=True);break
    for obj in actors:
        obj['historicalFigureIdentities']=counts
