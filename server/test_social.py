import json
import re
import sqlite3
import tempfile
import unittest
from pathlib import Path
import profiles
import social

class Social(unittest.TestCase):
    def test_release_version_matches_seen_marker(self):
        root=Path(__file__).resolve().parent.parent
        current=json.loads((root/'release-notes.json').read_text(encoding='utf-8'))['current']
        self.assertEqual(social.CURRENT_VERSION,current)
        self.assertEqual(re.search(r"VERSION='([^']+)'",(root/'updates.js').read_text(encoding='utf-8')).group(1),current)
        self.act(1,'seen',version=current)
        self.assertEqual(self.overview(1)['seen'],current)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'social.sqlite3'
        with self.db() as c:
            c.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,account_id TEXT)')
            c.executemany('INSERT INTO users VALUES (?,?,?)',[(1,'Alpha','a'*32),(2,'Bravo','b'*32),(3,'Charlie','c'*32)])
            c.execute('CREATE TABLE attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER)')
            profiles.migrate(c);social.migrate(c)
            self.ids={r['id']:r['player_id'] for r in c.execute('SELECT * FROM users')}
        social.broker.rooms.clear()
    def tearDown(self):self.tmp.cleanup()
    def db(self):
        c=sqlite3.connect(self.path);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c
    def act(self,uid,verb,**data):
        with self.db() as c:return social.action(c,uid,verb,data)
    def overview(self,uid):
        with self.db() as c:return social.overview(c,uid)
    def error(self,expected,uid,verb,**data):
        with self.assertRaises(profiles.ProfileError) as e:self.act(uid,verb,**data)
        self.assertEqual(e.exception.code,expected)
    def friend(self):
        self.act(1,'request',kind='name',target='bravo')
        self.act(2,'accept',target=self.ids[1])
    def test_identity_migration(self):
        self.assertEqual(len(set(self.ids.values())),3)
        with self.db() as c:
            for ident in self.ids.values():self.assertRegex(ident,'^[A-Z0-9]{6}$')
            profiles.migrate(c)
            self.assertEqual(profiles.account(c,1)['id'],self.ids[1])
            self.assertEqual(c.execute('SELECT account_id FROM users WHERE id=1').fetchone()[0],'a'*32)
            with self.assertRaises(sqlite3.IntegrityError):c.execute("UPDATE users SET player_id='ABC123' WHERE id=1")
    def test_requests_and_consent(self):
        self.act(1,'request',kind='id',target=self.ids[2].lower())
        self.act(1,'request',kind='name',target='BRAVO')
        self.assertEqual(len(self.overview(2)['incoming']),1)
        self.error('forbidden',1,'accept',target=self.ids[2])
        self.error('not_friends',1,'invite',target=self.ids[2],mode='local',code='123456')
        self.act(2,'accept',target=self.ids[1])
        self.assertEqual(self.overview(1)['friends'][0]['id'],self.ids[2])
        self.error('self',1,'request',target=self.ids[1])
        self.act(1,'remove',target=self.ids[2]);self.assertEqual(self.overview(2)['friends'],[])
        self.act(1,'request',target=self.ids[2]);self.act(2,'decline',target=self.ids[1])
        self.act(1,'request',target=self.ids[2]);self.act(1,'cancel',target=self.ids[2])
        self.assertEqual(self.overview(2)['incoming'],[])
    def test_friendship_survives_rename(self):
        self.friend()
        with self.db() as c:
            state=profiles.defaults();s=json.loads(state['kart-save']);s['coins']=5000;state['kart-save']=json.dumps(s)
            profiles.save(c,1,{'revision':0,'state':state})
        with self.db() as c:profiles.rename(c,1,{'revision':1,'username':'NewAlpha'})
        friend=self.overview(2)['friends'][0]
        self.assertEqual((friend['id'],friend['username']),(self.ids[1],'NewAlpha'))
        with self.db() as c:c.execute("UPDATE users SET username='Alpha' WHERE id=3")
        self.assertEqual(self.overview(3)['friends'],[])
    def test_invite_permissions_expiry_and_web(self):
        self.friend();self.act(1,'invite',target=self.ids[2],mode='local',code='123456')
        inv=self.overview(2)['invites'][0]['id']
        self.error('invite_missing',3,'open-invite',invite=inv)
        self.assertEqual(self.act(2,'open-invite',invite=inv)['code'],'123456')
        self.act(2,'dismiss-invite',invite=inv);self.assertEqual(self.overview(2)['invites'],[])
        self.error('invalid',1,'invite',target=self.ids[2],mode='local',code='ABC123')
        room=social.broker.call('create',1,{})
        self.error('room_missing',2,'invite',target=self.ids[1],mode='web',code=room['code'],peer=room['peer'])
        self.act(1,'invite',target=self.ids[2],mode='web',code=room['code'],peer=room['peer'])
        inv=self.overview(2)['invites'][0]['id'];self.assertEqual(self.act(2,'open-invite',invite=inv)['mode'],'web')
        social.broker.call('lock',1,dict(room,locked=True));self.error('race_started',2,'open-invite',invite=inv)
        self.assertEqual(self.overview(2)['invites'],[])
        self.act(1,'invite',target=self.ids[2],mode='local',code='654321')
        with self.db() as c:c.execute('UPDATE invitations SET expires=0')
        self.assertEqual(self.overview(2)['invites'],[])
    def test_guest_invitation_policy(self):
        self.act(2,'request',target=self.ids[3]);self.act(3,'accept',target=self.ids[2])
        room=social.broker.call('create',1,{})
        guest=social.broker.call('join',2,{'code':room['code']})
        payload=dict(target=self.ids[3],mode='web',code=room['code'],peer=guest['peer'])
        self.error('invites_disabled',2,'invite',**payload)
        from rooms import RoomError
        with self.assertRaises(RoomError):social.broker.call('invite-policy',2,dict(guest,allowed=True))
        social.broker.call('invite-policy',1,dict(room,allowed=True));self.act(2,'invite',**payload)
        inv=self.overview(3)['invites'][0]['id'];self.assertEqual(self.act(3,'open-invite',invite=inv)['code'],room['code'])
        social.broker.call('invite-policy',1,dict(room,allowed=False))
        self.error('invites_disabled',3,'open-invite',invite=inv);self.assertEqual(self.overview(3)['invites'],[])

    def test_seen_and_failed_lookup_limit(self):
        self.act(1,'seen',version=social.CURRENT_VERSION)
        self.assertEqual(self.overview(1)['seen'],social.CURRENT_VERSION)
        self.assertIsNone(self.overview(2)['seen'])
        for _ in range(60):self.error('player_missing',1,'request',kind='name',target='Nobody')
        self.error('rate',1,'request',target=self.ids[2])

    def test_search_by_name_id_and_private_defaults(self):
        for query in ('bra','BRAVO',self.ids[2].lower()):
            found=self.act(1,'search',query=query)['players']
            self.assertEqual(found[0]['id'],self.ids[2])
            self.assertFalse(set(found[0]) & {'coins','friends','online','track','state'})
        self.assertEqual(self.act(1,'search',query='Missing')['players'],[])
        self.error('username',1,'search',query="%' OR 1=1")

    def test_privacy_each_field_and_friendship(self):
        self.friend();self.act(2,'heartbeat',tab='b'*32,track='monaco')
        friend=self.act(1,'profile',target=self.ids[2]);self.assertTrue(friend['online']);self.assertEqual(friend['track'],'monaco')
        self.assertNotIn('coins',friend);self.assertNotIn('friends',friend)
        for key in social.PRIVACY_DEFAULTS:
            settings={k:'private' for k in social.PRIVACY_DEFAULTS};settings[key]='everyone'
            self.act(2,'privacy',settings=settings)
            stranger=self.act(3,'profile',target=self.ids[2])
            self.assertIn(key,stranger)
            for other in set(settings)-{key}:self.assertNotIn(other,stranger)
            settings[key]='friends';self.act(2,'privacy',settings=settings)
            self.assertIn(key,self.act(1,'profile',target=self.ids[2]))
            self.assertNotIn(key,self.act(3,'profile',target=self.ids[2]))
        self.act(1,'remove',target=self.ids[2])
        self.assertNotIn('friends',self.act(1,'profile',target=self.ids[2]))

    def test_activity_expiration_multiple_tabs_and_stop(self):
        self.act(2,'privacy',settings={k:'everyone' for k in social.PRIVACY_DEFAULTS})
        self.act(2,'heartbeat',tab='a'*32,track='spa');self.act(2,'heartbeat',tab='b'*32,track=None)
        self.assertEqual(self.act(1,'profile',target=self.ids[2])['track'],'spa')
        self.act(2,'heartbeat',tab='a'*32,track=None)
        self.assertIsNone(self.act(1,'profile',target=self.ids[2])['track'])
        with self.db() as c:c.execute('UPDATE activity SET seen=0')
        result=self.act(1,'profile',target=self.ids[2]);self.assertFalse(result['online']);self.assertIsNone(result['track'])
        self.error('invalid',2,'heartbeat',tab='a'*32,track='private-path')
        self.error('invalid',2,'heartbeat',tab='bad',track=None)

    def test_privacy_persistence_and_no_third_party_overwrite(self):
        chosen={k:'private' for k in social.PRIVACY_DEFAULTS}
        self.act(2,'privacy',settings=chosen,target=self.ids[1])
        self.assertEqual(self.act(2,'privacy')['settings'],chosen)
        self.assertEqual(self.act(1,'privacy')['settings'],social.PRIVACY_DEFAULTS)
        self.error('invalid',2,'privacy',settings={'coins':'everyone'})
        self.error('invalid',2,'privacy',settings={**chosen,'coins':'anything'})
        with self.db() as c:social.migrate(c)
        self.assertEqual(self.act(2,'privacy')['settings'],chosen)

if __name__=='__main__':unittest.main(verbosity=2)
