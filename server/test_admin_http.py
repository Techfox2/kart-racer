import json
import secrets
import sqlite3
import unittest
from test_accounts import Accounts

class AdminHTTP(Accounts):
    def test_admin_routes(self):
        self.assertEqual(self.request('/api/admin/status')[0],401)
        self.assertEqual(self.request('/api/admin/list',{})[0],401)
        self.assertEqual(self.request('/api/rankings?track=circuit&category=kart')[0],401)
        cookies=[];ids=[];passwords=[]
        for i in range(2):
            password=secrets.token_urlsafe(20);passwords.append(password)
            code,h,_=self.request('/api/register',{'username':'AdminQA'+str(i),'password':password});self.assertEqual(code,200);cookies.append(h['Set-Cookie'].split(';')[0]);ids.append(json.loads(self.request('/api/me',cookie=cookies[-1])[2])['id'])
        a,b=cookies
        self.assertFalse(json.loads(self.request('/api/admin/status',cookie=a)[2])['admin'])
        self.assertEqual(self.request('/api/admin/list',{},cookie=a)[0],403)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:c.execute("INSERT INTO admin_roles(user_id,role) SELECT id,'founder' FROM users WHERE username='AdminQA0'")
        self.assertTrue(json.loads(self.request('/api/admin/status',cookie=a)[2])['admin'])
        self.assertEqual(self.request('/api/admin/list',{},cookie=a,origin='https://wrong.test')[0],403)
        code,_,body=self.request('/api/admin/list',{},cookie=a);self.assertEqual(code,200);self.assertEqual(len(json.loads(body)['users']),2)
        code,_,body=self.request('/api/admin/inventory',{'id':ids[1]},cookie=a);self.assertEqual(code,200)
        inventory=json.loads(body);change={**inventory,'level':30,'ownedAmbient':['default','ocean'],'ambient':'ocean','ownedKarts':['original','apex'],'kartModel':'apex'}
        self.assertEqual(self.request('/api/admin/inventory-save',change,cookie=b)[0],403)
        self.assertEqual(self.request('/api/admin/inventory-save',change,cookie=a,origin='https://wrong.test')[0],403)
        code,_,body=self.request('/api/admin/inventory-save',change,cookie=a);self.assertEqual(code,200);result=json.loads(body)
        self.assertEqual((result['level'],result['ambient'],result['kartModel']),(30,'ocean','apex'))
        self.assertEqual(self.request('/api/admin/inventory-save',change,cookie=a)[0],409)
        progress=json.loads(json.loads(self.request('/api/me',cookie=b)[2])['state']['kart-save'])
        self.assertEqual((progress['xp'],progress['ambient'],progress['kartModel']),(7250,'ocean','apex'))
        r=json.loads(self.request('/api/rooms/create',{},cookie=b)[2])
        snapshot=json.loads(self.request('/api/admin/list',{},cookie=a)[2]);self.assertEqual(snapshot['rooms'][0]['code'],r['code']);self.assertNotIn(r['peer'],str(snapshot))
        self.assertEqual(self.request('/api/admin/close-room',{'code':r['code']},cookie=b)[0],403)
        self.assertEqual(self.request('/api/admin/close-room',{'code':r['code']},cookie=a)[0],200)
        self.assertEqual(self.request('/api/rooms/poll',dict(r,after=0),cookie=b)[0],404)
        self.assertEqual(self.request('/api/admin/suspend',{'id':ids[1],'enabled':True},cookie=a)[0],200)
        self.assertEqual(self.request('/api/me',cookie=b)[0],401)
        self.assertEqual(self.request('/api/login',{'username':'AdminQA1','password':passwords[1]})[0],403)
        self.assertEqual(self.request('/api/admin/suspend',{'id':ids[1],'enabled':False},cookie=a)[0],200)
        self.assertEqual(self.request('/api/login',{'username':'AdminQA1','password':passwords[1]})[0],200)
        code,_,body=self.request('/api/rankings?track=circuit&category=kart',cookie=a);self.assertEqual(code,200);self.assertEqual(json.loads(body)['entries'],[])
        self.assertEqual(self.request('/api/rankings?track=bad&category=kart',cookie=a)[0],400)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([AdminHTTP('test_admin_routes')]))
    raise SystemExit(not result.wasSuccessful())
