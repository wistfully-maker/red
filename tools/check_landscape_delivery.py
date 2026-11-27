"""Validate scene coverage, native materials and preserved Luding bytes."""
from pathlib import Path
import datetime
import hashlib
import json
import math
import struct
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/landscape-assets'


def document(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):raise ValueError('Invalid GLB: '+str(path))
    size=struct.unpack_from('<I',raw,12)[0]
    return raw,json.loads(raw[20:20+size])


def check():
    assets=json.loads((OUT/'assets-manifest.json').read_text(encoding='utf8'))
    for item in assets:
        digest=hashlib.sha256(Path(item['source']).read_bytes()).hexdigest()
        if digest!=item['sourceSHA256']:raise ValueError('Source asset changed: '+item['key'])
    original=json.loads((OUT/'preserved-luding.json').read_text(encoding='utf8'))
    current=ROOT/'assets/models/landscapes/luding.glb'
    preserved=hashlib.sha256(current.read_bytes()).hexdigest()==original['ludingSHA256']
    if not preserved:raise ValueError('Luding differs from the pre-geography snapshot')
    rows=[];coverage=set()
    for path in sorted((ROOT/'assets/models/landscapes').glob('*.glb')):
        if path.stem=='luding':continue
        raw,g=document(path)
        ground=next(n.get('extras',{}) for n in g['nodes'] if n.get('extras',{}).get('nativeLandscapeVersion'))
        placements=json.loads(ground['landscapePlacementsJSON'])
        if not placements:raise ValueError('Missing geography in '+path.stem)
        nodes=[n for n in g['nodes'] if n.get('extras',{}).get('landscapeAsset') and 'mesh' in n]
        surfaces=0;volumes=0;native_materials=set()
        for node in nodes:
            is_surface=node.get('extras',{}).get('landscapeSurface',False)
            surfaces+=int(is_surface);volumes+=int(not is_surface)
            for primitive in g['meshes'][node['mesh']]['primitives']:
                material=g['materials'][primitive['material']];native_materials.add(material['name'])
                if not material.get('extras',{}).get('nativeLandscapeFinish'):raise ValueError('Unmarked native geography material')
                if 'baseColorTexture' not in material.get('pbrMetallicRoughness',{}):raise ValueError('Missing supplied base colour texture')
                if 'TEXCOORD_0' not in primitive['attributes']:raise ValueError('Missing geography UVs')
                if is_surface and ('COLOR_0' not in primitive['attributes'] or material.get('alphaMode')!='BLEND'):
                    raise ValueError('A surface lost its edge blend in '+path.stem)
                accessor=g['accessors'][primitive['attributes']['POSITION']]
                for number in accessor.get('min',[])+accessor.get('max',[]):
                    if not math.isfinite(number):raise ValueError('Non-finite geography bounds')
        for placement in placements:
            if placement['kind']=='buried outcrop' and placement['positionBlender'][2]>=placement['lowestSurroundingTerrain']:
                raise ValueError('Unburied model base in '+path.stem)
            if placement['kind']=='dead wood' and placement['height']>3.5:raise ValueError('Overscaled dead wood')
            if placement['kind']=='conformed surface' and placement.get('maxSurfaceReliefMetres',0)>.13:
                raise ValueError('A terrain surface became a raised display block')
        keys=list(ground['landscapeAssets']);coverage.update(keys)
        figures=[n for n in g['nodes'] if n.get('extras',{}).get('suppliedFieldAsset') or n.get('extras',{}).get('fieldSuppliedAsset')]
        rows.append({'station':path.stem,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),
                     'assets':keys,'surfaceObjects':surfaces,'volumeObjects':volumes,'nativeMaterials':len(native_materials),
                     'placements':placements,'suppliedFieldObjects':len(figures),
                     'tableauView':ground.get('tableauView'),'recorderAnchor':ground.get('recorderAnchor')})
    if len(rows)!=18:raise ValueError('Expected 18 non-Luding scenes')
    missing={r['key'] for r in assets}-coverage
    if missing:raise ValueError('Supplied assets missing from every scene: '+str(missing))
    report={'phase':sys.argv[1] if len(sys.argv)>1 else 'checked','checkedAtLocal':datetime.datetime.now().isoformat(),
            'nativeMaterialExtra':'nativeLandscapeFinish=true','nativeSurfaceExtra':'landscapeSurface=true',
            'nativeSurfaceContract':'Embedded PBR, UVs, RGBA vertex colours and BLEND alpha must be retained by the viewer.',
            'sourceFilesUnchanged':True,'ludingUnchanged':preserved,'ludingSHA256':original['ludingSHA256'],
            'sourceCount':len(assets),'sourceBytes':sum(a['sourceBytes'] for a in assets),
            'optimisedAssetBytes':sum(a['outputBytes'] for a in assets),'sceneCount':len(rows),'sceneBytes':sum(r['bytes'] for r in rows),
            'allAssetKeysUsed':sorted(coverage),'scenes':rows}
    (OUT/'geography-delivery-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({key:report[key] for key in ('phase','checkedAtLocal','sourceFilesUnchanged','ludingUnchanged','sourceCount','sourceBytes','optimisedAssetBytes','sceneCount','sceneBytes','allAssetKeysUsed')},ensure_ascii=False,indent=2))


if __name__=='__main__':check()
