"""Compact the embedded image buffers in Blender's individually prepared prop GLBs."""
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image

def compact(path,out):
    source=path.read_bytes()
    n=struct.unpack_from('<I',source,12)[0]
    doc=json.loads(source[20:20+n]); source=source[n+28:]
    image_views={item['bufferView'] for item in doc['images']}
    data=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        assert view['buffer']==0 and not view.get('extensions')
        start=view.get('byteOffset',0);chunk=source[start:start+view['byteLength']]
        if i in image_views:
            image=Image.open(io.BytesIO(chunk));limit=1536 if path.stem=='house' else 1024
            image.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            encoded=io.BytesIO();image.save(encoded,'WEBP',quality=90,method=5)
            chunk=encoded.getvalue()
        view['byteOffset']=len(data);view['byteLength']=len(chunk)
        data.extend(chunk);data.extend(bytes(-len(data)%4))
    doc['buffers'][0]['byteLength']=len(data)
    meta=json.dumps(doc,separators=(',',':')).encode();meta+=b' '*(-len(meta)%4)
    out.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(meta)+len(data),len(meta),0x4e4f534a)+meta+
                    struct.pack('<I4s',len(data),b'BIN\0')+data)

if __name__=='__main__':
    src,dest=map(Path,sys.argv[1:]);dest.mkdir(exist_ok=True,parents=True)
    for f in src.glob('*.glb'):compact(f,dest/f.name)
