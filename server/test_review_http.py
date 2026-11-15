import json,secrets,sqlite3,unittest
from test_accounts import Accounts
class ReviewHTTP(Accounts):
 def test_auth_pending_and_decision(self):
  self.assertEqual(self.request('/api/admin/review-record',{})[0],401)
  _,headers,_=self.request('/api/register',{'username':'QAReview','password':secrets.token_urlsafe(24)})
  cookie=headers['Set-Cookie'].split(';')[0]
  self.assertEqual(self.request('/api/admin/review-record',{'review':1,'decision':'approved'},cookie=cookie)[0],403)
if __name__=='__main__':unittest.main()
