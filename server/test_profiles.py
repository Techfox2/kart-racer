import concurrent.futures
import copy
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
import profiles

class Profiles(unittest.TestCase):
    def test_upgrade_switch_independent_modes_legacy_and_boolean(self):
        state=profiles.defaults();progress=json.loads(state['kart-save'])
        self.assertIs(progress['upgradesEnabled'],True)
        self.assertIs(progress['quickPlay']['upgradesEnabled'],True)
        with self.db() as con:
            current=profiles.account(con,1)
            state=copy.deepcopy(current['state']);progress=json.loads(state['kart-save'])
            for competitive in (False,True):
                for enabled in (False,True):
                    progress['comp']=competitive;progress['upgradesEnabled']=enabled
                    progress['quickPlay']['comp']=competitive;progress['quickPlay']['upgradesEnabled']=enabled
                    state['kart-save']=json.dumps(progress)
                    current=profiles.save(con,1,{'revision':current['revision'],'state':state});con.commit()
                    saved=json.loads(current['state']['kart-save'])
                    self.assertIs(saved['upgradesEnabled'],enabled)
                    self.assertIs(saved['quickPlay']['upgradesEnabled'],enabled)
            progress['upgradesEnabled']=False;progress['quickPlay']['upgradesEnabled']=False
            state['kart-save']=json.dumps(progress)
            current=profiles.save(con,1,{'revision':current['revision'],'state':state});con.commit()
            del progress['upgradesEnabled'];del progress['quickPlay']['upgradesEnabled']
            state['kart-save']=json.dumps(progress)
            saved=profiles.save(con,1,{'revision':current['revision'],'state':state});con.commit()
            result=json.loads(saved['state']['kart-save'])
            self.assertIs(result['upgradesEnabled'],False)
            self.assertIs(result['quickPlay']['upgradesEnabled'],False)
        for invalid in (0,1,None,'false',[],{}):
            for quick in (False,True):
                state=profiles.defaults();progress=json.loads(state['kart-save'])
                target=progress['quickPlay'] if quick else progress;target['upgradesEnabled']=invalid
                state['kart-save']=json.dumps(progress)
                with self.assertRaises(profiles.ProfileError):profiles.validate(state)

    def test_glass_default_false_legacy_and_boolean_validation(self):
        state=profiles.defaults();prefs=json.loads(state['kart-settings'])
        self.assertIs(prefs['glass'],True)
        del prefs['glass'];state['kart-settings']=json.dumps(prefs)
        self.assertIs(json.loads(profiles.validate(state)['kart-settings'])['glass'],True)
        with self.db() as con:
            current=profiles.account(con,1);state=copy.deepcopy(current['state'])
            prefs=json.loads(state['kart-settings']);prefs['glass']=False
            state['kart-settings']=json.dumps(prefs)
            saved=profiles.save(con,1,{'revision':current['revision'],'state':state})
            con.commit()
            old=copy.deepcopy(saved['state']);settings=json.loads(old['kart-settings']);del settings['glass'];settings['master']=42;old['kart-settings']=json.dumps(settings)
            saved=profiles.save(con,1,{'revision':saved['revision'],'state':old})
            result=json.loads(saved['state']['kart-settings'])
            self.assertIs(result['glass'],False);self.assertEqual(result['master'],42)
            self.assertEqual(saved['id'],current['id'])
        for invalid in [0,1,None,'false',[],{}]:
            prefs['glass']=invalid;state['kart-settings']=json.dumps(prefs)
            with self.assertRaises(profiles.ProfileError):profiles.validate(state)

    def test_retired_progress_field_preserves_account_and_save(self):
        with self.db() as con:
            before=profiles.account(con,1)
            legacy=copy.deepcopy(before['state'])
            progress=json.loads(legacy['kart-save'])
            progress['tutorial']={'status':'active','step':17}
            legacy['kart-save']=json.dumps(progress)
            con.execute('UPDATE profiles SET state=? WHERE user_id=1',(json.dumps(legacy),))
            con.commit()
            loaded=profiles.account(con,1)
            self.assertEqual(loaded,before)
            saved=profiles.save(con,1,{'state':legacy,'revision':loaded['revision']})
            self.assertEqual(saved['id'],before['id'])
            self.assertEqual(json.loads(saved['state']['kart-save']),json.loads(before['state']['kart-save']))
            stored=json.loads(con.execute('SELECT state FROM profiles WHERE user_id=1').fetchone()[0])
            self.assertNotIn('tutorial',json.loads(stored['kart-save']))

    def test_upgrade_purchase_concurrent_and_legacy_save(self):
        import tuning
        with self.db() as con:before=profiles.account(con,1)
        barrier=threading.Barrier(2)
        def purchase():
            con=self.db()
            try:
                barrier.wait()
                with con:return tuning.buy(con,1,{'car':'kart','part':'engine','level':1,'revision':before['revision']})
            finally:con.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:purchase(),range(2)))
        self.assertEqual(results[0],results[1])
        state=copy.deepcopy(results[0]['state']);p=json.loads(state['kart-save']);self.assertEqual(p['coins'],5000-tuning.PRICES['kart']['engine'][0]);del p['upgrades'];state['kart-save']=json.dumps(p)
        with self.db() as con:
            result=profiles.save(con,1,{'state':state,'revision':results[0]['revision']})
            self.assertEqual(json.loads(result['state']['kart-save'])['upgrades'],{'kart':{'engine':1}})

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'test.sqlite3'
        with self.db() as c:
            c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE)')
            c.executemany('INSERT INTO users VALUES (?,?)',[(1,'FirstRacer'),(2,'SecondRacer')]);profiles.migrate(c)
            c.commit()
            state=profiles.defaults();s=json.loads(state['kart-save']);s['coins']=5000;state['kart-save']=json.dumps(s)
            profiles.save(c,1,{'revision':0,'state':state})
    def tearDown(self):self.tmp.cleanup()
    def test_experimental_shader_preference_and_old_clients(self):
        with self.db() as c:
            a=profiles.account(c,1);state=copy.deepcopy(a['state']);prefs=json.loads(state['kart-settings']);self.assertFalse(prefs['experimentalShaders'])
            prefs['experimentalShaders']=True;state['kart-settings']=json.dumps(prefs);a=profiles.save(c,1,{'revision':a['revision'],'state':state});c.commit()
            self.assertTrue(json.loads(profiles.account(c,1)['state']['kart-settings'])['experimentalShaders'])
            old=copy.deepcopy(a['state']);p=json.loads(old['kart-settings']);del p['experimentalShaders'];old['kart-settings']=json.dumps(p)
            a=profiles.save(c,1,{'revision':a['revision'],'state':old});c.commit();self.assertTrue(json.loads(a['state']['kart-settings'])['experimentalShaders'])
            p['quality']='low';old['kart-settings']=json.dumps(p);a=profiles.save(c,1,{'revision':a['revision'],'state':old});c.commit();self.assertFalse(json.loads(a['state']['kart-settings'])['experimentalShaders'])
            for value in (True,1,'yes'):
                bad=copy.deepcopy(a['state']);p=json.loads(bad['kart-settings']);p['experimentalShaders']=value;bad['kart-settings']=json.dumps(p)
                with self.assertRaises(profiles.ProfileError):profiles.save(c,1,{'revision':a['revision'],'state':bad})
                c.rollback()
            self.assertEqual(profiles.account(c,1)['revision'],a['revision'])
    def db(self):
        c=sqlite3.connect(self.path,timeout=10);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c
    def test_rename_identity_and_released_name(self):
        with self.db() as c:
            before=profiles.account(c,1);c.execute('CREATE TABLE friends(a TEXT REFERENCES users(player_id),b TEXT REFERENCES users(player_id))')
            c.execute('INSERT INTO friends VALUES (?,?)',(before['id'],profiles.account(c,2)['id']))
        with self.db() as c:after=profiles.rename(c,1,{'revision':before['revision'],'username':'NewRacer'})
        self.assertEqual(before['id'],after['id']);self.assertEqual(json.loads(after['state']['kart-save'])['coins'],3000)
        self.assertRegex(after['id'],r'^[A-Z0-9]{6}$')
        with self.db() as c:
            self.assertEqual(c.execute('SELECT a FROM friends').fetchone()[0],after['id'])
            self.assertIsNone(c.execute('SELECT user_id FROM names WHERE name=?',('firstracer',)).fetchone())
            self.assertEqual(profiles.rename(c,1,{'revision':before['revision'],'username':'NewRacer'})['revision'],after['revision'])
        with self.db() as c:
            with self.assertRaises(sqlite3.IntegrityError):c.execute('UPDATE users SET account_id=? WHERE id=1',('x'*32,))
        with self.db() as c:profiles.migrate(c);self.assertEqual(profiles.account(c,1)['id'],after['id'])

    def test_failure_does_not_charge(self):
        for name,code in [('SecondRacer','taken'),('f_u_c_k','blocked'),('x','username')]:
            with self.db() as c:
                before=profiles.account(c,1)
                with self.assertRaises(profiles.ProfileError) as e:profiles.rename(c,1,{'revision':before['revision'],'username':name})
                self.assertEqual(e.exception.code,code)
            with self.db() as c:self.assertEqual(profiles.account(c,1),before)
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError) as e:profiles.rename(c,2,{'revision':0,'username':'PoorRacer'})
            self.assertEqual(e.exception.code,'coins')

    def test_concurrent_charge_and_stale_save(self):
        with self.db() as c:before=profiles.account(c,1)
        barrier=threading.Barrier(2)
        def attempt(name):
            barrier.wait()
            try:
                with self.db() as c:return profiles.rename(c,1,{'revision':before['revision'],'username':name})
            except profiles.ProfileError as e:return e.code
        with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(attempt,['SpeedOne','SpeedTwo']))
        self.assertEqual(results.count('conflict'),1)
        with self.db() as c:
            current=profiles.account(c,1);self.assertEqual(json.loads(current['state']['kart-save'])['coins'],3000)
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError) as e:profiles.save(c,1,{'revision':before['revision'],'state':before['state']})
            self.assertEqual(e.exception.code,'conflict')
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError) as e:profiles.save(c,1,{'revision':current['revision'],'state':before['state']})
            self.assertEqual(e.exception.code,'invalid_balance')

    def test_gt3_preferences_and_separate_records(self):
        with self.db() as c:profiles.buy_car(c,1,{'revision':profiles.account(c,1)['revision'],'car':'amg'})
        with self.db() as c:
            before=profiles.account(c,1);state=copy.deepcopy(before['state'])
            progress=json.loads(state['kart-save'])
            progress.update(category='gt3',car='amg',track='shanghai',best={'monaco':100},bestGT3={'monaco':80,'nurburgring':130})
            state['kart-save']=json.dumps(progress)
            after=profiles.save(c,1,{'revision':before['revision'],'state':state})
        saved=json.loads(after['state']['kart-save'])
        self.assertEqual(saved['best']['monaco'],100)
        self.assertEqual(saved['bestGT3']['monaco'],80)
        self.assertEqual(saved['car'],'amg')
        progress['car']='unknown';state['kart-save']=json.dumps(progress)
        with self.assertRaises(profiles.ProfileError):profiles.validate(state)

    def test_legacy_save_upgrades_without_losing_progress(self):
        state=profiles.defaults();progress=json.loads(state['kart-save'])
        for key in ('category','car','bestGT3'):progress.pop(key)
        progress['best']={'monaco':123};progress['coins']=1234
        state['kart-save']=json.dumps(progress)
        upgraded=json.loads(profiles.validate(state)['kart-save'])
        self.assertEqual(upgraded['coins'],1234)
        self.assertEqual(upgraded['best'],{'monaco':123})
        self.assertEqual(upgraded['category'],'kart')
        self.assertEqual(upgraded['bestGT3'],{})
        state['kart-save']='[]'
        with self.assertRaises(profiles.ProfileError):profiles.validate(state)

    def test_settings_validation_and_progress(self):
        with self.db() as c:
            before=profiles.account(c,1);state=copy.deepcopy(before['state']);state['kart-language']='fr';state['kart-wheel']='2'
            updated=profiles.save(c,1,{'revision':before['revision'],'state':state})
        self.assertEqual(updated['state']['kart-language'],'fr')
        bad=copy.deepcopy(state);bad['id']='changed'
        with self.assertRaises(profiles.ProfileError):profiles.validate(bad)

    def test_car_purchase_idempotency_and_equipment(self):
        with self.db() as c:before=profiles.account(c,1)
        with self.db() as c:after=profiles.buy_car(c,1,{'revision':before['revision'],'car':'amg'})
        p=json.loads(after['state']['kart-save'])
        self.assertEqual(p['coins'],3500);self.assertEqual(p['car'],'porsche');self.assertIn('amg',p['ownedCars'])
        with self.db() as c:self.assertEqual(profiles.buy_car(c,1,{'revision':before['revision'],'car':'amg'}),after)
        p['car']='amg';p.update(botCount=6,botDifficulty='hard',botItems=True,botCars=['ferrari']*6)
        after['state']['kart-save']=json.dumps(p)
        with self.db() as c:saved=profiles.save(c,1,{'revision':after['revision'],'state':after['state']})
        self.assertEqual(json.loads(saved['state']['kart-save'])['botCars'],['ferrari']*6)
        p['ownedCars'].append('ferrari');after['state']['kart-save']=json.dumps(p)
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError):profiles.save(c,1,{'revision':saved['revision'],'state':after['state']})

    def test_invalid_bot_settings_and_unowned_equipment(self):
        for key,value in [('botCount',7),('botCount',True),('botDifficulty','expert'),('botItems',1),('botCars',['amg']),('car','ferrari')]:
            state=profiles.defaults();p=json.loads(state['kart-save']);p[key]=value;state['kart-save']=json.dumps(p)
            with self.assertRaises(profiles.ProfileError):profiles.validate(state)
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError) as e:profiles.buy_car(c,2,{'revision':0,'car':'ferrari'})
            self.assertEqual(e.exception.code,'coins')
        with self.db() as c:self.assertIsNone(profiles.account(c,2)['state'])

    def test_concurrent_car_purchase(self):
        with self.db() as c:before=profiles.account(c,1)
        barrier=threading.Barrier(2)
        def buy(_):
            barrier.wait()
            with self.db() as c:return profiles.buy_car(c,1,{'revision':before['revision'],'car':'ferrari'})
        with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(buy,range(2)))
        self.assertEqual(results[0],results[1]);self.assertEqual(json.loads(results[0]['state']['kart-save'])['coins'],2800)

    def test_legacy_owned_car_and_old_client_preservation(self):
        state=profiles.defaults();p=json.loads(state['kart-save']);p['car']='amg'
        for k in ('ownedCars','botCount','botDifficulty','botItems','botCars'):p.pop(k)
        state['kart-save']=json.dumps(p)
        with self.db() as c:c.execute('UPDATE profiles SET state=? WHERE user_id=1',(json.dumps(state),))
        with self.db() as c:
            current=profiles.account(c,1);self.assertEqual(json.loads(current['state']['kart-save'])['ownedCars'],['porsche','amg'])
            saved=profiles.save(c,1,{'revision':current['revision'],'state':state})
        self.assertEqual(json.loads(saved['state']['kart-save'])['car'],'amg')
        bad=copy.deepcopy(state);p=json.loads(bad['kart-settings']);p['master']=1000;bad['kart-settings']=json.dumps(p)
        with self.assertRaises(profiles.ProfileError):profiles.validate(bad)

    def test_profile_cosmetics_purchase_equip_and_protection(self):
        with self.db() as c:before=profiles.account(c,1)
        with self.db() as c:bg=profiles.buy_cosmetic(c,1,{'revision':before['revision'],'kind':'background','item':'teal'})
        with self.db() as c:self.assertEqual(profiles.buy_cosmetic(c,1,{'revision':0,'kind':'background','item':'teal'}),bg)
        with self.db() as c:icon=profiles.buy_cosmetic(c,1,{'revision':bg['revision'],'kind':'icon','item':'crown'})
        p=json.loads(icon['state']['kart-save']);self.assertEqual(p['coins'],4250)
        p.update(profileBackground='teal',profileIcon='crown');icon['state']['kart-save']=json.dumps(p)
        with self.db() as c:after=profiles.save(c,1,{'revision':icon['revision'],'state':icon['state']})
        self.assertEqual(json.loads(after['state']['kart-save'])['profileIcon'],'crown')
        p['ownedProfileIcons'].append('star');icon['state']['kart-save']=json.dumps(p)
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError):profiles.save(c,1,{'revision':after['revision'],'state':icon['state']})
        with self.db() as c:
            with self.assertRaises(profiles.ProfileError) as e:profiles.buy_cosmetic(c,2,{'revision':0,'kind':'icon','item':'crown'})
            self.assertEqual(e.exception.code,'coins')
        p=json.loads(after['state']['kart-save']);p['profileIcon']='star';after['state']['kart-save']=json.dumps(p)
        with self.assertRaises(profiles.ProfileError):profiles.validate(after['state'])

    def test_cosmetic_concurrency_and_legacy_client(self):
        with self.db() as c:before=profiles.account(c,1)
        barrier=threading.Barrier(2)
        def buy(_):
            barrier.wait()
            with self.db() as c:return profiles.buy_cosmetic(c,1,{'revision':before['revision'],'kind':'icon','item':'trophy'})
        with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(buy,range(2)))
        self.assertEqual(results[0],results[1]);current=results[0]
        p=json.loads(current['state']['kart-save']);self.assertEqual(p['coins'],4550)
        for k in ('profileBackground','profileIcon','ownedProfileBackgrounds','ownedProfileIcons'):p.pop(k)
        current['state']['kart-save']=json.dumps(p)
        with self.db() as c:after=profiles.save(c,1,{'revision':current['revision'],'state':current['state']})
        self.assertIn('trophy',json.loads(after['state']['kart-save'])['ownedProfileIcons'])

if __name__=='__main__':unittest.main(verbosity=2)
