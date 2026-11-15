import copy
import datetime
import json
import sqlite3
import unittest
from unittest.mock import patch
import profiles

class Season(unittest.TestCase):
    def test_calendar(self):
        real=datetime.datetime
        for date,active in [('2026-11-30T23:59:59',False),('2026-12-01T00:00:00',True),('2026-12-31T23:59:59',True),('2027-01-01T00:00:00',False)]:
            with patch.object(profiles.datetime,'datetime') as clock:
                clock.now.return_value=real.fromisoformat(date)
                self.assertEqual(profiles.christmas_active(),active)
    def test_seasonal_selection_and_old_client(self):
        c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row;c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE)');c.execute("INSERT INTO users VALUES(1,'SeasonRacer')");profiles.migrate(c);c.commit()
        with c:a=profiles.save(c,1,{'revision':0,'state':profiles.defaults()})
        state=copy.deepcopy(a['state']);s=json.loads(state['kart-save']);s['kartSkin']='christmas';state['kart-save']=json.dumps(s)
        with patch('profiles.christmas_active',return_value=False):
            with self.assertRaises(profiles.ProfileError),c:profiles.save(c,1,{'revision':a['revision'],'state':state})
        with patch('profiles.christmas_active',return_value=True),c:a=profiles.save(c,1,{'revision':a['revision'],'state':state})
        legacy=copy.deepcopy(a['state']);s=json.loads(legacy['kart-save']);del s['kartSkin'];legacy['kart-save']=json.dumps(s)
        with patch('profiles.christmas_active',return_value=False),c:b=profiles.save(c,1,{'revision':a['revision'],'state':legacy})
        self.assertEqual(json.loads(b['state']['kart-save'])['kartSkin'],'christmas');c.close()

if __name__=='__main__':unittest.main()
