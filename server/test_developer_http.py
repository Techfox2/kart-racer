import json
import secrets
import sqlite3
import unittest
from test_accounts import Accounts

class DeveloperHTTP(Accounts):
    def test_developer_routes_and_assets(self):
        for action in ['list','role','preview']:self.assertEqual(self.request('/api/dev/'+action,{})[0],401)
        code,h,_=self.request('/api/register',{'username':'DeveloperQA','password':secrets.token_urlsafe(20)});self.assertEqual(code,200);cookie=h['Set-Cookie'].split(';')[0]
        self.assertEqual(self.request('/api/dev/list',{},cookie=cookie)[0],403)
        self.assertEqual(self.request('/api/dev/preview',{'enabled':True,'kart':True,'revision':0},cookie=cookie)[0],403)
        for asset in ['developer.js','winter.js','cockpit.js','kart-tracks.js','progression.js','assets/materials/stylized/winter-surfaces-v1.webp','assets/vehicles/previews/porsche.webp']:
            code,h,body=self.request('/'+asset,cookie=cookie);self.assertEqual(code,200,asset);self.assertTrue(body);self.assertIn('private',h['Cache-Control']);self.assertNotEqual(self.request('/'+asset)[0],200)
        for asset in ['assets/branding/grand-poly.webp','assets/branding/favicon.png','assets/branding/apple-touch-icon.png']:self.assertEqual(self.request('/'+asset)[0],200)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:c.execute("INSERT INTO developer_roles SELECT id,'main' FROM users WHERE username='DeveloperQA'")
        me=json.loads(self.request('/api/me',cookie=cookie)[2]);self.assertEqual(me['developer']['role'],'main')
        request={'enabled':True,'kart':True,'revision':me['revision']}
        self.assertEqual(self.request('/api/dev/preview',request,cookie=cookie,origin='https://wrong.test')[0],403)
        code,_,body=self.request('/api/dev/preview',request,cookie=cookie);self.assertEqual(code,200);result=json.loads(body);self.assertTrue(result['developer']['christmasPreview']);self.assertEqual(json.loads(result['state']['kart-save'])['kartSkin'],'christmas')
        self.assertIn(b'"christmasPreview": true',self.request('/',cookie=cookie)[2]);self.assertEqual(self.request('/api/dev/preview',request,cookie=cookie)[0],409)
        self.assertEqual(self.request('/api/dev/list',{},cookie=cookie)[0],200)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([DeveloperHTTP('test_developer_routes_and_assets')]))
    raise SystemExit(not result.wasSuccessful())
