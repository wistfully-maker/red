"""Finalize native-material metadata, dimensions and the matched recorder asset."""
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
from field_glb_data import GLB

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/models/field-supplied';REVIEW=ROOT/'output/field-supplied'


def main():
    records={}
    entries=[
        ('marcher-male','chinese-soldier','red_army','standing march pause','中国军装士兵3d模型.glb'),
        ('soldier-female','soldier','red_army','standing','军装士兵3d模型.glb'),
        ('recorder','returned-person','contemporary_guide','holding red-tab journal','人物3d模型.glb'),
        ('blanket-roll','blanket-roll','prop','double roll and tied bundle','卷毯3d模型.glb'),
        ('walking-stick','walking-stick','prop','diagonal natural wooden staff','木制拐杖3d模型.glb'),
        ('folding-chair','folding-chair','prop','open X-frame with woven seat','木质折叠椅3d模型.glb')]
    for key,stem,role,pose,source in entries:
        path=OUT/(stem+'.glb')
        if not path.is_file():continue
        asset=GLB(path)
        for mat in asset.doc['materials']:
            mat.setdefault('extras',{}).update({'fieldFigureFinish':True,'fieldSuppliedAsset':key})
        for node in asset.doc['nodes']:
            if 'mesh' in node:node.setdefault('extras',{}).update({'fieldSuppliedAsset':key,'suppliedRole':role})
        asset.write(path)
        points=np.concatenate([p['position'] for p in asset.primitives()]);lo=points.min(axis=0);hi=points.max(axis=0)
        triangles=sum(len(p['indices']) for p in asset.primitives())
        record={'file':str(path.relative_to(ROOT)).replace('\\','/'),'role':role,'pose':pose,
            'source_name':source,'dimensions_blender':(hi-lo).tolist(),'bounds_blender':[lo.tolist(),hi.tolist()],
            'triangles':triangles,'materials':len(asset.doc['materials']),'textures':len(asset.doc['images']),
            'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'pivot':'bottom centre; longest horizontal extent is one metre','front_blender':[1,0,0],
            'yaw_to_minus_y':-math.pi/2}
        if key=='folding-chair':
            p=list(asset.primitives())[0];t=p['position'][p['indices']]
            normal=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(normal,axis=1)/2
            normal/=np.maximum(1e-9,np.linalg.norm(normal,axis=1,keepdims=True));centres=t.mean(axis=1)
            mask=(normal[:,2]>.75)&(centres[:,2]>.3)&(centres[:,2]<1.2)
            hist,edges=np.histogram(centres[mask,2],bins=50,weights=area[mask]);peak=hist.argmax()
            z=centres[mask,2];weight=area[mask];chosen=(z>=edges[peak])&(z<edges[peak+1])
            record['seat_height']=float(np.average(z[chosen],weights=weight[chosen]))
        if key=='walking-stick':
            centre=points.mean(axis=0);_,_,axes=np.linalg.svd(points-centre,full_matrices=False);axis=axes[0]
            if axis[2]<0:axis=-axis
            projection=points@axis;length=float(projection.max()-projection.min())
            lower=points[projection<projection.min()+length*.025].mean(axis=0)
            record.update({'principal_axis':axis.tolist(),'principal_length':length,'lower_endpoint':lower.tolist()})
        records[key]=record
    old_path=ROOT/'assets/luding/props/kf-porter.glb'
    old=GLB(old_path);points=np.concatenate([p['position'] for p in old.primitives()]);lo=points.min(axis=0);hi=points.max(axis=0)
    records['old-porter']={'file':'assets/luding/props/kf-porter.glb','role':'civilian_porter','pose':'standing',
        'source_name':'previous user-supplied porter','dimensions_blender':(hi-lo).tolist(),
        'front_blender':[1,0,0],'yaw_to_minus_y':-math.pi/2,'triangles':sum(len(p['indices']) for p in old.primitives()),
        'bytes':old_path.stat().st_size,'sha256':hashlib.sha256(old_path.read_bytes()).hexdigest()}
    recorder=GLB(OUT/'returned-person.glb')
    target=ROOT/'assets/models/journal-recorder.glb'
    backup=ROOT/'.workbuddy/field-supplied/journal-recorder-before-supplied.glb'
    if not backup.exists():backup.write_bytes(target.read_bytes())
    scale=1.64/records['recorder']['dimensions_blender'][2]
    matrix=np.array([[0,0,-scale,0],[0,scale,0,0],[scale,0,0,0],[0,0,0,1]],dtype=float)
    for node in recorder.doc['nodes']:
        if 'mesh' in node:
            node['matrix']=matrix.ravel(order='F').tolist()
            node.setdefault('extras',{}).update({'role':'contemporary_interpretive_recorder','heightMetres':1.64,
                'forwardGLTF':'+Z','journalSource':'user-returned long-braid recorder with red-tab notebook'})
    recorder.write(target)
    # Keep prepared numbered people when refreshing the original prop catalogue.
    current=OUT/'catalog.json'
    previous=json.loads(current.read_text(encoding='utf-8')) if current.is_file() else {}
    numbered=previous.get('numbered_people',[])
    records.update({key:previous['assets'][key] for key in numbered})
    result={'version':2 if numbered else 1,'numbered_people':numbered,'units':'metres','blender_up':'+Z','assets':records,
        'excluded_assets':['军装女兵3d模型.glb: cancelled by user; never instantiate or regenerate.'],
        'journal_recorder':{'file':'assets/models/journal-recorder.glb','height':1.64,'forward_gltf':'+Z',
            'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'backup':str(backup.relative_to(ROOT))}}
    (OUT/'catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (REVIEW/'catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'assets':len(records),'catalog':str(OUT/'catalog.json'),'recorder_bytes':target.stat().st_size},ensure_ascii=False))


if __name__=='__main__':main()
