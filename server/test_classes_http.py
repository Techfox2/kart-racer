import json
import secrets
from test_accounts import Accounts

class ClassHTTP(Accounts):
    def test_policy_join_switch_and_start_guard(self):
        def account():
            code,headers,_=self.request('/api/register',{'username':'QA'+secrets.token_hex(5),'password':secrets.token_hex(20)})
            self.assertEqual(code,200);return headers['Set-Cookie'].split(';')[0]
        host_cookie=account();guest_cookie=account()
        def call(action,data,cookie):
            code,_,body=self.request('/api/rooms/'+action,data,cookie=cookie)
            return code,json.loads(body)
        code,host=call('create',{'category':'gt3','driverClass':'gt3','mixedClasses':False},host_cookie)
        self.assertEqual(code,200)
        code,error=call('join',{'code':host['code'],'category':'kart'},guest_cookie)
        self.assertEqual((code,error['error']),(409,'class_gt3'))
        self.assertEqual(call('class-policy',{**host,'category':'gt3','mixedClasses':True},host_cookie)[0],200)
        code,guest=call('join',{'code':host['code'],'category':'kart'},guest_cookie);self.assertEqual(code,200)
        self.assertEqual(call('class-policy',{**guest,'category':'kart','mixedClasses':True},guest_cookie)[0],403)
        self.assertEqual(call('class-policy',{**host,'category':'gt3','mixedClasses':False},host_cookie)[0],200)
        self.assertEqual(call('lock',{**host,'locked':True},host_cookie)[0],409)
        self.assertEqual(call('vehicle-class',{**guest,'category':'kart'},guest_cookie)[0],409)
        self.assertEqual(call('vehicle-class',{**guest,'category':'hovercraft'},guest_cookie)[0],400)
        self.assertEqual(call('vehicle-class',{**guest,'category':'gt3'},guest_cookie)[0],200)
        self.assertEqual(call('lock',{**host,'locked':True},host_cookie)[0],200)
        self.assertEqual(call('vehicle-class',{**guest,'category':'kart'},guest_cookie)[0],409)
        self.assertEqual(call('class-policy',{**host,'category':'gt3','mixedClasses':True},host_cookie)[0],409)
        self.assertEqual(call('leave',host,host_cookie)[0],200)
