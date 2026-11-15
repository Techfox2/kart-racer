import copy
import json
import sqlite3
import unittest
from unittest.mock import patch
import profiles
import admin
import devtools

class Developers(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON')
        self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE)')
        self.c.executemany('INSERT INTO users VALUES (?,?)',[(1,'MrBucks'),(2,'MrBucks2'),(3,'Anton'),(4,'Visitor')]);profiles.migrate(self.c);self.c.commit();admin.migrate(self.c);self.c.commit()
        self.seeds={self.pid(1):'main',self.pid(2):'developer',self.pid(3):'developer'};devtools.migrate(self.c,self.seeds);self.c.commit()
        for uid in range(1,5):
            with self.c:profiles.save(self.c,uid,{'revision':0,'state':profiles.defaults()})
    def tearDown(self):self.c.close()
    def pid(self,uid):return self.c.execute('SELECT player_id FROM users WHERE id=?',(uid,)).fetchone()[0]
    def call(self,uid,name,data):
        with self.c:return devtools.action(self.c,uid,name,data)
    def preview(self,uid,on,kart):return self.call(uid,'preview',{'revision':profiles.account(self.c,uid)['revision'],'enabled':on,'kart':kart})
    def test_identity_seed_once_and_preserve_admin_role(self):
        roles=list(self.c.execute('SELECT * FROM admin_roles'))
        self.c.execute("UPDATE users SET username='Renamed' WHERE id=1");self.c.execute("UPDATE users SET username='MrBucks' WHERE id=4");self.c.commit()
        devtools.migrate(self.c,self.seeds);self.c.commit()
        self.assertEqual(devtools.status(self.c,1)['role'],'main');self.assertIsNone(devtools.status(self.c,4)['role']);self.assertEqual(roles,list(self.c.execute('SELECT * FROM admin_roles')))
    def test_only_main_can_manage_developers(self):
        for uid in [2,3,4]:
            for name,data in [('list',{}),('role',{'id':self.pid(4),'enabled':True})]:
                with self.assertRaises(profiles.ProfileError) as e:self.call(uid,name,data)
                self.assertEqual(e.exception.status,403)
        self.call(1,'role',{'id':self.pid(4),'enabled':True});self.assertEqual(devtools.status(self.c,4)['role'],'developer')
        self.call(1,'role',{'id':self.pid(4),'enabled':False});self.assertIsNone(devtools.status(self.c,4)['role'])
        with self.assertRaises(profiles.ProfileError):self.call(1,'role',{'id':self.pid(1),'enabled':False})
        devtools.migrate(self.c,self.seeds);self.assertIsNone(devtools.status(self.c,4)['role'])
    def test_preview_and_early_kart_authorized_and_account_local(self):
        with patch('profiles.christmas_active',return_value=False):
            a=self.preview(2,True,True);self.assertTrue(a['developer']['christmasPreview']);self.assertEqual(json.loads(a['state']['kart-save'])['kartSkin'],'christmas')
            self.assertFalse(profiles.account(self.c,3)['developer']['christmasPreview'])
            with self.assertRaises(profiles.ProfileError):self.preview(4,True,True)
            a=self.preview(2,False,False);self.assertFalse(a['developer']['christmasPreview']);self.assertEqual(json.loads(a['state']['kart-save'])['kartSkin'],'original')
            with self.assertRaises(profiles.ProfileError):self.preview(2,False,True)
    def test_cloud_save_gate_revision_and_revoke(self):
        with patch('profiles.christmas_active',return_value=False):
            a=profiles.account(self.c,2);state=copy.deepcopy(a['state']);save=json.loads(state['kart-save']);save['kartSkin']='christmas';state['kart-save']=json.dumps(save)
            with self.assertRaises(profiles.ProfileError),self.c:profiles.save(self.c,2,{'revision':a['revision'],'state':state})
            a=self.preview(2,True,False)
            with self.c:a=profiles.save(self.c,2,{'revision':a['revision'],'state':state})
            with self.assertRaises(profiles.ProfileError):self.call(2,'preview',{'revision':0,'enabled':True,'kart':True})
            self.call(1,'role',{'id':self.pid(2),'enabled':False});b=profiles.account(self.c,2)
            self.assertIsNone(b['developer']['role']);self.assertFalse(b['developer']['christmasPreview']);self.assertEqual(json.loads(b['state']['kart-save'])['kartSkin'],'original');self.assertGreater(b['revision'],a['revision'])
            with self.assertRaises(profiles.ProfileError):self.preview(2,True,True)
    def test_blocked_developer_and_private_listing(self):
        with self.c:self.c.execute('INSERT INTO account_blocks VALUES(2)')
        self.assertIsNone(devtools.status(self.c,2)['role'])
        with self.assertRaises(profiles.ProfileError):self.preview(2,True,True)
        with self.assertRaises(profiles.ProfileError):self.call(1,'role',{'id':self.pid(2),'enabled':True})
        r=self.call(1,'list',{'query':self.pid(3)});self.assertEqual(len(r['users']),1);self.assertEqual(set(r['users'][0]),{'id','username','role'})
    def test_audit_and_validation(self):
        self.preview(1,True,True);self.call(1,'role',{'id':self.pid(4),'enabled':True})
        events=list(self.c.execute('SELECT action,actor,target,details FROM admin_events'));self.assertEqual(len(events),2);self.assertEqual(events[0]['actor'],self.pid(1));self.assertIn('kart',json.loads(events[0]['details']))
        for data in [{'id':'bad','enabled':True},{'id':self.pid(4),'enabled':1}]:
            with self.assertRaises(profiles.ProfileError):self.call(1,'role',data)

if __name__=='__main__':unittest.main()
