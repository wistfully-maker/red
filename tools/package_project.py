"""Export a committed project plus its local art inputs; verify every ZIP member."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/releases'
ART_INPUTS=['field-supplied','keyframe-grass','luding-contributions',
            'luding-keyframe-assets','luding-scans','luding-tripo']


def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT)


def extras(tracked):
    for path in (ROOT/'output').rglob('*'):
        if not path.is_file() or path.is_symlink():continue
        name=path.relative_to(ROOT).as_posix()
        if name in tracked or name.startswith('output/releases/'):continue
        if path.suffix.lower() in ['.log','.tmp','.pyc','.tar','.gz','.blend1']:continue
        if path.name.endswith('-result.txt') or path.name=='known_hosts':continue
        if name.startswith('output/ecs-deploy/') and path.name not in ['package.json','install-verification.txt']:continue
        yield path
    for folder in ART_INPUTS:
        for path in (ROOT/'.workbuddy'/folder).rglob('*'):
            if not path.is_file() or path.is_symlink():continue
            if path.suffix.lower() in ['.log','.tmp','.pyc','.blend1'] or '__pycache__' in path.parts:continue
            if path.name.startswith('smoke.'):continue
            yield path
    for pattern in ['reference-*.png','tencent-map*.png','verify*.png']:
        yield from ROOT.glob(pattern)


def main():
    if git('diff','HEAD','--name-only').strip():
        raise RuntimeError('Commit tracked changes before packaging')
    commit=git('rev-parse','HEAD').decode().strip()
    tracked={}
    for row in git('ls-tree','-r','-z',commit).split(b'\0'):
        if not row:continue
        meta,name=row.split(b'\t',1);mode,kind,blob=meta.split()
        assert kind==b'blob' and mode!=b'120000','Do not export symlinks'
        tracked[name.decode('utf-8')]=blob.decode()
    OUT.mkdir(parents=True,exist_ok=True)
    target=OUT/('山河之路-完整项目-'+datetime.now().strftime('%Y%m%d')+'-'+commit[:7]+'.zip')
    temporary=target.with_suffix('.partial.zip')
    prefix='山河之路/'
    subprocess.run(['git','-c','core.autocrlf=false','archive','--format=zip',
                    '--prefix='+prefix,'--output='+str(temporary),commit],cwd=ROOT,check=True)
    additional=0
    with zipfile.ZipFile(temporary,'a',compression=zipfile.ZIP_DEFLATED,compresslevel=3,allowZip64=True) as archive:
        seen=set(archive.namelist())
        for path in extras(tracked):
            name=prefix+path.relative_to(ROOT).as_posix()
            if name in seen:continue
            archive.write(path,name);seen.add(name);additional+=1
        metadata={'commit':commit,'trackedFiles':len(tracked),'additionalFiles':additional,
            'artInputFolders':['.workbuddy/'+name for name in ART_INPUTS],
            'excluded':['.git','.playwright-cli','credentials','known_hosts','temporary logs',
                        'render caches','old binary versions','duplicate ECS upload archives']}
        archive.writestr(prefix+'交付版本.json',json.dumps(metadata,ensure_ascii=False,indent=2))
    checked=0
    with zipfile.ZipFile(temporary) as archive:
        names=archive.namelist();assert len(names)==len(set(names))
        for info in archive.infolist():
            assert info.filename.startswith(prefix)
            relative=info.filename[len(prefix):]
            assert '..' not in Path(relative).parts
            assert not relative.startswith(('.git/','.playwright-cli/','output/releases/'))
            assert not relative.endswith('/known_hosts')
            if info.is_dir():continue
            expected=tracked.get(relative)
            hasher=hashlib.sha1(b'blob '+str(info.file_size).encode()+b'\0') if expected else None
            with archive.open(info) as stream:
                for block in iter(lambda:stream.read(1024*1024),b''):
                    if hasher:hasher.update(block)
            if expected:
                assert hasher.hexdigest()==expected,relative
            checked+=1
        for name in tracked:assert prefix+name in names,name
    digest=hashlib.sha256()
    with temporary.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    temporary.replace(target)
    report={'archive':str(target.resolve()),'commit':commit,'bytes':target.stat().st_size,
            'filesVerified':checked,'trackedFilesMatched':len(tracked),'sha256':digest.hexdigest()}
    (OUT/'latest-package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/(target.name+'.sha256')).write_text(digest.hexdigest()+'  '+target.name+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
