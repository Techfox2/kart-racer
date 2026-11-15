import copy
import concurrent.futures
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
import profiles
import rankings

class RankingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'records.sqlite3';self.c=self.db()
        self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE)')
        self.c.executemany('INSERT INTO users VALUES (?,?)',[(i,'Racer'+str(i)) for i in range(1,106)]);profiles.migrate(self.c);self.c.commit()
    def tearDown(self):self.c.close();self.tmp.cleanup()
    def db(self):
        c=sqlite3.connect(self.path,timeout=10);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c
    def record(self,uid,seconds,mode='luckyblock',car='kart',track='circuit'):
        return rankings.record(self.c,uid,{'kart-save':json.dumps({'records':{mode+':'+car+':'+track:seconds}})},rewards=True)
    def board(self,uid=1,mode='luckyblock',car='kart',track='circuit'):
        return rankings.board(self.c,uid,track,'kart' if car=='kart' or car.startswith('kart-') else 'gt3',mode,car)
    def test_top100_and_own_rank(self):
        for i in range(1,106):self.record(i,60+i)
        r=self.board(105);self.assertEqual(len(r['entries']),100);self.assertEqual(r['mine'],{'rank':105,'milliseconds':165000});self.assertEqual(r['entries'][0]['username'],'Racer1')
    def test_track_mode_and_model_are_independent(self):
        for mode in rankings.MODES:
            for car in rankings.CARS:
                self.assertEqual(self.record(1,70,mode,car),0)
                self.assertEqual(self.record(2,69.5,mode,car),100)
                self.assertEqual(self.board(2,mode,car)['mine']['milliseconds'],69500)
        self.assertEqual(self.record(2,10,'competitive','ferrari','monaco'),0)
        self.assertEqual(self.board(2,'competitive','ferrari')['mine']['milliseconds'],69500)
        with self.assertRaises(ValueError):rankings.board(self.c,1,'circuit','kart','competitive','porsche')
    def test_rewards_boundaries_first_tie_repeat_and_personal_only(self):
        for delta,expected in [(.001,100),(.9,100),(1,100),(1.001,200),(2,200),(2.001,300),(3,300),(3.001,400),(4,400),(20,400)]:
            self.c.execute('DELETE FROM lap_records')
            self.assertEqual(self.record(1,100),0)
            self.assertEqual(self.record(2,100-delta),expected)
            self.assertEqual(self.record(2,100-delta),0)
            self.assertEqual(self.record(3,100-delta),0)
        self.c.execute('DELETE FROM lap_records');self.record(1,50);self.record(2,70);self.assertEqual(self.record(2,60),0)
    def test_identity_ties_and_legacy_migration(self):
        for i in (1,2):self.record(i,60)
        r=self.board();self.assertEqual([e['id'] for e in r['entries']],sorted(e['id'] for e in r['entries']))
        pid=r['entries'][0]['id'];self.c.execute('UPDATE users SET username=? WHERE player_id=?',('Renamed',pid));self.assertEqual(self.board()['entries'][0]['username'],'Renamed')
        self.c.execute('DROP TABLE lap_records');self.c.execute('CREATE TABLE lap_records(user_id INTEGER,category TEXT,track TEXT,milliseconds INTEGER,PRIMARY KEY(user_id,category,track))');self.c.execute("INSERT INTO lap_records VALUES (1,'gt3','monaco',82000)")
        rankings.migrate(self.c);rankings.migrate(self.c)
        self.assertEqual(self.c.execute("SELECT milliseconds FROM lap_records WHERE mode='legacy'").fetchone()[0],82000)
        self.assertIsNone(self.board(1,'competitive','ferrari','monaco')['mine'])
        with self.assertRaises(ValueError):rankings.board(self.c,1,'monaco','gt3','legacy','legacy')
    def test_reset_clears_all_times_preserves_progress_and_blocks_old_writes(self):
        state=profiles.defaults();p=json.loads(state['kart-save']);p.update(best={'circuit':80},bestGT3={'monaco':90},records={'competitive:kart:circuit':75});state['kart-save']=json.dumps(p)
        self.c.commit()
        with self.c:before=profiles.save(self.c,1,dict(revision=0,state=state,requestId='c'*32))
        self.c.execute("INSERT INTO lap_records VALUES (1,'gt3','legacy','legacy','monaco',90000)");self.c.commit()
        with self.c:
            self.c.execute('BEGIN IMMEDIATE');self.assertTrue(rankings.reset_all(self.c,'test-reset'))
        after=profiles.account(self.c,1);saved=json.loads(after['state']['kart-save'])
        for key in ('best','bestGT3','records'):self.assertEqual(saved.pop(key),{})
        expected=json.loads(before['state']['kart-save'])
        for key in ('best','bestGT3','records'):expected.pop(key)
        self.assertEqual(saved,expected);self.assertEqual(after['revision'],before['revision']+1)
        self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],0)
        self.assertEqual(self.c.execute('SELECT count(*) FROM profile_requests').fetchone()[0],0)
        with self.assertRaises(profiles.ProfileError):
            with self.c:profiles.save(self.c,1,dict(revision=before['revision'],state=before['state']))
        rankings.migrate(self.c);self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],0)
        self.assertEqual(self.record(1,90),0)
        self.assertFalse(rankings.reset_all(self.c,'test-reset'));self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],1)
    def test_atomic_coin_credit_and_idempotent_retry(self):
        self.record(2,100);self.c.commit();state=profiles.defaults();p=json.loads(state['kart-save']);p['records']={'competitive:porsche:circuit':50,'luckyblock:kart:circuit':98};state['kart-save']=json.dumps(p)
        request=dict(revision=0,state=state,requestId='a'*32)
        with self.c:first=profiles.save(self.c,1,request)
        self.assertEqual(first['recordReward'],200);self.assertEqual(json.loads(first['state']['kart-save'])['coins'],200)
        with self.c:again=profiles.save(self.c,1,request)
        self.assertEqual(first,again);self.assertEqual(profiles.account(self.c,1)['revision'],1)
        with self.c:next_save=profiles.save(self.c,1,dict(revision=1,state=first['state'],requestId='b'*32))
        self.assertNotIn('recordReward',next_save);self.assertEqual(json.loads(next_save['state']['kart-save'])['coins'],200)
        with self.assertRaises(profiles.ProfileError):
            with self.c:profiles.save(self.c,1,request)
    def test_concurrent_same_record_is_paid_once(self):
        self.record(3,100);self.c.commit();barrier=threading.Barrier(2)
        def save(uid):
            state=profiles.defaults();p=json.loads(state['kart-save']);p['records']={'luckyblock:kart:circuit':99};state['kart-save']=json.dumps(p);barrier.wait()
            with self.db() as c:return profiles.save(c,uid,dict(revision=0,state=state)).get('recordReward',0)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:values=list(pool.map(save,[1,2]))
        self.assertEqual(sorted(values),[0,100])
    def test_invalid_category_and_unowned_model_do_not_credit(self):
        for records in [{'bad:kart:circuit':50},{'luckyblock:amg:circuit':50},{'competitive:kart:circuit':True}]:
            state=profiles.defaults();p=json.loads(state['kart-save']);p['records']=records;state['kart-save']=json.dumps(p)
            with self.assertRaises(profiles.ProfileError):
                with self.c:profiles.save(self.c,1,dict(revision=0,state=state))
            self.assertEqual(profiles.account(self.c,1)['revision'],0)

if __name__=='__main__':unittest.main()
