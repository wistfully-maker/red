"""Refresh resident cameras after the switch to actual posed actor heights.

Blender calculates unobstructed cameras from delivered meshes, then normal
Python --apply updates only the JSON chunk; the geometry/texture bytes stay exact.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
import time
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/numbered-people/resident-cameras.json'


def actual_role(key,catalog):
    role=catalog['assets'][key]['role']
    return 'porter' if role=='civilian_porter' else role


def original_role(sid,ex):
    """Older compiled actors did not save sourceRole; recover the builder rule."""
    if 'sourceRole' in ex:return ex['sourceRole']
    identity=ex.get('sourceIdentity',ex['historicalRole']);pose=ex['requestedPose']
    if sid=='ruijin' and ex['fieldSuppliedActor']=='farmer-greeting':return 'farmer'
    if sid=='zunyi' and pose=='sit':return 'delegate'
    if (sid=='lianghekou' and pose=='sit') or (sid=='baxi' and pose in ('sit','greet')):return 'local'
    if identity=='civilian':return 'local'
    if identity=='red_army':return 'walker'
    return identity


def calculate(ids):
    import bpy
    sys.path.insert(0,str(ROOT/'tools'))
    from build_valley_scenes import Landscape,frame_resident
    catalog=json.loads((ROOT/'assets/models/field-supplied/catalog.json').read_text(encoding='utf-8'))
    rows=[]
    for sid in ids:
        path=ROOT/'assets/models/landscapes'/(sid+'.glb')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        env=Landscape(sid)
        bpy.ops.import_scene.gltf(filepath=str(path))
        for o in bpy.context.scene.objects:
            if o.get('fieldSuppliedActor'):
                x,y,z=o.location
                env.figures.portrait_candidates.append((x,y,z,o['posedHeight'],o['authorYaw'],
                    o['requestedPose'],actual_role(o['fieldSuppliedActor'],catalog)=='red_army'))
        bpy.context.view_layer.update()
        view=frame_resident(env)
        rows.append({'station':sid,'sha256Before':hashlib.sha256(path.read_bytes()).hexdigest(),
                     'residentView':view,'actualPosedHeightUsed':True})
        print('ACTUAL_POSE_RESIDENT_CAMERA',sid,view,flush=True)
    OUT.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def apply():
    rows=json.loads(OUT.read_text(encoding='utf-8'))
    catalog=json.loads((ROOT/'assets/models/field-supplied/catalog.json').read_text(encoding='utf-8'))
    # Luding keeps its independent authored walk cameras, but its actor identity
    # audit follows the same supplied asset role contract.
    luding=ROOT/'assets/models/landscapes/luding.glb'
    rows.append({'station':'luding','sha256Before':hashlib.sha256(luding.read_bytes()).hexdigest(),
                 'residentView':None,'actualPosedHeightUsed':False})
    for row in rows:
        path=ROOT/'assets/models/landscapes'/(row['station']+'.glb');raw=path.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==row['sha256Before']
        size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size])
        tail=raw[20+size:]
        ground=next(n['extras'] for n in doc['nodes'] if 'framingWidth' in n.get('extras',{}))
        if row['station']!='luding':
            if row['residentView'] is not None:ground['residentView']=row['residentView']
            else:ground.pop('residentView',None)
        actors=[n['extras'] for n in doc['nodes'] if n.get('extras',{}).get('fieldSuppliedActor')]
        counts=Counter(actual_role(ex['fieldSuppliedActor'],catalog) for ex in actors)
        for ex in actors:
            ex['sourceRole']=original_role(row['station'],ex)
            ex.setdefault('sourceIdentity',ex['historicalRole'])
            ex['historicalRole']=actual_role(ex['fieldSuppliedActor'],catalog)
            ex['historicalFigureIdentities']=json.dumps(dict(counts))
        meta=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8');meta+=b' '*(-len(meta)%4)
        result=struct.pack('<4sIIII',b'glTF',2,20+len(meta)+len(tail),len(meta),0x4e4f534a)+meta+tail
        temporary=path.with_suffix('.metadata.tmp');temporary.write_bytes(result)
        for attempt in range(40):
            try:
                temporary.replace(path)
                break
            except PermissionError:
                if attempt==39:raise
                time.sleep(.25)
        row['sha256After']=hashlib.sha256(result).hexdigest()
        row['binaryChunkUnchanged']=result[20+len(meta):]==tail
        audit_path=ROOT/'output/numbered-people'/(row['station']+'-audit.json')
        audit=json.loads(audit_path.read_text(encoding='utf-8'));audit['sha256']=row['sha256After'];audit['bytes']=len(result)
        audit['residentView']=row['residentView'];audit['residentCameraUsesActualPosedHeight']=row['station']!='luding'
        audit['historicalRoles']=dict(counts)
        by_position={}
        for n in doc['nodes']:
            ex=n.get('extras',{})
            if not ex.get('fieldSuppliedActor'):continue
            p=n.get('translation',[0,0,0])
            by_position[(ex['fieldSuppliedActor'],round(p[0],4),round(-p[2],4),round(p[1],4))]=ex
        for item in audit['actors']:
            ex=by_position[(item['asset'],*(round(p,4) for p in item['position']))]
            item.update({key:ex[key] for key in ('sourceRole','sourceIdentity','historicalRole')})
        audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    OUT.write_text(json.dumps([r for r in rows if r['station']!='luding'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('ACTUAL_POSE_RESIDENT_CAMERAS_APPLIED',len(rows)-1,'cameras; 19 actor roles; binary chunks preserved')


if __name__=='__main__':
    if '--apply' in sys.argv:apply()
    else:
        ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [p.stem for p in (ROOT/'assets/models/landscapes').glob('*.glb') if p.stem!='luding']
        calculate(ids)
