import concurrent.futures
import copy
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import profiles
import rankings

class Customization(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'test.sqlite3'
        with self.db() as c:
            c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)');c.executemany('INSERT INTO users VALUES(?,?)',[(1,'DesignRacer'),(2,'NewRacer')]);profiles.migrate(c);c.commit()
            for uid in [1,2]:
                state=profiles.defaults();s=json.loads(state['kart-save']);s.update(coins=50000 if uid==1 else 100,xp=8000 if uid==1 else 0);state['kart-save']=json.dumps(s);profiles.save(c,uid,{'revision':0,'state':state});c.commit()
    def db(self):
        c=sqlite3.connect(self.path,timeout=10);c.row_factory=sqlite3.Row;return c
    def tearDown(self):self.tmp.cleanup()
    def buy(self,kind,item,uid=1,revision=None):
        with self.db() as c:
            a=profiles.account(c,uid);return profiles.buy_cosmetic(c,uid,{'kind':kind,'item':item,'revision':a['revision'] if revision is None else revision})
    def test_level_balance_and_item_validation(self):
        with self.assertRaises(profiles.ProfileError) as e:self.buy('ambient','ocean',2)
        self.assertEqual(e.exception.code,'level')
        with self.assertRaises(profiles.ProfileError) as e:self.buy('kart','apex',2)
        self.assertEqual(e.exception.code,'coins')
        with self.assertRaises(profiles.ProfileError):self.buy('ambient','missing')
        with self.db() as c:self.assertEqual(json.loads(profiles.account(c,2)['state']['kart-save'])['coins'],100)
    def test_atomic_purchase_and_free_equip(self):
        with self.db() as c:revision=profiles.account(c,1)['revision']
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda _:self.buy('kart','apex',revision=revision),range(2)))
        a=self.buy('ambient','ocean');s=json.loads(a['state']['kart-save']);self.assertEqual(s['coins'],45500);s.update(kartModel='apex',ambient='ocean');state={**a['state'],'kart-save':json.dumps(s)}
        with self.db() as c:b=profiles.save(c,1,{'revision':a['revision'],'state':state})
        self.assertEqual(json.loads(b['state']['kart-save'])['coins'],45500)
        b=self.buy('ambient','ocean',revision=0);self.assertEqual(json.loads(b['state']['kart-save'])['coins'],45500)
    def test_ownership_and_legacy_preservation(self):
        self.buy('kart','rally');a=self.buy('ambient','forest');s=json.loads(a['state']['kart-save']);s.update(kartModel='rally',ambient='forest');state={**a['state'],'kart-save':json.dumps(s)}
        with self.db() as c:a=profiles.save(c,1,{'revision':a['revision'],'state':state})
        legacy=copy.deepcopy(a['state']);p=json.loads(legacy['kart-save'])
        for k in ['kartModel','ownedKarts','ambient','ownedAmbient']:del p[k]
        legacy['kart-save']=json.dumps(p)
        with self.db() as c:b=profiles.save(c,1,{'revision':a['revision'],'state':legacy})
        self.assertEqual(json.loads(b['state']['kart-save']),s)
        for k,value in [('ownedKarts',['original','rally','vector']),('ambient','midnight')]:
            forged={**b['state'],'kart-save':json.dumps({**s,k:value})}
            with self.assertRaises(profiles.ProfileError),self.db() as c:profiles.save(c,1,{'revision':b['revision'],'state':forged})
    def test_rankings_separate_models_and_ownership(self):
        a=self.buy('kart','apex');s=json.loads(a['state']['kart-save']);s['records']={'competitive:kart-apex:circuit':60}
        with self.db() as c:
            b=profiles.save(c,1,{'revision':a['revision'],'state':{**a['state'],'kart-save':json.dumps(s)}})
            self.assertEqual(rankings.board(c,1,'circuit','kart','competitive','kart-apex')['entries'][0]['milliseconds'],60000)
            self.assertEqual(rankings.board(c,1,'circuit','kart','competitive','kart')['entries'],[])
            self.assertNotIn('recordReward',b)
        s['records']['competitive:kart-vector:circuit']=40
        with self.assertRaises(profiles.ProfileError),self.db() as c:profiles.save(c,1,{'revision':b['revision'],'state':{**b['state'],'kart-save':json.dumps(s)}})
        with self.db() as c:
            self.assertEqual(rankings.record(c,2,{'kart-save':json.dumps({'records':{'competitive:kart-rally:circuit':50}})},True),0)
            self.assertEqual(rankings.record(c,2,{'kart-save':json.dumps({'records':{'competitive:kart-apex:circuit':59.5}})},True),100)

if __name__=='__main__':unittest.main()
