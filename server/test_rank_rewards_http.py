import json
import secrets
import unittest
from test_accounts import Accounts

class RecordHTTP(Accounts):
    def test_rewards_and_filters(self):
        cookies=[]
        for i in range(2):
            code,h,_=self.request('/api/register',{'username':'RecordQA'+str(i),'password':secrets.token_urlsafe(20)});self.assertEqual(code,200);cookies.append(h['Set-Cookie'].split(';')[0])
        for i,cookie in enumerate(cookies):
            me=json.loads(self.request('/api/me',cookie=cookie)[2]);state=me['state'];p=json.loads(state['kart-save']);p['records']={'competitive:kart:snow':100-i};state['kart-save']=json.dumps(p);request={'revision':me['revision'],'state':state,'requestId':str(i)*32}
            code,_,body=self.request('/api/account/state',request,cookie=cookie);self.assertEqual(code,200);result=json.loads(body);self.assertEqual(result.get('recordReward',0),100*i);self.assertEqual(json.loads(result['state']['kart-save'])['coins'],100*i)
            self.assertEqual(json.loads(self.request('/api/account/state',request,cookie=cookie)[2]),result)
        cookie=cookies[1]
        for query,count in [('category=kart&mode=competitive&car=kart',2),('category=kart&mode=luckyblock&car=kart',0),('category=gt3&mode=competitive&car=porsche',0)]:
            code,_,body=self.request('/api/rankings?track=snow&'+query,cookie=cookie);self.assertEqual(code,200);self.assertEqual(len(json.loads(body)['entries']),count)
        self.assertEqual(self.request('/api/rankings?track=snow&category=kart&mode=competitive&car=ferrari',cookie=cookie)[0],400)
        self.stop();self.start();self.assertEqual(json.loads(json.loads(self.request('/api/me',cookie=cookie)[2])['state']['kart-save'])['coins'],100)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([RecordHTTP('test_rewards_and_filters')]))
    raise SystemExit(not result.wasSuccessful())
