"""Validate the actual delivered 19 GLBs, source preservation and pose coverage."""
from collections import Counter
import hashlib
import itertools
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/numbered-people'


def transforms(doc):
    result={};parents={child:i for i,n in enumerate(doc['nodes']) for child in n.get('children',[])}
    def world(i):
        if i in result:return result[i]
        n=doc['nodes'][i]
        if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4,order='F')
        else:
            x,y,z,w=n.get('rotation',[0,0,0,1])
            rotation=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                               [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                               [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
            m=np.eye(4);m[:3,:3]=rotation@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
        result[i]=world(parents[i])@m if i in parents else m
        return result[i]
    for i in range(len(doc['nodes'])):world(i)
    return result


def check():
    catalog=json.loads((ROOT/'assets/models/field-supplied/catalog.json').read_text(encoding='utf-8'))
    numbered=set(catalog['numbered_people']);assert len(numbered)==9
    for key in numbered:
        item=catalog['assets'][key]
        source=Path.home()/'Downloads'/item['source_name'];prepared=ROOT/item['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest()==item['source_sha256']
        assert hashlib.sha256(prepared.read_bytes()).hexdigest()==item['sha256']
    rows=[];coverage=Counter()
    for path in sorted((ROOT/'assets/models/landscapes').glob('*.glb')):
        raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
        assert struct.unpack_from('<I',raw,8)[0]==len(raw)
        doc=json.loads(raw[20:20+size]);matrices=transforms(doc)
        nodes=[(i,n) for i,n in enumerate(doc['nodes']) if n.get('extras',{}).get('fieldSuppliedActor')]
        assert nodes,path.stem
        forbidden=[n['name'] for n in doc['nodes'] if n.get('name','').startswith('People ') and not n.get('extras',{}).get('fieldSuppliedActor')]
        assert not forbidden,(path.stem,forbidden)
        assert not any(m.get('name','').startswith('fig_') for m in doc['materials']),path.stem
        assert 'female-soldier-fixed' not in raw[20:20+size].decode('utf-8')
        floor_error=0;poses=Counter();positions=[]
        for i,n in nodes:
            ex=n['extras'];key=ex['fieldSuppliedActor'];assert key in catalog['assets']
            actual=catalog['assets'][key]['role'];actual='porter' if actual=='civilian_porter' else actual
            assert ex['historicalRole']==actual and 'sourceRole' in ex and 'sourceIdentity' in ex
            coverage[key]+=1;poses[key]+=1;assert ex['fieldFigureVersion']==4
            lows=[];highs=[]
            for p in doc['meshes'][n['mesh']]['primitives']:
                assert 'TEXCOORD_0' in p['attributes']
                material=doc['materials'][p['material']]
                assert material['extras']['fieldFigureFinish']
                assert 'baseColorTexture' in material['pbrMetallicRoughness']
                accessor=doc['accessors'][p['attributes']['POSITION']]
                corners=np.array(list(itertools.product(*zip(accessor['min'],accessor['max']))))
                points=np.column_stack((corners,np.ones(len(corners))))@matrices[i].T
                lows.append(points[:,1].min());highs.append(points[:,1].max())
            error=abs(min(lows)-ex['placementFloor']);floor_error=max(floor_error,error)
            assert error<2e-4,(path.stem,n['name'],error)
            assert abs(max(highs)-min(lows)-ex['posedHeight'])<2e-4
            positions.append(matrices[i][:3,3].tolist())
        ground=next(n['extras'] for n in doc['nodes'] if 'framingWidth' in n.get('extras',{}))
        assert len(nodes)==ground['figureCount'],(path.stem,len(nodes),ground['figureCount'])
        if path.stem=='dawei':
            for x,y,z in [(-2.1,.33,2.89),(-.5,-.33,2.89)]:
                assert not any(np.linalg.norm(np.array(p)-[x,z,-y])<1e-4 for p in positions)
        audits=json.loads((OUT/(path.stem+'-audit.json')).read_text(encoding='utf-8'))
        assert audits['sha256']==hashlib.sha256(raw).hexdigest(),path.stem
        for mode in ('overview','tableau'):
            with Image.open(OUT/(path.stem+'-'+mode+'.jpg')) as image:image.verify()
        with Image.open(ROOT/'assets/valley/stills'/(path.stem+'.webp')) as image:image.verify()
        rows.append({'station':path.stem,'people':len(nodes),'assets':dict(poses),'bytes':len(raw),
                     'sha256':hashlib.sha256(raw).hexdigest(),'maximumFloorErrorMetres':floor_error,
                     'proceduralPeople':0,'previewCount':len(list(OUT.glob(path.stem+'-*.jpg')))})
    assert len(rows)==19,len(rows)
    assert numbered<=set(coverage),(numbered-set(coverage))
    cameras=json.loads((OUT/'resident-cameras.json').read_text(encoding='utf-8'))
    assert len(cameras)==18 and all(r['binaryChunkUnchanged'] for r in cameras)
    report={'passed':True,'stations':19,'historicalPeople':sum(r['people'] for r in rows),
            'numberedAssetsUsed':sorted(numbered),'assetCoverage':dict(coverage),
            'sourceModelsUnchanged':True,'proceduralPeople':0,'daweiRemovedGreetersStillAbsent':True,
            'posedHeightResidentCameras':18,'cameraRefreshPreservedBinaryChunks':True,'scenes':rows}
    (OUT/'delivery-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('NUMBERED_PEOPLE_DELIVERY_CHECK',json.dumps({k:v for k,v in report.items() if k!='scenes'},ensure_ascii=False))


if __name__=='__main__':check()
