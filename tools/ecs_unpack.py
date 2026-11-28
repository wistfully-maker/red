"""Verify and unpack one immutable release, using bounded memory."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tarfile


def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()


record=json.loads(sys.argv[1])
root=Path('/opt/shanhe-atlas')
archive=root/'uploads/shanhe-atlas.tar.gz'
assert digest(archive)==record['archiveSha256'],'Archive checksum mismatch'
print('Archive SHA256 verified: '+record['archiveSha256'],flush=True)
release=root/'releases'/record['release']
assert release.parent==root/'releases'
release.mkdir(exist_ok=False)
with tarfile.open(archive,'r:gz') as tar:
    for item in tar:
        target=(release/item.name).resolve()
        assert target.is_relative_to(release) and (item.isfile() or item.isdir()),item.name
        assert item.name=='server.py' or item.name.startswith('public/'),item.name
        item.uid=item.gid=0;item.uname=item.gname='';item.mode=0o755 if item.isdir() else 0o644
        tar.extract(item,path=release)
manifest=json.loads((release/'public/.release-manifest.json').read_text())
assert len(manifest)==record['servedFiles']
for name,entry in manifest.items():
    file=release/'public'/name
    assert file.resolve().is_relative_to(release/'public')
    assert file.stat().st_size==entry['bytes'] and digest(file)==entry['sha256'],name
assert digest(release/'server.py')==record['serverSha256']
shutil.copyfile(release/'server.py',root/'server.py')
(root/'server.py').chmod(0o644)
assert not (root/'current').exists()
(root/'current').symlink_to(release/'public',target_is_directory=True)
(root/'release.json').write_text(json.dumps(record,indent=2)+'\n')
print('Release verified: '+record['release'],flush=True)
print('Verified public files: '+str(len(manifest)),flush=True)
