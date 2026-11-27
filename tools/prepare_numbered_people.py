"""Prepare the user's 01–09 static Tripo people, retaining native PBR and UVs.

Run with Blender --background --python tools/prepare_numbered_people.py.
Sources in Downloads are read only. Existing supplied people/props stay optional.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
if '--catalog' in sys.argv:
    from field_glb_data import GLB
else:
    from prepare_tripo_prop import prepare_prop

# pose_height_ratio is relative to the author's nominal standing adult height.
# The seated actors already include their seat; 08 includes its blanket roll.
ENTRIES=[
 ('01','boatman-rowing','boatman','row',1.,None),
 ('02','farmer-greeting','civilian','greet',1.,None),
 ('03','newspaper-reader','red_army','read',1.,None),
 ('04','seated-delegate','red_army','sit',.755,'chair'),
 ('05','journal-writer','red_army','write',1.,None),
 ('06','seated-civilian-woman','civilian','sit',.745,'stool'),
 ('07','kneeling-caregiver','civilian','kneel',.675,None),
 ('08','resting-marcher','red_army','sit',.66,'blanket-roll'),
 ('09','staff-climber','red_army','climb',1.,'foot-rock'),
]


def main():
    out=ROOT/'assets/models/field-supplied';review=ROOT/'output/numbered-people'
    review.mkdir(parents=True,exist_ok=True)
    path=out/'catalog.json';catalog=json.loads(path.read_text(encoding='utf-8'))
    for number,key,role,pose,ratio,support in ENTRIES:
        matches=sorted(Path.home().joinpath('Downloads').glob(number+'*.glb'))
        if len(matches)!=1:raise ValueError('Expected exactly one numbered source: '+number)
        source=matches[0];target=out/(key+'.glb')
        if '--catalog' not in sys.argv:
            report=prepare_prop(source,target,name=key,triangles=24000,texture_limit=2048,
                                image_quality=90,preview=False,force=True)
            (review/(number+'-prepared.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            continue
        asset=GLB(target)
        for mat in asset.doc['materials']:
            mat.setdefault('extras',{}).update({'fieldFigureFinish':True,'ludingFinish':True,
                                                'fieldSuppliedAsset':key})
        for node in asset.doc['nodes']:
            if 'mesh' in node:node.setdefault('extras',{}).update({'fieldSuppliedAsset':key})
        asset.write(target)
        points=np.concatenate([p['position'] for p in asset.primitives()]);lo=points.min(0);hi=points.max(0)
        record={'file':str(target.relative_to(ROOT)).replace('\\','/'),'role':role,'pose':pose,
            'source_number':number,'source_name':source.name,
            'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'dimensions_blender':(hi-lo).tolist(),'bounds_blender':[lo.tolist(),hi.tolist()],
            'triangles':sum(len(p['indices']) for p in asset.primitives()),
            'materials':len(asset.doc['materials']),'textures':len(asset.doc['images']),
            'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'pivot':'bottom centre; longest horizontal extent is one metre',
            'front_blender':[1,0,0],'yaw_to_minus_y':-math.pi/2,
            'pose_height_ratio':ratio,'embedded_support':support,
            'orientation_review':'Front +X and back -X checked against the actual source geometry/UVs.'}
        catalog['assets'][key]=record
        print('NUMBERED_PERSON_PREPARED',number,key,record['triangles'],record['bytes'],flush=True)
    if '--catalog' not in sys.argv:return
    catalog['version']=2
    catalog['numbered_people']=[entry[1] for entry in ENTRIES]
    path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'output/field-supplied/catalog.json').write_text(path.read_text(encoding='utf-8'),encoding='utf-8')
    (review/'catalog.json').write_text(path.read_text(encoding='utf-8'),encoding='utf-8')
    print('NUMBERED_PEOPLE_READY',len(ENTRIES),flush=True)


if __name__=='__main__':main()
