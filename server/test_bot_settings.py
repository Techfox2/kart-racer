import copy
import json
import sqlite3
import unittest
import profiles

class BotSettings(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row
        self.c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)');self.c.execute("INSERT INTO users VALUES(1,'BotRacer')");profiles.migrate(self.c);self.c.commit()
    def tearDown(self):self.c.close()
    def test_old_difficulty_and_preferences_survive_old_client(self):
        state=profiles.defaults();p=json.loads(state['kart-save']);new=['botDifficulties','mpBotCount','mpBotItems','mpBotCars','mpBotDifficulties']
        for key in new:del p[key]
        p['botDifficulty']='hard';state['kart-save']=json.dumps(p)
        with self.c:a=profiles.save(self.c,1,{'revision':0,'state':state})
        self.assertEqual(json.loads(a['state']['kart-save'])['botDifficulties'],['hard']*6)
        state=copy.deepcopy(a['state']);p=json.loads(state['kart-save']);p.update(botDifficulties=['easy','hard','normal']*2,mpBotCount=5,mpBotItems=True,mpBotCars=['ferrari']*6,mpBotDifficulties=['hard']*6);state['kart-save']=json.dumps(p)
        with self.c:a=profiles.save(self.c,1,{'revision':a['revision'],'state':state})
        legacy=copy.deepcopy(a['state']);p=json.loads(legacy['kart-save'])
        for key in new:del p[key]
        legacy['kart-save']=json.dumps(p)
        with self.c:b=profiles.save(self.c,1,{'revision':a['revision'],'state':legacy})
        self.assertEqual(b['state'],a['state']);self.assertEqual(b['id'],a['id'])
    def test_invalid_bot_configuration_rejected(self):
        for change in [{'botDifficulties':['hard']*5},{'botDifficulties':['bad']*6},{'mpBotCount':7},{'mpBotCount':True},{'mpBotCars':['bad']*6},{'mpBotItems':1},{'mpBotDifficulties':['easy']*7}]:
            state=profiles.defaults();p=json.loads(state['kart-save']);p.update(change);state['kart-save']=json.dumps(p)
            with self.assertRaises(profiles.ProfileError):profiles.validate(state)

    def test_quick_settings_independent_and_preserved(self):
        state=profiles.defaults();p=json.loads(state['kart-save']);p['quickPlay'].update(track='monza',laps=5,useDaily=True,botCount=6)
        p['quickPlay']['botDifficulties'][2]='hard';state['kart-save']=json.dumps(p)
        with self.c:a=profiles.save(self.c,1,{'revision':0,'state':state})
        saved=json.loads(a['state']['kart-save']);self.assertEqual(saved['track'],'circuit');self.assertEqual(saved['quickPlay'],p['quickPlay'])
        legacy=copy.deepcopy(a['state']);s=json.loads(legacy['kart-save']);del s['quickPlay'];legacy['kart-save']=json.dumps(s)
        with self.c:b=profiles.save(self.c,1,{'revision':a['revision'],'state':legacy})
        self.assertEqual(json.loads(b['state']['kart-save'])['quickPlay'],p['quickPlay'])

    def test_quick_invalid_values(self):
        for change in [{'useDaily':1},{'track':'unknown'},{'laps':True},{'botCount':7},{'botDifficulties':['hard']*5},{'botCars':['wrong']*6}]:
            state=profiles.defaults();p=json.loads(state['kart-save']);p['quickPlay'].update(change);state['kart-save']=json.dumps(p)
            with self.assertRaises(profiles.ProfileError):profiles.validate(state)

if __name__=='__main__':unittest.main()
