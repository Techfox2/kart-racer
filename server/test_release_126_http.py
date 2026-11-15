import json,secrets,sqlite3,unittest
from test_accounts import Accounts

class ReleaseHTTP(Accounts):
    def test_seasons_and_observer_authorization(self):
        cookies=[]
        for i in range(3):
            code,h,_=self.request('/api/register',{'username':'SeasonQA'+str(i),'password':secrets.token_urlsafe(20)});self.assertEqual(code,200);cookies.append(h['Set-Cookie'].split(';')[0])
        host,admin,outsider=cookies
        self.assertEqual(self.request('/api/rankings/season')[0],401)
        season=json.loads(self.request('/api/rankings/season',cookie=host)[2])
        me=json.loads(self.request('/api/me',cookie=host)[2]);state=me['state'];progress=json.loads(state['kart-save']);progress['records']={'competitive:kart:spa':100};state['kart-save']=json.dumps(progress)
        attempt=dict(key='competitive:kart:spa',seconds=105,season=season['id']);request=dict(revision=me['revision'],state=state,requestId='e'*32,raceRecords=[attempt])
        code,_,body=self.request('/api/account/state',request,cookie=host);self.assertEqual(code,200);self.assertEqual(self.request('/api/account/state',request,cookie=host)[0],200)
        for scope,value in [('alltime',100000),('seasonal',105000)]:
            response=json.loads(self.request('/api/rankings?track=spa&category=kart&mode=competitive&car=kart&scope='+scope,cookie=host)[2]);self.assertEqual(response['mine']['milliseconds'],value)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:c.execute("INSERT INTO admin_roles(user_id,role) SELECT id,'admin' FROM users WHERE username='SeasonQA1'")
        self.assertEqual(self.request('/api/admin/reset-season',{'season':season['id']},cookie=outsider)[0],403)
        self.assertEqual(self.request('/api/admin/reset-season',{'season':season['id']},cookie=admin)[0],200)
        self.assertEqual(self.request('/api/admin/reset-season',{'season':season['id']},cookie=admin)[0],409)
        for scope,count in [('alltime',1),('seasonal',0)]:
            response=json.loads(self.request('/api/rankings?track=spa&category=kart&mode=competitive&car=kart&scope='+scope,cookie=host)[2]);self.assertEqual(len(response['entries']),count)
        room=json.loads(self.request('/api/rooms/create',{},cookie=host)[2]);self.assertEqual(self.request('/api/rooms/lock',dict(code=room['code'],peer=room['peer'],locked=True),cookie=host)[0],200)
        self.assertEqual(self.request('/api/rooms/watch',{'code':room['code']},cookie=outsider)[0],403)
        code,_,body=self.request('/api/rooms/watch',{'code':room['code']},cookie=admin);self.assertEqual(code,200);watch=json.loads(body)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:self.assertEqual(c.execute("SELECT count(*) FROM admin_events WHERE action='watch-lobby' AND target=?",(room['code'],)).fetchone()[0],1)
        payload=dict(code=room['code'],peer=watch['peer']);self.assertEqual(self.request('/api/rooms/poll',payload,cookie=admin)[0],200)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:c.execute("DELETE FROM admin_roles WHERE user_id=(SELECT id FROM users WHERE username='SeasonQA1')")
        self.assertEqual(self.request('/api/rooms/poll',payload,cookie=admin)[0],403)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([ReleaseHTTP('test_seasons_and_observer_authorization')]))
    raise SystemExit(not result.wasSuccessful())
