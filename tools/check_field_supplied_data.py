"""Check the actual delivered GLBs and catalogue without starting Blender."""
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from field_glb_data import GLB

ROOT=Path(__file__).resolve().parents[1]


def check():
    folder=ROOT/'assets/models/field-supplied'
    catalog=json.loads((folder/'catalog.json').read_text(encoding='utf-8'))
    expected={'marcher-male','soldier-female','recorder','old-porter',
              'blanket-roll','walking-stick','folding-chair'}
    expected.update({'boatman-rowing','farmer-greeting','newspaper-reader','seated-delegate',
                     'journal-writer','seated-civilian-woman','kneeling-caregiver',
                     'resting-marcher','staff-climber'})
    assert set(catalog['assets'])==expected
    assert not (folder/'female-soldier-fixed.glb').exists()
    checks=[]
    for key,record in catalog['assets'].items():
        path=ROOT/record['file'];raw=path.read_bytes();asset=GLB(path)
        assert struct.unpack_from('<I',raw,8)[0]==len(raw)
        assert hashlib.sha256(raw).hexdigest()==record['sha256']
        assert len(asset.doc['meshes'])==1
        positions=[];triangles=0
        for primitive in asset.primitives():
            position=primitive['position'];uv=primitive['uv'];indices=primitive['indices']
            assert np.isfinite(position).all() and np.isfinite(uv).all()
            assert indices.max()<len(position) and indices.min()>=0
            assert len(position)==len(uv)
            triangles+=len(indices);positions.append(position)
        position=np.concatenate(positions);lo=position.min(axis=0);hi=position.max(axis=0)
        assert abs(lo[2])<1e-5
        assert np.allclose(hi-lo,record['dimensions_blender'],atol=1e-5)
        assert triangles==record['triangles']
        for material in asset.doc['materials']:
            if key!='old-porter':assert material['extras']['fieldFigureFinish']
        for image in asset.doc['images']:
            assert 'bufferView' in image and 'uri' not in image
        for index in range(len(asset.doc['images'])):
            image=asset.image(index);assert min(image.size)>0
        checks.append({'key':key,'file':record['file'],'triangles':triangles,
            'dimensions_blender':record['dimensions_blender'],'textures':len(asset.doc['images']),
            'bytes':len(raw),'sha256':record['sha256'],'passed':True})
    guide_path=ROOT/'assets/models/journal-recorder.glb';guide=GLB(guide_path)
    assert hashlib.sha256(guide_path.read_bytes()).hexdigest()==catalog['journal_recorder']['sha256']
    node=next(node for node in guide.doc['nodes'] if 'mesh' in node)
    matrix=np.array(node['matrix']).reshape(4,4,order='F')
    positions=np.concatenate([guide.array(primitive['attributes']['POSITION'])
        for mesh in guide.doc['meshes'] for primitive in mesh['primitives']])
    world=np.column_stack((positions,np.ones(len(positions))))@matrix.T
    assert abs(world[:,1].min())<1e-6
    assert abs(float(np.ptp(world[:,1]))-1.64)<1e-5
    forward=matrix[:3,:3]@np.array([1,0,0]);forward/=np.linalg.norm(forward)
    assert np.allclose(forward,[0,0,1],atol=1e-6)
    assert node['extras']['role']=='contemporary_interpretive_recorder'
    assert (ROOT/catalog['journal_recorder']['backup']).is_file()
    assert np.isclose(np.linalg.norm(catalog['assets']['walking-stick']['principal_axis']),1)
    assert .6<catalog['assets']['folding-chair']['seat_height']<1
    found=[]
    for path in (ROOT/'assets/models/landscapes').glob('*.glb'):
        raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
        text=raw[20:20+length].decode('utf-8')
        if 'caregiver-female' in text or 'female-soldier-fixed' in text:found.append(path.name)
    assert not found, found
    report={'passed':True,'assets':checks,'journal_height_metres':1.64,'journal_forward_gltf':'+Z',
        'cancelled_asset_in_production':False,'cancelled_asset_in_compiled_scenes':found,
        'verification_scope':'Delivered GLB structure, actual geometry/UV arrays, embedded image decode, physical guide transform and production exclusion. Final scene generation/PBR review belongs to the main build.'}
    output=ROOT/'output/field-supplied/delivery-check.json'
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('FIELD_SUPPLIED_DATA_CHECK '+json.dumps({'passed':True,'assets':len(checks),
          'guide_height':1.64,'cancelled_asset_excluded':True},ensure_ascii=False))


if __name__=='__main__':check()
