"""Package only public website files, never credentials, git or authoring data."""
from datetime import datetime,timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/ecs-deploy'


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    files=[ROOT/'index.html']+sorted(p for p in (ROOT/'assets').rglob('*') if p.is_file())
    assert len(files)>500
    manifest={};identity=hashlib.sha256()
    archive=OUT/'shanhe-atlas.tar.gz'
    with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
        for path in files:
            relative=path.relative_to(ROOT).as_posix()
            assert '..' not in Path(relative).parts and not path.is_symlink()
            assert path.suffix not in ['.tmp','.pyc','.zip','.blend']
            raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
            identity.update(relative.encode()+digest.encode())
            manifest[relative]={'sha256':digest,'bytes':len(raw)}
            info=tarfile.TarInfo('public/'+relative);info.mode=0o644;info.size=len(raw);info.mtime=int(path.stat().st_mtime)
            tar.addfile(info,io.BytesIO(raw))
            if path.suffix.lower() in ['.html','.js','.css','.json','.svg'] and len(raw)>1024:
                zipped=gzip.compress(raw,compresslevel=6,mtime=0)
                if len(zipped)<len(raw)*.9:
                    name=relative+'.gz';manifest[name]={'sha256':hashlib.sha256(zipped).hexdigest(),'bytes':len(zipped)}
                    info=tarfile.TarInfo('public/'+name);info.mode=0o644;info.size=len(zipped)
                    tar.addfile(info,io.BytesIO(zipped))
        raw=json.dumps(manifest,separators=(',',':')).encode()
        info=tarfile.TarInfo('public/.release-manifest.json');info.size=len(raw);info.mode=0o644
        tar.addfile(info,io.BytesIO(raw))
        tar.add(ROOT/'tools/atlas_server.py',arcname='server.py',recursive=False)
    release=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+identity.hexdigest()[:12]
    record={'release':release,'websiteFiles':len(files),'servedFiles':len(manifest),
            'uncompressedBytes':sum(r['bytes'] for r in manifest.values()),'archiveBytes':archive.stat().st_size,
            'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
            'serverSha256':hashlib.sha256((ROOT/'tools/atlas_server.py').read_bytes()).hexdigest()}
    (OUT/'package.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(record),flush=True)


if __name__=='__main__':main()
