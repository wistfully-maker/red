"""Drape generalized Natural Earth river lines on the actual corridor DEM.
Pass ne_10m_rivers_lake_centerlines.zip from Natural Earth's physical vectors.
The triangles have exaggerated cartographic widths, not historic channel widths.
"""
import json,math,struct,sys,zipfile
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_terrain_models import ROOT,RADIUS,sample,write_model
manifest=json.loads((ROOT/'assets/terrain/manifest.json').read_text())
ab=manifest['regions']['corridor']['bounds']
lat,lon=np.radians(manifest['origin']);ox=RADIUS*lon;oz=-RADIUS*np.arcsinh(np.tan(lat))
rgb=np.asarray(Image.open(ROOT/'assets/terrain/corridor.png')).astype('int32')
dem=np.maximum(0,rgb[:,:,0]*256+rgb[:,:,1]-512)
rows=[];indices=[]
def segment(points):
    if len(points)<2:return
    line=np.array(points)
    direction=np.roll(line,-1,axis=0)-np.roll(line,1,axis=0)
    direction[0]=line[1]-line[0];direction[-1]=line[-1]-line[-2]
    norms=np.maximum(1.e-4,np.linalg.norm(direction,axis=1))
    cross=np.stack([-direction[:,1]/norms,direction[:,0]/norms],axis=-1)
    width=.62 if len(points)>70 else .38
    coords=np.stack([line+cross*width,line-cross*width],axis=1).reshape(-1,2)
    x,z=coords.T
    y=sample(dem,(x-ab[0])/(ab[2]-ab[0]),(z-ab[1])/(ab[3]-ab[1]),True)*.001*np.cosh(z/RADIUS)
    base=len(rows);rows.extend(np.stack([x-ox,y+.019,z-oz],axis=-1))
    for j in range(len(line)-1):
        i=base+j*2;indices.extend((i,i+2,i+1,i+1,i+2,i+3))
with zipfile.ZipFile(sys.argv[1]) as zipfile_:
    data=zipfile_.read(next(f for f in zipfile_.namelist() if f.endswith('.shp')))
ptr=100
while ptr<len(data):
    _,words=struct.unpack_from('>ii',data,ptr);ptr+=8;record=data[ptr:ptr+words*2];ptr+=words*2
    if struct.unpack_from('<i',record)[0]!=3:continue
    left,south,right,north=struct.unpack_from('<4d',record,4)
    if left>120 or right<96 or south>42 or north<20:continue
    parts,points=struct.unpack_from('<2i',record,36)
    offsets=list(struct.unpack_from('<'+'i'*parts,record,44))+[points]
    xy=np.frombuffer(record,dtype='<f8',count=2*points,offset=44+4*parts).reshape(-1,2)
    for a,b in zip(offsets,offsets[1:]):
        line=[]
        for ln,lt in xy[a:b]:
            x=RADIUS*math.radians(ln);z=-RADIUS*math.asinh(math.tan(math.radians(lt)))
            if ab[0]<x<ab[2] and ab[1]<z<ab[3]:
                if not line or math.dist(line[-1],(x,z))>.53:line.append((x,z))
            else:segment(line);line=[]
        segment(line)
assert rows
index_type='<u2' if len(rows)<65536 else '<u4'
write_model('atlas-watercourses',[('POSITION',np.asarray(rows,dtype='<f4'),5126,'VEC3',False),
    ('indices',np.asarray(indices,dtype=index_type),5123 if index_type=='<u2' else 5125,'SCALAR',False)],0,0)

