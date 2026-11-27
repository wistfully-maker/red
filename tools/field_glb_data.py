"""Small GLB data reader and texture QA renderer; no Blender process required."""
import copy
import io
import json
import math
from pathlib import Path
import struct

import numpy as np
from PIL import Image

DTYPES={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}
CHANNELS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}


class GLB:
    def __init__(self,path):
        self.path=Path(path);data=self.path.read_bytes()
        assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
        length=struct.unpack_from('<I',data,12)[0]
        self.doc=json.loads(data[20:20+length]);self.binary=data[28+length:]
        self._images={}

    def array(self,index):
        a=self.doc['accessors'][index];view=self.doc['bufferViews'][a['bufferView']]
        dtype=DTYPES[a['componentType']];channels=CHANNELS[a['type']]
        start=view.get('byteOffset',0)+a.get('byteOffset',0)
        stride=view.get('byteStride',np.dtype(dtype).itemsize*channels)
        return np.ndarray((a['count'],channels),dtype=dtype,buffer=self.binary,
                          offset=start,strides=(stride,np.dtype(dtype).itemsize)).copy()

    def image(self,index):
        if index not in self._images:
            view=self.doc['bufferViews'][self.doc['images'][index]['bufferView']]
            start=view.get('byteOffset',0)
            self._images[index]=Image.open(io.BytesIO(self.binary[start:start+view['byteLength']])).convert('RGB')
        return self._images[index].copy()

    def color_image_index(self,material):
        tex=self.doc['materials'][material]['pbrMetallicRoughness']['baseColorTexture']['index']
        texture=self.doc['textures'][tex]
        return texture.get('source',texture.get('extensions',{}).get('EXT_texture_webp',{}).get('source'))

    def primitives(self):
        # Prepared assets have one mesh, an identity node and baked transforms.
        # The supplied Tripo source nodes also use identity transforms.
        for mesh in self.doc['meshes']:
            for primitive in mesh['primitives']:
                position=self.array(primitive['attributes']['POSITION'])
                normal=self.array(primitive['attributes']['NORMAL']) if 'NORMAL' in primitive['attributes'] else None
                yield {'position':position[:,[0,2,1]]*np.array([1,-1,1]),
                    'normal':normal[:,[0,2,1]]*np.array([1,-1,1]) if normal is not None else None,
                    'uv':self.array(primitive['attributes']['TEXCOORD_0']),
                    'indices':self.array(primitive['indices']).reshape(-1,3),
                    'material':primitive['material'],'mesh_name':mesh.get('name')}

    def write(self,path,image_edits=None,webp_quality=94):
        doc=copy.deepcopy(self.doc);data=bytearray();image_edits=image_edits or {}
        image_views={image['bufferView']:i for i,image in enumerate(doc.get('images',[]))}
        for i,view in enumerate(doc['bufferViews']):
            start=view.get('byteOffset',0);chunk=self.binary[start:start+view['byteLength']]
            if i in image_views:
                index=image_views[i]
                if index in image_edits or doc['images'][index].get('mimeType')!='image/webp':
                    image=image_edits[index] if index in image_edits else self.image(index)
                    stream=io.BytesIO();image.save(stream,'WEBP',quality=webp_quality,method=5)
                    chunk=stream.getvalue();doc['images'][index]['mimeType']='image/webp'
            view['byteOffset']=len(data);view['byteLength']=len(chunk)
            data.extend(chunk);data.extend(bytes(-len(data)%4))
        for texture in doc.get('textures',[]):
            source=texture.pop('source',None)
            if source is not None:texture.setdefault('extensions',{})['EXT_texture_webp']={'source':source}
        for key in ('extensionsUsed','extensionsRequired'):
            doc.setdefault(key,[])
            if 'EXT_texture_webp' not in doc[key]:doc[key].append('EXT_texture_webp')
        doc['buffers'][0]['byteLength']=len(data)
        meta=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8');meta+=b' '*(-len(meta)%4)
        output=struct.pack('<4sIIII',b'glTF',2,28+len(meta)+len(data),len(meta),0x4e4f534a)+meta
        output+=struct.pack('<II',len(data),0x004e4942)+data
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(output)


def sample(image,uv):
    array=np.asarray(image,dtype=np.float32)
    h,w=array.shape[:2]
    x=np.clip(uv[...,0]*(w-1),0,w-1);y=np.clip(uv[...,1]*(h-1),0,h-1)
    ix=x.astype(int);iy=y.astype(int);fx=(x-ix)[...,None];fy=(y-iy)[...,None]
    right=np.minimum(ix+1,w-1);bottom=np.minimum(iy+1,h-1)
    return ((array[iy,ix]*(1-fx)+array[iy,right]*fx)*(1-fy)+
            (array[bottom,ix]*(1-fx)+array[bottom,right]*fx)*fy)


def render_front(asset,path,head_material=None,size=800,back=False,yaw=0):
    """Orthographic CPU UV/albedo check. Not a substitute for the final web PBR QA."""
    primitives=list(asset.primitives());points=np.concatenate([p['position'] for p in primitives])
    if head_material is not None:
        points=np.concatenate([p['position'] for p in primitives if p['material']==head_material])
    lo=points.min(axis=0);hi=points.max(axis=0);centre=(lo+hi)/2
    extent=max(hi[1]-lo[1],hi[2]-lo[2])*(1.35 if head_material is not None else 1.12)
    depth=np.full((size,size),-np.inf);output=np.full((size,size,3),226,dtype=np.float32)
    direction=-1 if back else 1
    forward=np.array([math.cos(yaw)*direction,math.sin(yaw)*direction,0])
    right=np.array([-math.sin(yaw)*direction,math.cos(yaw)*direction,0])
    for primitive in primitives:
        points=primitive['position'];uv=primitive['uv'];normal=primitive['normal']
        screen=np.stack((((points-centre)@right)/extent*size+size/2,
                         size/2-(points[:,2]-centre[2])/extent*size),axis=1)
        image=np.asarray(asset.image(asset.color_image_index(primitive['material'])),dtype=np.float32)
        factor=asset.doc['materials'][primitive['material']]['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])[:3]
        for indices in primitive['indices']:
            triangle=screen[indices]
            low=np.maximum(np.floor(triangle.min(axis=0)).astype(int),0)
            high=np.minimum(np.ceil(triangle.max(axis=0)).astype(int),size-1)
            if np.any(high<low):continue
            x,y=np.meshgrid(np.arange(low[0],high[0]+1)+.5,np.arange(low[1],high[1]+1)+.5)
            a,b,c=triangle;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-9:continue
            u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
            v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;w=1-u-v
            weights=np.stack((u,v,w),axis=-1)
            z=(weights*(points[indices]@forward)).sum(axis=-1)
            region=depth[low[1]:high[1]+1,low[0]:high[0]+1]
            mask=(u>=-.001)&(v>=-.001)&(w>=-.001)&(z>region)
            if not mask.any():continue
            texture_uv=weights@uv[indices];rgb=sample(image,texture_uv)*factor
            if normal is not None:
                n=weights@normal[indices];n/=np.maximum(1e-9,np.linalg.norm(n,axis=-1,keepdims=True))
                lighting=.73+.27*np.maximum(0,n@(forward*.82+np.array([0,-.25,.51])))
                rgb*=lighting[...,None]
            block=output[low[1]:high[1]+1,low[0]:high[0]+1];block[mask]=rgb[mask];region[mask]=z[mask]
    Image.fromarray(np.clip(output,0,255).astype(np.uint8)).save(path)
