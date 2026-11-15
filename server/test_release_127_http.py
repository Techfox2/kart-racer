import json,secrets,sqlite3,unittest
from test_accounts import Accounts
import profiles,tuning

class TuningHTTP(Accounts):
    def test_workshop_cloud(self):
        self.assertEqual(self.request('/api/account/buy-upgrade',{})[0],401)
        code,headers,_=self.request('/api/register',{'username':'QAWorkshop','password':secrets.token_urlsafe(24)})
        self.assertEqual(code,200);cookie=headers['Set-Cookie'].split(';')[0]
        me=json.loads(self.request('/api/me',cookie=cookie)[2]);state=profiles.defaults();p=json.loads(state['kart-save']);p.update(coins=1000000,ownedCars=list(profiles.CAR_PRICES),ownedKarts=list(profiles.KART_PRICES));state['kart-save']=json.dumps(p)
        with sqlite3.connect(self.tmp.name+'/accounts.sqlite3') as c:c.execute('UPDATE profiles SET state=? WHERE user_id=(SELECT id FROM users WHERE username=?)',(json.dumps(state),'QAWorkshop'))
        me=json.loads(self.request('/api/me',cookie=cookie)[2]);spent=0
        self.assertEqual(self.request('/api/account/buy-upgrade',dict(car='kart',part='engine',level=3,revision=me['revision']),cookie=cookie)[0],409)
        for car,parts in tuning.PRICES.items():
            for part,prices in parts.items():
                for level,price in enumerate(prices,1):
                    request=dict(car=car,part=part,level=level,revision=me['revision'],price=0)
                    code,_,body=self.request('/api/account/buy-upgrade',request,cookie=cookie);self.assertEqual(code,200,(car,part,level,body));me=json.loads(body);spent+=price
                    self.assertEqual(json.loads(me['state']['kart-save'])['coins'],1000000-spent)
                    if car=='kart' and part=='engine':
                        duplicate=json.loads(self.request('/api/account/buy-upgrade',request,cookie=cookie)[2]);self.assertEqual(duplicate,me)
        state=me['state']
        code,_,body=self.request('/api/account/state',dict(state=state,revision=me['revision']),cookie=cookie);self.assertEqual(code,200);saved=json.loads(body)
        p=json.loads(saved['state']['kart-save']);self.assertEqual(p['coins'],1000000-spent);self.assertEqual(p['xp'],0);self.assertEqual(p['records'],{})
        for car,parts in tuning.PRICES.items():self.assertEqual(p['upgrades'][car],{part:3 for part in parts})
        for f in ['tuning.js','assets/tuning/catalog.json']:
            self.assertEqual(self.request('/'+f,cookie=cookie)[0],200,f)

if __name__=='__main__':
    r=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([TuningHTTP('test_workshop_cloud')]))
    raise SystemExit(not r.wasSuccessful())
