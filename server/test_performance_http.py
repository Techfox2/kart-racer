"""Authenticated generated bundles and personalized HTML delivery."""
import gzip
import secrets
from test_accounts import Accounts

class PerformanceHTTP(Accounts):
    def test_bundles_remain_private(self):
        code, headers, _ = self.request('/api/register', {'username':'PerfAssets','password':secrets.token_urlsafe(20)})
        self.assertEqual(code,200)
        cookie=headers['Set-Cookie'].split(';')[0]
        for asset in ['ui-settings.js','ui-settings.css','assets/boot.js','assets/bundles/foundation.js','assets/bundles/game.js','assets/bundles/ui.js']:
            self.assertEqual(self.request('/'+asset)[0],401)
            code,h,body=self.request('/'+asset+'?v=test',cookie=cookie,extra={'Accept-Encoding':'gzip'})
            self.assertEqual(code,200)
            self.assertEqual(h['Cache-Control'],'private, no-cache')
            self.assertEqual(gzip.decompress(body),(self.root/asset).read_bytes())
            conditional={'Accept-Encoding':'gzip','If-None-Match':h['ETag']}
            self.assertEqual(self.request('/'+asset,cookie=cookie,extra=conditional)[0],304)
            self.assertEqual(self.request('/'+asset,extra=conditional)[0],401)
        code,h,body=self.request('/',cookie=cookie)
        self.assertEqual(code,200)
        self.assertEqual(h['Cache-Control'],'private, no-store')
        self.assertIn(b'window.KART_ACCOUNT=',body)
        self.assertNotIn(b'function buildRace(',body)
        self.assertIn(b'bootRetry',body)
        for asset in ['tutorial.js','tutorial-rules.js','tutorial-race.js','tutorial.css','assets/tutorial/catalog.json']:
            self.assertEqual(self.request('/'+asset,cookie=cookie)[0],404)
