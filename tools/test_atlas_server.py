import http.client
import gzip
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest


class StaticServerChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('atlas_server',Path(__file__).with_name('atlas_server.py'))
        cls.module=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.module)
        cls.temp=tempfile.TemporaryDirectory();root=Path(cls.temp.name)
        (root/'index.html').write_bytes(b'<!doctype html>Atlas')
        (root/'assets').mkdir();(root/'assets/audio.mp3').write_bytes(b'0123456789')
        (root/'assets/app.js').write_text('export const ok=true;',encoding='utf-8')
        (root/'assets/app.js.gz').write_bytes(gzip.compress(b'export const ok=true;'))
        cls.server=cls.module.make_server('127.0.0.1',0,root)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()

    def request(self,path='/',headers=None,method='GET'):
        con=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        con.request(method,path,headers=headers or {});r=con.getresponse()
        answer=(r.status,dict(r.getheaders()),r.read());con.close();return answer

    def test_index(self):
        code,headers,body=self.request();self.assertEqual(code,200);self.assertIn(b'Atlas',body)

    def test_audio_range(self):
        code,headers,body=self.request('/assets/audio.mp3',{'Range':'bytes=2-5'})
        self.assertEqual(code,206);self.assertEqual(body,b'2345')
        self.assertEqual(headers['Content-Range'],'bytes 2-5/10')

    def test_suffix_range(self):
        code,_,body=self.request('/assets/audio.mp3',{'Range':'bytes=-3'})
        self.assertEqual(code,206);self.assertEqual(body,b'789')

    def test_invalid_range(self):
        code,headers,_=self.request('/assets/audio.mp3',{'Range':'bytes=20-'})
        self.assertEqual(code,416);self.assertEqual(headers['Content-Range'],'bytes */10')

    def test_cache(self):
        _,headers,_=self.request('/assets/app.js')
        code,_,body=self.request('/assets/app.js',{'If-None-Match':headers['ETag']})
        self.assertEqual(code,304);self.assertEqual(body,b'')

    def test_precompressed_javascript(self):
        code,headers,body=self.request('/assets/app.js',{'Accept-Encoding':'gzip'})
        self.assertEqual(code,200);self.assertEqual(headers['Content-Encoding'],'gzip')
        self.assertEqual(gzip.decompress(body),b'export const ok=true;')
        self.assertTrue(headers['Content-Type'].startswith('text/javascript'))

    def test_head(self):
        code,headers,body=self.request('/assets/audio.mp3',method='HEAD')
        self.assertEqual(code,200);self.assertEqual(headers['Content-Length'],'10');self.assertFalse(body)

    def test_private_and_missing_paths(self):
        for path in ['/../venv/pyvenv.cfg','/%2e%2e/secret','/.release-manifest.json','/assets/','/server.py']:
            self.assertIn(self.request(path)[0],[403,404],path)


if __name__=='__main__':unittest.main()
