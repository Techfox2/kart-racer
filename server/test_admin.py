import sqlite3
import unittest
import json
import time
import admin
import profiles
from rooms import Broker

class AdminTests(unittest.TestCase):
    def test_glass_permissions_revision_audit_and_legacy_admin(self):
        inventory=self.call(1,'inventory',{'id':self.pid(4)})
        self.assertIs(inventory['glass'],True)
        with self.assertRaises(profiles.ProfileError):self.call(4,'inventory-save',{**inventory,'glass':False})
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**inventory,'glass':0})
        saved=self.call(1,'inventory-save',{**inventory,'glass':False})
        self.assertIs(saved['glass'],False)
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**inventory,'glass':True})
        audit=self.call(1,'list',{})['audit'][0]['details']
        self.assertIs(audit['before']['glass'],True);self.assertIs(audit['after']['glass'],False)
        del saved['glass'];saved=self.call(1,'inventory-save',saved)
        self.assertIs(saved['glass'],False)

    def setUp(self):
        self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON')
        self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE)')
        self.c.executemany('INSERT INTO users VALUES (?,?)',[(1,'MrBucks'),(2,'MrBucks2'),(3,'Anton'),(4,'Racer')])
        profiles.migrate(self.c);self.c.execute('CREATE TABLE activity(user_id INTEGER,seen INTEGER)');self.c.execute('CREATE TABLE sessions(digest TEXT,user_id INTEGER,expires INTEGER)');admin.migrate(self.c);self.c.commit();admin.migrate(self.c,{self.pid(1):'founder',self.pid(2):'head',self.pid(3):'admin'});self.c.commit();self.b=Broker()
    def tearDown(self):self.c.close()
    def pid(self,uid):return self.c.execute('SELECT player_id FROM users WHERE id=?',(uid,)).fetchone()[0]
    def call(self,uid,name,data):
        with self.c:return admin.action(self.c,uid,name,data,self.b)
    def test_seed_is_one_time_and_identity_bound(self):
        self.assertEqual([admin.allowed(self.c,i) for i in range(1,5)],[True,True,True,False])
        self.c.execute("UPDATE users SET username='NewName' WHERE id=1")
        self.c.execute("UPDATE users SET username='MrBucks' WHERE id=4")
        admin.migrate(self.c);self.c.commit()
        self.assertTrue(admin.allowed(self.c,1));self.assertFalse(admin.allowed(self.c,4))
        self.call(1,'role',{'id':self.pid(3),'enabled':False});admin.migrate(self.c);self.c.commit();self.assertFalse(admin.allowed(self.c,3))
    def test_missing_seed_name_cannot_claim_later(self):
        self.c.execute('DELETE FROM users WHERE id=3');self.c.execute("UPDATE users SET username='Anton' WHERE id=4")
        admin.migrate(self.c);self.c.commit();self.assertFalse(admin.allowed(self.c,4))
    def test_all_actions_require_role_and_last_admin_survives(self):
        for name,data in [('list',{}),('role',{'id':self.pid(4),'enabled':True}),('suspend',{'id':self.pid(1),'enabled':True}),('close-room',{'code':'ABCD1234'})]:
            with self.assertRaises(profiles.ProfileError) as e:self.call(4,name,data)
            self.assertEqual(e.exception.status,403)
        for uid in (2,3):self.call(1,'role',{'id':self.pid(uid),'enabled':False})
        with self.assertRaises(profiles.ProfileError) as e:self.call(1,'role',{'id':self.pid(1),'enabled':False})
        self.assertEqual(e.exception.code,'founder_protected');self.assertTrue(admin.allowed(self.c,1))
        self.call(1,'role',{'id':self.pid(4),'enabled':True});self.assertTrue(admin.allowed(self.c,4))
    def test_suspend_revokes_sessions_and_rooms(self):
        self.c.execute("INSERT INTO sessions VALUES ('secret',4,9999999999)");self.c.commit()
        r=self.b.call('create',4,{});other=self.b.call('create',1,{});self.b.call('join',4,{'code':other['code']})
        self.call(1,'suspend',{'id':self.pid(4),'enabled':True})
        self.assertFalse(self.c.execute('SELECT 1 FROM sessions WHERE user_id=4').fetchone());self.assertNotIn(r['code'],self.b.rooms);self.assertEqual(len(self.b.rooms[other['code']]['members']),1)
        with self.assertRaises(profiles.ProfileError):self.call(1,'role',{'id':self.pid(4),'enabled':True})
        with self.assertRaises(profiles.ProfileError):self.call(3,'suspend',{'id':self.pid(2),'enabled':True})
        self.call(1,'suspend',{'id':self.pid(4),'enabled':False});self.assertFalse(self.c.execute('SELECT 1 FROM account_blocks').fetchone())
    def test_room_snapshot_never_exposes_signaling(self):
        r=self.b.call('create',4,{});j=self.b.call('join',1,{'code':r['code']});self.b.call('signal',1,{'code':r['code'],'peer':j['peer'],'to':r['peer'],'message':{'type':'offer','sdp':'v=0 secret-address'}})
        result=self.call(1,'list',{});self.assertEqual(len(result['rooms']),1);self.assertEqual(result['rooms'][0]['host']['id'],self.pid(4))
        self.assertNotIn('secret-address',str(result));self.assertNotIn(r['peer'],str(result));self.assertEqual(set(result['users'][0]),{'id','username','admin','role','blocked','online','developer'})
        self.call(1,'close-room',{'code':r['code']});self.assertNotIn(r['code'],self.b.rooms);self.assertEqual(self.call(1,'list',{})['audit'][0]['action'],'close-room')

    def test_inventory_atomic_permissions_and_equipped_fallback(self):
        pid=self.pid(4)
        for route in ('inventory','inventory-save'):
            with self.assertRaises(profiles.ProfileError):self.call(4,route,{'id':pid})
        current=self.call(1,'inventory',{'id':pid});data={**current,'coins':12345,'owned':list(range(10)),'ownedCars':list(profiles.CAR_PRICES),'ownedProfileBackgrounds':list(profiles.PROFILE_BACKGROUNDS),'ownedProfileIcons':list(profiles.PROFILE_ICONS)}
        result=self.call(1,'inventory-save',data);self.assertEqual(result['coins'],12345);self.assertEqual(result['revision'],current['revision']+1)
        with self.assertRaises(profiles.ProfileError) as e:self.call(1,'inventory-save',data)
        self.assertEqual(e.exception.code,'conflict')
        account=profiles.account(self.c,4);s=account['state'];p=json.loads(s['kart-save']);p.update(car='ferrari',paint=9,profileBackground='teal',profileIcon='crown');s['kart-save']=json.dumps(p)
        with self.c:profiles.save(self.c,4,{'revision':account['revision'],'state':s})
        current=self.call(1,'inventory',{'id':pid});data={**current,'coins':0,'owned':[0,1],'ownedCars':['porsche'],'ownedProfileBackgrounds':['purple'],'ownedProfileIcons':['helmet']};self.call(1,'inventory-save',data)
        account=profiles.account(self.c,4);p=json.loads(account['state']['kart-save']);self.assertEqual([p[k] for k in ('coins','car','paint','profileBackground','profileIcon')],[0,'porsche',0,'purple','helmet']);self.assertEqual(account['id'],pid)
        audit=self.call(1,'list',{})['audit'][0];self.assertEqual(audit['details']['before']['coins'],12345);self.assertEqual(audit['details']['after']['coins'],0)

    def test_inventory_rejects_bad_values_without_mutation(self):
        original=self.call(1,'inventory',{'id':self.pid(4)})
        for change in ({'coins':-1},{'coins':True},{'coins':10**12+1},{'owned':[0]},{'ownedCars':['porsche','fake']},{'ownedProfileIcons':['helmet','helmet']},{'ownedProfileBackgrounds':[]},{'owned':[0,1,{}]}):
            with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**original,**change})
            self.assertEqual(self.call(1,'inventory',{'id':self.pid(4)}),original)

    def test_level_cosmetics_selection_audit_and_legacy_editor(self):
        state=profiles.defaults();p=json.loads(state['kart-save']);p['xp']=73;p['pass']={'2':1};state['kart-save']=json.dumps(p)
        with self.c:profiles.save(self.c,4,{'revision':0,'state':state})
        original=self.call(1,'inventory',{'id':self.pid(4)})
        change={**original,'level':30,'ownedAmbient':['default','midnight'],'ambient':'midnight','ownedKarts':['original','vector'],'kartModel':'vector'}
        result=self.call(1,'inventory-save',change)
        self.assertEqual((result['level'],result['ambient'],result['kartModel']),(30,'midnight','vector'))
        p=json.loads(profiles.account(self.c,4)['state']['kart-save']);self.assertEqual(p['xp'],29*250+73);self.assertEqual(p['pass'],{'2':True})
        audit=self.call(1,'list',{})['audit'][0]['details'];self.assertEqual(audit['before']['xp'],73);self.assertEqual(audit['after']['ambient'],'midnight');self.assertEqual(audit['after']['ownedKarts'],['original','vector','christmas'])
        with self.assertRaises(profiles.ProfileError) as e:self.call(1,'inventory-save',change)
        self.assertEqual(e.exception.code,'conflict')
        legacy={k:result[k] for k in ('id','revision','coins','owned','ownedCars','ownedProfileBackgrounds','ownedProfileIcons')}
        result=self.call(1,'inventory-save',legacy)
        self.assertEqual((result['level'],result['ambient'],result['kartModel']),(30,'midnight','vector'))
        result=self.call(1,'inventory-save',{**result,'level':1,'ownedKarts':['original'],'ownedAmbient':['default']})
        self.assertEqual((result['level'],result['ambient'],result['kartModel']),(1,'default','original'))
        p=json.loads(profiles.account(self.c,4)['state']['kart-save']);self.assertEqual(p['xp'],73);self.assertEqual(p['pass'],{'2':True})

    def test_new_inventory_fields_invalid_and_role_protected(self):
        original=self.call(1,'inventory',{'id':self.pid(4)})
        for change in ({'level':0},{'level':True},{'level':1.5},{'level':4000000002},{'ownedAmbient':[]},{'ownedKarts':['original','fake']},{'ambient':'ocean'},{'kartModel':'apex'},{'paint':True}):
            with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**original,**change})
            self.assertEqual(self.call(1,'inventory',{'id':self.pid(4)}),original)
        for actor,target in ((4,4),(3,2),(2,1)):
            with self.assertRaises(profiles.ProfileError):self.call(actor,'inventory-save',{**original,'id':self.pid(target),'level':20})
        result=self.call(1,'inventory-save',{**original,'level':4000000001})
        self.assertEqual(result['level'],4000000001)
        self.assertEqual(json.loads(profiles.account(self.c,4)['state']['kart-save'])['xp'],10**12)

    def test_customizer_admin_grant_revoke_audit_and_legacy(self):
        original=self.call(1,'inventory',{'id':self.pid(4)})
        result=self.call(1,'inventory-save',{**original,'ownedTools':['customizer'],'paintMode':'custom','customPaint':'#22bbff','savedPaints':['#22bbff'],'ownedCars':['porsche','bmw','mclaren'],'car':'mclaren'})
        audit=self.call(1,'list',{})['audit'][0]['details'];self.assertEqual(audit['after']['paintMode'],'custom');self.assertEqual(audit['after']['ownedTools'],['customizer'])
        legacy={k:v for k,v in result.items() if k not in profiles.CUSTOM_KEYS};legacy['ownedCars']=['porsche'];del legacy['car']
        result=self.call(1,'inventory-save',legacy);self.assertEqual(result['car'],'mclaren');self.assertEqual(result['customPaint'],'#22bbff')
        for change in [{'customPaint':'#nope'},{'savedPaints':['#000000']*9},{'ownedTools':['fake']}]:
            with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**result,**change})
        revoked=self.call(1,'inventory-save',{**result,'ownedTools':[],'ownedCars':['porsche']})
        self.assertEqual((revoked['paintMode'],revoked['car']),('preset','porsche'));self.assertEqual(revoked['savedPaints'],['#22bbff'])
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',result)

    def test_role_hierarchy_founder_and_peer_protection(self):
        self.assertEqual([admin.role(self.c,i) for i in (1,2,3)],['founder','head','admin'])
        for actor,target in [(3,2),(3,1),(2,1),(2,2),(1,1)]:
            with self.assertRaises(profiles.ProfileError):self.call(actor,'suspend',{'id':self.pid(target),'enabled':True})
        with self.assertRaises(profiles.ProfileError):self.call(3,'role',{'id':self.pid(4),'enabled':True})
        self.call(2,'role',{'id':self.pid(4),'enabled':True});self.assertEqual(admin.role(self.c,4),'admin')
        with self.assertRaises(profiles.ProfileError):self.call(3,'suspend',{'id':self.pid(4),'enabled':True})
        self.call(2,'suspend',{'id':self.pid(4),'enabled':True});self.assertFalse(admin.allowed(self.c,4))
        self.call(2,'suspend',{'id':self.pid(4),'enabled':False});self.assertTrue(admin.allowed(self.c,4))
        with self.assertRaises(profiles.ProfileError):self.call(2,'role',{'id':self.pid(4),'enabled':True,'role':'head'})
        self.call(1,'role',{'id':self.pid(4),'enabled':True,'role':'head'});self.assertEqual(admin.role(self.c,4),'head')
        with self.assertRaises(profiles.ProfileError):self.call(2,'suspend',{'id':self.pid(4),'enabled':True})
        with self.assertRaises(profiles.ProfileError):self.call(4,'role',{'id':self.pid(2),'enabled':False})
        with self.assertRaises(profiles.ProfileError):self.call(1,'role',{'id':self.pid(4),'enabled':True,'role':'founder'})
        self.call(1,'suspend',{'id':self.pid(4),'enabled':True});self.assertFalse(admin.allowed(self.c,4))
        self.c.execute("UPDATE users SET username='DifferentFounderName' WHERE id=1");admin.migrate(self.c,{self.pid(1):'founder',self.pid(2):'head',self.pid(3):'head'});self.c.commit()
        self.assertEqual(admin.role(self.c,1),'founder');self.assertEqual(admin.role(self.c,3),'admin')

    def test_online_offline_filter_and_expiry(self):
        with self.c:self.c.executemany('INSERT INTO activity VALUES (?,?)',[(3,int(time.time())),(4,int(time.time())-91)])
        self.assertEqual([u['id'] for u in self.call(1,'list',{'status':'online'})['users']],[self.pid(3)])
        self.assertEqual(len(self.call(1,'list',{'status':'offline'})['users']),3)
        self.assertEqual(len(self.call(1,'list',{'status':'all'})['users']),4)
        self.call(1,'suspend',{'id':self.pid(3),'enabled':True})
        self.assertEqual(self.call(1,'list',{'status':'online'})['users'],[])
        with self.assertRaises(profiles.ProfileError):self.call(1,'list',{'status':'wrong'})

    def test_progression_claim_management_revision_audit_and_legacy(self):
        inv=self.call(1,'inventory',{'id':self.pid(4)})
        data={**inv,'missionClaims':['first','kartTour'],'levelClaims':['2','100'],'level':100}
        result=self.call(1,'inventory-save',data)
        self.assertEqual(set(result['missionClaims']),{'first','kartTour'});self.assertEqual(set(result['levelClaims']),{'2','100'})
        audit=json.loads(self.c.execute("SELECT details FROM admin_events WHERE action='inventory-save' ORDER BY id DESC LIMIT 1").fetchone()[0]);self.assertEqual(audit['after']['pass'],{'2':1,'100':1})
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',data)
        legacy=dict(result);legacy.pop('missionClaims');legacy.pop('levelClaims');legacy['coins']=400
        result=self.call(1,'inventory-save',legacy);self.assertEqual(set(result['levelClaims']),{'2','100'})
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**result,'missionClaims':['invented']})
        self.assertEqual(self.call(1,'inventory',{'id':self.pid(4)})['coins'],400)

if __name__=='__main__':unittest.main()
