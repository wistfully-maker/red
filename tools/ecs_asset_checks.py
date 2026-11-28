"""Read-only HTTP checks against the new service, including source hashes."""
import gzip
import hashlib
import http.client
import json
from pathlib import Path

root=Path('/opt/shanhe-atlas/current').resolve()
manifest=json.loads((root/'.release-manifest.json').read_text())
paths=['index.html','assets/explore.js','assets/scene-navigation.js','assets/scene-navigation.css',
       'assets/ground-features.js','assets/models/landscapes/liping.glb',
       'assets/audio/schubert-standchen-lv-siqing.mp3']
for path in paths:
    con=http.client.HTTPConnection('127.0.0.1',18081,timeout=10)
    con.request('GET','/'+path,headers={'Range':'bytes=0-255'} if path.endswith(('.glb','.mp3')) else {})
    r=con.getresponse();data=r.read();status=r.status;con.close()
    if path.endswith(('.glb','.mp3')):
        assert status==206 and len(data)==256,(path,status)
        with (root/path).open('rb') as stream:assert data==stream.read(256)
    else:
        assert status==200 and hashlib.sha256(data).hexdigest()==manifest[path]['sha256'],(path,status)
    print(f'HTTP {status} verified: /{path}')
con=http.client.HTTPConnection('127.0.0.1',18081,timeout=10)
con.request('GET','/assets/explore.js',headers={'Accept-Encoding':'gzip'})
r=con.getresponse();data=r.read();assert r.status==200 and r.getheader('Content-Encoding')=='gzip'
assert hashlib.sha256(gzip.decompress(data)).hexdigest()==manifest['assets/explore.js']['sha256']
con.close();print('Gzip JavaScript verified: HTTP 200')
assert Path('/opt/shanhe-atlas/server.py').is_file()
print('NEW_APPLICATION_HTTP_CHECKS_PASSED')
