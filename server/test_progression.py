import copy
import json
import sqlite3
import unittest
import profiles
import progression
import rankings

class Progression(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row;self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)');self.c.execute("INSERT INTO users VALUES(1,'ProgressRacer')");profiles.migrate(self.c);self.c.commit()
        with self.c:self.a=profiles.save(self.c,1,{'revision':0,'state':profiles.defaults()})
    def tearDown(self):self.c.close()
    def save(self,changes):
        state=copy.deepcopy(self.a['state']);s=json.loads(state['kart-save']);s.update(changes);state['kart-save']=json.dumps(s)
        with self.c:self.a=profiles.save(self.c,1,{'revision':self.a['revision'],'state':state})
        return json.loads(self.a['state']['kart-save'])
    def test_extended_catalog_and_translations(self):
        self.assertEqual(len(progression.MISSIONS),40);self.assertEqual(max(map(int,progression.LEVEL_REWARDS)),100)
        for mission in progression.MISSIONS.values():self.assertEqual(len(mission['title']),3)
    def test_level_reward_gate_and_no_double_payment(self):
        reward=progression.LEVEL_REWARDS['100']
        with self.assertRaises(profiles.ProfileError):self.save({'pass':{'100':1},'coins':reward})
        s=self.save({'xp':24750,'pass':{'100':1},'coins':reward});self.assertEqual(s['coins'],reward)
        with self.assertRaises(profiles.ProfileError):self.save({'coins':reward*2})
    def test_long_mission_gate_and_reward(self):
        key=next(k for k,m in progression.MISSIONS.items() if m['stat']=='races' and m['goal']==1000);reward=progression.REWARDS[key]
        with self.assertRaises(profiles.ProfileError):self.save({'claimed':{key:1},'coins':reward})
        s=self.save({'races':1000,'claimed':{key:1},'coins':reward});self.assertEqual(s['coins'],reward)
    def test_new_tracks_and_mode_car_rankings(self):
        for track in ['switchback','hairpin']:
            self.assertIn(track,profiles.TRACKS)
            self.save({'records':{'competitive:kart:'+track:60},'quickPlay':{**json.loads(self.a['state']['kart-save'])['quickPlay'],'track':track}})
            self.assertEqual(rankings.board(self.c,1,track,'kart','competitive','kart')['entries'][0]['milliseconds'],60000)
            self.assertEqual(rankings.board(self.c,1,track,'kart','luckyblock','kart')['entries'],[])

if __name__=='__main__':unittest.main()
