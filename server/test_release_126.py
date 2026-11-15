import copy
import datetime
import json
import sqlite3
import unittest
from unittest.mock import patch
import profiles,rankings,admin,customizer_refund
from rooms import Broker,RoomError

class Release126(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON')
        self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)')
        self.c.executemany('INSERT INTO users VALUES (?,?)',[(1,'MrBucks'),(2,'Racer'),(3,'Gifted')]);profiles.migrate(self.c);self.c.commit();admin.migrate(self.c);self.c.commit()
    def tearDown(self):self.c.close()
    def put(self,uid,seconds):return rankings.record(self.c,uid,{'kart-save':json.dumps({'records':{'competitive:kart:spa':seconds}})},True)
    def test_self_record_no_bonus_and_invalid_lap(self):
        self.assertEqual(self.put(1,100),0);self.assertEqual(self.put(1,99),0)
        self.assertEqual(self.put(2,98),100);self.assertEqual(self.put(2,97),0);self.assertEqual(self.put(1,96),100)
        self.assertEqual(self.put(3,13),0);self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],2)
        for track in rankings.TRACKS:
            for car in rankings.CARS:
                for mode in rankings.MODES:
                    minimum=rankings.minimum(track,mode,car);self.assertFalse(rankings.plausible(f'{mode}:{car}:{track}',minimum-.001));self.assertTrue(rankings.plausible(f'{mode}:{car}:{track}',minimum+.001))
    def test_season_boundary_and_manual_reset_preserve_all_time(self):
        self.c.execute("UPDATE ranking_season SET december=2025,generation=1")
        november=datetime.datetime(2026,11,30,23,59,tzinfo=datetime.timezone.utc);december=datetime.datetime(2026,12,1,tzinfo=datetime.timezone.utc);next_year=datetime.datetime(2027,12,1,tzinfo=datetime.timezone.utc)
        with patch('rankings.datetime.datetime') as clock:
            clock.now.return_value=november;self.put(1,100);season=rankings.season(self.c)
            rankings.seasonal_record(self.c,1,[dict(key='competitive:kart:spa',seconds=110,season=season['id'])]);self.assertEqual(self.c.execute('SELECT milliseconds FROM seasonal_records').fetchone()[0],110000)
            clock.now.return_value=december;new=rankings.season(self.c);self.assertEqual(new['id'],season['id']+1);self.assertEqual(self.c.execute('SELECT count(*) FROM seasonal_records').fetchone()[0],0)
            self.assertEqual(rankings.season(self.c),new);self.assertEqual(self.c.execute('SELECT milliseconds FROM lap_records').fetchone()[0],100000)
            rankings.seasonal_record(self.c,1,[dict(key='competitive:kart:spa',seconds=99,season=season['id'])]);self.assertEqual(self.c.execute('SELECT count(*) FROM seasonal_records').fetchone()[0],0)
            rankings.seasonal_record(self.c,1,[dict(key='competitive:kart:spa',seconds=115,season=new['id'])]);self.c.commit()
            clock.now.return_value=next_year;self.assertEqual(rankings.season(self.c),new);self.assertEqual(self.c.execute('SELECT count(*) FROM seasonal_records').fetchone()[0],1)
            with self.c:admin.action(self.c,1,'reset-season',dict(season=new['id']),Broker())
            self.assertEqual(self.c.execute('SELECT count(*) FROM seasonal_records').fetchone()[0],0);self.assertEqual(self.c.execute('SELECT count(*) FROM lap_records').fetchone()[0],1)
    def test_attempt_validation_and_rear_preference_old_client(self):
        with self.c:a=profiles.save(self.c,2,dict(revision=0,state=profiles.defaults()))
        p=json.loads(a['state']['kart-settings']);p['rearIndicator']=False;a['state']['kart-settings']=json.dumps(p)
        with self.c:a=profiles.save(self.c,2,dict(revision=a['revision'],state=a['state']))
        old=copy.deepcopy(a['state']);p=json.loads(old['kart-settings']);del p['rearIndicator'];old['kart-settings']=json.dumps(p)
        with self.c:a=profiles.save(self.c,2,dict(revision=a['revision'],state=old))
        self.assertFalse(json.loads(a['state']['kart-settings'])['rearIndicator'])
        before=profiles.account(self.c,2)
        with self.c:profiles.save(self.c,2,dict(revision=a['revision'],state=a['state'],raceRecords=[dict(key='competitive:kart:spa',seconds=13,season=rankings.season(self.c)['id'])]))
        self.assertEqual(self.c.execute("SELECT status FROM record_reviews WHERE user_id=2").fetchone()[0],'pending')
    def test_refund_once_and_admin_grant_not_paid(self):
        for uid in [2,3]:
            state=profiles.defaults();p=json.loads(state['kart-save']);p.update(coins=10000,ownedTools=['customizer'],paintMode='custom');state['kart-save']=json.dumps(p)
            self.c.execute('UPDATE profiles SET state=? WHERE user_id=?',(json.dumps(state),uid))
        pid=self.c.execute('SELECT player_id FROM users WHERE id=3').fetchone()[0]
        admin.event(self.c,1,'inventory-save',pid,dict(before={'ownedTools':[]},after={'ownedTools':['customizer']}));self.c.commit()
        with self.c:self.assertEqual(customizer_refund.migrate(self.c),2)
        for uid,coins in [(2,12500),(3,10000)]:
            a=profiles.account(self.c,uid);p=json.loads(a['state']['kart-save']);self.assertEqual(p['coins'],coins);self.assertEqual(p['ownedTools'],[]);self.assertEqual(p['paintMode'],'preset');self.assertEqual(a['revision'],1)
        with self.c:self.assertEqual(customizer_refund.migrate(self.c),0)
        self.assertEqual(profiles.TOOL_PRICES['customizer'],15000)
    def test_admin_watch_full_running_lobby(self):
        b=Broker();host=b.call('create',1,{});code=host['code']
        for uid in range(2,8):b.call('join',uid,dict(code=code))
        b.call('lock',1,dict(code=code,peer=host['peer'],locked=True))
        with self.assertRaises(RoomError):b.call('watch',20,dict(code=code))
        watcher=b.call('watch',20,dict(code=code),admin=True);self.assertTrue(watcher['observer'])
        peers=b.call('poll',1,dict(code=code,peer=host['peer']));self.assertIn(watcher['peer'],peers['observers']);self.assertEqual(len(peers['peers']),8)
        with self.assertRaises(RoomError):b.call('lock',20,dict(code=code,peer=watcher['peer'],locked=False))
        b.call('leave',20,dict(code=code,peer=watcher['peer']));self.assertEqual(len(b.rooms[code]['members']),7)

if __name__=='__main__':unittest.main()
