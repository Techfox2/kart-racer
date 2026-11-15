import copy
import http.client
import json
import secrets
import sqlite3
import struct
import unittest
from test_accounts import Accounts

class CloudHTTP(Accounts):
    def test_cloud(self):
        code,headers,_=self.request('/api/register',{'username':'CloudRacer','password':secrets.token_urlsafe(20)})
        self.assertEqual(code,200);cookie=headers['Set-Cookie'].split(';')[0]
        code,_,body=self.request('/api/me',cookie=cookie);me=json.loads(body)
        self.assertRegex(me['id'],'^[A-Z0-9]{6}$')
        self.assertIn(b'window.KART_ACCOUNT=',self.request('/',cookie=cookie)[2])
        for asset in ('world-style.js','experimental-shaders.js','assets/scenery/grass-high.js','garage.js','gt3-extra.js','race-ready.js','lobby-vote.js','assets/backgrounds/multiplayer-grid-v2.webp','assets/backgrounds/multiplayer-grid-christmas-v2.webp'):
            self.assertEqual(self.request('/'+asset,cookie=cookie)[0],200)
            self.assertNotEqual(self.request('/'+asset)[0],200)
        state=copy.deepcopy(me['state']);state['kart-language']='fr';state['kart-wheel']='2'
        code,_,body=self.request('/api/account/state',{'revision':me['revision'],'state':state},cookie=cookie)
        self.assertEqual(code,200);saved=json.loads(body);self.assertEqual(saved['id'],me['id'])
        self.assertEqual(self.request('/api/account/state',{'revision':me['revision'],'state':me['state']},cookie=cookie)[0],409)
        forged=copy.deepcopy(state);progress=json.loads(forged['kart-save']);progress['coins']=999999;forged['kart-save']=json.dumps(progress)
        self.assertEqual(self.request('/api/account/state',{'revision':saved['revision'],'state':forged},cookie=cookie)[0],400)
        self.assertEqual(self.request('/api/account/rename',{'revision':saved['revision'],'username':'NextRacer'},cookie=cookie)[0],409)
        self.assertEqual(self.request('/api/account/buy-car',{'revision':saved['revision'],'car':'amg'})[0],401)
        self.assertEqual(self.request('/api/account/buy-car',{'revision':saved['revision'],'car':'amg'},cookie=cookie)[0],409)
        # Fund only the disposable test database, never a real account.
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as db:
            row=db.execute('SELECT user_id,state FROM profiles JOIN users ON users.id=user_id WHERE username=?',('CloudRacer',)).fetchone()
            funded=json.loads(row[1]);p=json.loads(funded['kart-save']);p['coins']=2000;funded['kart-save']=json.dumps(p)
            db.execute('UPDATE profiles SET state=? WHERE user_id=?',(json.dumps(funded),row[0]))
        code,_,body=self.request('/api/account/buy-car',{'revision':saved['revision'],'car':'amg'},cookie=cookie)
        self.assertEqual(code,200);bought=json.loads(body);p=json.loads(bought['state']['kart-save'])
        self.assertEqual(p['coins'],500);self.assertIn('amg',p['ownedCars'])
        retry=self.request('/api/account/buy-car',{'revision':saved['revision'],'car':'amg'},cookie=cookie)
        self.assertEqual(json.loads(retry[2]),bought)
        self.assertEqual(self.request('/api/account/buy-cosmetic',{'kind':'icon','item':'bolt','revision':bought['revision']})[0],401)
        code,_,body=self.request('/api/account/buy-cosmetic',{'kind':'icon','item':'bolt','revision':bought['revision']},cookie=cookie)
        self.assertEqual(code,200);cosmetic=json.loads(body);p=json.loads(cosmetic['state']['kart-save'])
        self.assertEqual(p['coins'],200);self.assertIn('bolt',p['ownedProfileIcons'])
        self.assertEqual(self.request('/api/account/state',{'revision':0,'state':state})[0],401)
        self.assertEqual(self.request('/savegame.js',cookie=cookie)[0],404)
        samples=b'\0'*600000
        wav=b'RIFF'+struct.pack('<I',36+len(samples))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,8000,16000,2,16)+b'data'+struct.pack('<I',len(samples))+samples
        token=secrets.token_hex(16)
        for offset in range(0,len(wav),262144):
            c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=10)
            c.request('POST','/api/account/music',wav[offset:offset+262144],{'Origin':'https://kart.test','X-Kart-Request':'1','Cookie':cookie,'Content-Type':'audio/wav','X-Kart-Upload':token,'X-Kart-Offset':str(offset),'X-Kart-Total':str(len(wav))})
            r=c.getresponse();self.assertEqual(r.status,200);r.read();c.close()
        code,headers,content=self.request('/api/account/music',cookie=cookie,extra={'Range':'bytes=0-43'})
        self.assertEqual(code,206);self.assertEqual(content,wav[:44]);self.assertIn('bytes 0-43/',headers['Content-Range'])
        self.assertEqual(self.request('/api/account/music')[0],401)
        self.stop();self.start()
        current=json.loads(self.request('/api/me',cookie=cookie)[2]);self.assertEqual(current['id'],me['id']);self.assertEqual(current['state']['kart-language'],'fr');self.assertTrue(current['music'])

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([CloudHTTP('test_cloud')]))
    raise SystemExit(not result.wasSuccessful())
