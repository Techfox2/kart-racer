import gzip
import json
import secrets
import unittest
from test_accounts import Accounts

class StaticFiles(Accounts):
    def test_asset_delivery(self):
        status,h,_=self.request('/api/register',{'username':'AssetRacer','password':secrets.token_urlsafe(20)})
        self.assertEqual(status,200);cookie=h['Set-Cookie'].split(';')[0]
        code,h,body=self.request('/assets/scenery/models.js',cookie=cookie,extra={'Accept-Encoding':'gzip'})
        self.assertEqual(code,200);self.assertEqual(h['Content-Encoding'],'gzip')
        self.assertEqual(gzip.decompress(body),(self.root/'assets/scenery/models.js').read_bytes())
        self.assertEqual(h['Cache-Control'],'private, no-cache');self.assertLess(len(body),len(gzip.decompress(body)))
        code,_,body=self.request('/assets/scenery/models.js',cookie=cookie,extra={'Accept-Encoding':'gzip','If-None-Match':h['ETag']})
        self.assertEqual(code,304);self.assertEqual(body,b'')
        self.assertEqual(self.request('/assets/scenery/models.js',extra={'If-None-Match':h['ETag']})[0],401)
        code,plain,body=self.request('/assets/scenery/models.js',cookie=cookie,extra={'Accept-Encoding':'gzip;q=0'})
        self.assertEqual(code,200);self.assertNotIn('Content-Encoding',plain);self.assertNotEqual(plain['ETag'],h['ETag'])
        self.assertEqual(self.request('/kart_racer.html',cookie=cookie)[1]['Cache-Control'],'private, no-store')
        self.assertEqual(self.request('/api/me',cookie=cookie)[1]['Cache-Control'],'private, no-store')
        self.assertEqual(self.request('/pit-stops.js')[0],401)
        self.assertEqual(self.request('/pit-stops.js',cookie=cookie)[0],200)
        code,html_headers,body=self.request('/kart_racer.html',cookie=cookie,extra={'Accept-Encoding':'gzip'})
        self.assertEqual(code,200);self.assertEqual(html_headers['Content-Encoding'],'gzip')
        self.assertEqual(html_headers['Cache-Control'],'private, no-store')
        self.assertEqual(html_headers['Vary'],'Accept-Encoding')
        self.assertIn(b'window.KART_ACCOUNT=',gzip.decompress(body))
        self.assertEqual(self.request('/kart_racer.html',extra={'Accept-Encoding':'gzip'})[0],303)
        self.assertEqual(self.request('/assets/backgrounds/multiplayer-garage-v2.webp')[0],200)
        self.assertEqual(self.request('/assets/backgrounds/multiplayer-christmas-v1.webp')[0],200)
        self.assertEqual(self.request('/season.js')[0],200)
        self.assertEqual(self.request('/stylized.js')[0],401)
        self.assertEqual(self.request('/assets/materials/stylized/surfaces-v1.webp')[0],401)
        self.assertEqual(self.request('/assets/materials/stylized/surfaces-v1.webp',cookie=cookie)[0],200)
        self.assertEqual(self.request('/assets/backgrounds/singleplayer-pitlane-v2.webp')[0],401)
        self.assertEqual(self.request('/assets/backgrounds/multiplayer-garage-v1.png',cookie=cookie)[0],404)
        self.assertEqual(self.request('/assets/backgrounds/singleplayer-pitlane-v1.png',cookie=cookie)[0],404)
        self.assertEqual(self.request('/api/ice')[0],401)
        status,headers,body=self.request('/api/ice',cookie=cookie)
        self.assertEqual(status,200)
        self.assertEqual(headers['Cache-Control'],'private, no-store')
        self.assertIsInstance(json.loads(body)['iceServers'],list)
        self.assertEqual(self.request('/server/staticfiles.py',cookie=cookie)[0],404)
        self.assertEqual(self.request('/assets/../../server/app.py',cookie=cookie)[0],404)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([StaticFiles('test_asset_delivery')]))
    raise SystemExit(not result.wasSuccessful())
