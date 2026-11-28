"""Bounded static hosting for the atlas; Python 3.10+, no third-party runtime."""
import argparse
from functools import partial
import http.server
import json
import logging
from logging.handlers import RotatingFileHandler
import mimetypes
from pathlib import Path
import re
import shutil
import threading
from urllib.parse import unquote,urlsplit

LOG=logging.getLogger('shanhe-atlas')


class AtlasHandler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    server_version='ShanheAtlas/1.0'
    sys_version=''

    def __init__(self,*args,directory,manifest=None,**kwargs):
        self.root=Path(directory).resolve();self.manifest=manifest or {}
        super().__init__(*args,**kwargs)

    def setup(self):
        super().setup();self.connection.settimeout(15)

    def log_message(self,fmt,*args):
        # Normal asset transfers are intentionally quiet; error logs rotate.
        if len(args)>1 and str(args[1]).startswith(('4','5')):
            LOG.warning('%s %s',self.client_address[0],fmt%args)

    def do_GET(self):self.serve_file(False)
    def do_HEAD(self):self.serve_file(True)

    def serve_file(self,head):
        path=unquote(urlsplit(self.path).path)
        if '\x00' in path or '\\' in path:
            self.send_error(404);return
        relative=path.lstrip('/') or 'index.html'
        if any(part.startswith('.') for part in Path(relative).parts):
            self.send_error(404);return
        target=(self.root/relative).resolve()
        if not target.is_relative_to(self.root) or not target.is_file():
            self.send_error(404);return
        source=target
        encoding=None
        if not self.headers.get('Range') and 'gzip' in self.headers.get('Accept-Encoding',''):
            zipped=Path(str(target)+'.gz')
            if zipped.is_file():target=zipped;encoding='gzip'
        try:file=target.open('rb')
        except OSError:self.send_error(404);return
        with file:
            stat=target.stat();size=stat.st_size
            key=target.relative_to(self.root).as_posix()
            digest=self.manifest.get(key,{}).get('sha256')
            etag='"'+(digest or f'{stat.st_mtime_ns:x}-{size:x}')+'"'
            if self.headers.get('If-None-Match')==etag:
                self.send_response(304);self.send_header('ETag',etag)
                self.send_header('Content-Length','0');self.end_headers();return
            start=0;end=size-1;status=200
            value=self.headers.get('Range')
            if value and self.headers.get('If-Range',etag)==etag:
                match=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
                try:
                    if not match or not any(match.groups()):raise ValueError()
                    left,right=match.groups()
                    if left:
                        start=int(left);end=min(int(right),size-1) if right else size-1
                    else:
                        count=int(right)
                        if count<=0:raise ValueError()
                        start=max(0,size-count)
                    if start>=size or start>end:raise ValueError()
                except ValueError:
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}')
                    self.send_header('Content-Length','0');self.end_headers();return
                status=206
            content_type={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
                '.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8',
                '.glb':'model/gltf-binary','.webp':'image/webp','.mp3':'audio/mpeg',
                '.wasm':'application/wasm'}.get(source.suffix.lower(),mimetypes.guess_type(str(source))[0] or 'application/octet-stream')
            length=end-start+1
            self.send_response(status)
            for key,value in [('Content-Type',content_type),('Content-Length',str(length)),
                              ('Accept-Ranges','bytes'),('ETag',etag),
                              ('Last-Modified',self.date_time_string(stat.st_mtime)),
                              ('X-Content-Type-Options','nosniff'),('Vary','Accept-Encoding'),
                              ('Cache-Control','no-cache' if source.suffix=='.html' else 'public, max-age=3600, must-revalidate')]:
                self.send_header(key,value)
            if encoding:self.send_header('Content-Encoding',encoding)
            if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
            self.end_headers()
            if head:return
            file.seek(start)
            try:
                while length:
                    block=file.read(min(length,65536))
                    if not block:break
                    self.wfile.write(block);length-=len(block)
            except (BrokenPipeError,ConnectionResetError,TimeoutError):pass


class AtlasServer(http.server.ThreadingHTTPServer):
    daemon_threads=True
    request_queue_size=64
    allow_reuse_address=True

    def __init__(self,*args,**kwargs):
        self.slots=threading.BoundedSemaphore(32)
        super().__init__(*args,**kwargs)

    def process_request(self,request,address):
        if not self.slots.acquire(timeout=.25):
            try:request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\nRetry-After: 2\r\n\r\n')
            finally:self.shutdown_request(request)
            return
        try:super().process_request(request,address)
        except BaseException:self.slots.release();raise

    def process_request_thread(self,*args):
        try:super().process_request_thread(*args)
        finally:self.slots.release()


def make_server(host,port,directory):
    root=Path(directory).resolve();manifest_path=root/'.release-manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.is_file() else {}
    return AtlasServer((host,port),partial(AtlasHandler,directory=root,manifest=manifest))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--port',type=int,default=18081)
    parser.add_argument('--directory',type=Path,required=True);parser.add_argument('--log-dir',type=Path,required=True)
    args=parser.parse_args()
    handler=RotatingFileHandler(args.log_dir/'app.log',maxBytes=2*1024*1024,backupCount=3,encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    LOG.addHandler(handler);LOG.setLevel(logging.INFO)
    server=make_server(args.host,args.port,args.directory)
    LOG.info('Listening on %s:%s',args.host,args.port)
    with server:server.serve_forever()


if __name__=='__main__':main()
