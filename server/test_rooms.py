import unittest
from rooms import Broker, RoomError

class Rooms(unittest.TestCase):
    def setUp(self):
        self.now=1000
        self.b=Broker(lambda:self.now)
        self.host=self.b.call('create',1,{})
        self.guest=self.b.call('join',2,{'code':self.host['code']})

    def call(self,action,who,**data):
        identity=self.host if who==1 else self.guest
        return self.b.call(action,who,dict(identity,**data))

    def rejected(self,status,action,uid,data):
        with self.assertRaises(RoomError) as cm:self.b.call(action,uid,data)
        self.assertEqual(cm.exception.status,status)

    def test_signals_ack_and_no_race_relay(self):
        self.assertRegex(self.host['code'],r'^[A-Z0-9]{8}$')
        self.assertRegex(self.host['code'],r'[A-Z]');self.assertRegex(self.host['code'],r'[0-9]')
        self.call('signal',2,to=self.host['peer'],message={'type':'offer','sdp':'v=0\r\n'})
        messages=self.call('poll',1)['messages'];self.assertEqual(len(messages),1)
        self.assertEqual(self.call('poll',1)['messages'],messages)
        self.assertEqual(self.call('poll',1,after=messages[0]['seq'])['messages'],[])
        self.call('signal',1,to=self.guest['peer'],message={'type':'answer','sdp':'v=0\r\n'})
        self.assertEqual(len(self.call('poll',2)['messages']),1)
        self.rejected(400,'signal',2,dict(self.guest,to=self.host['peer'],message={'type':'state','x':1}))
        self.rejected(403,'poll',99,self.host)
        self.rejected(403,'signal',2,dict(self.guest,to=self.host['peer'],message={'type':'answer','sdp':'v=0'}))
        self.rejected(400,'signal',2,dict(self.guest,to=self.host['peer'],message={'type':'offer','sdp':'v=0'+'x'*32000}))

    def test_capacity_lock_and_leave(self):
        for uid in range(3,8):self.b.call('join',uid,{'code':self.host['code']})
        self.rejected(409,'join',8,{'code':self.host['code']})
        self.call('leave',2)
        self.b.call('join',8,{'code':self.host['code']})
        self.rejected(403,'lock',2,dict(self.guest,locked=True))
        self.call('lock',1,locked=True)
        self.rejected(409,'join',9,{'code':self.host['code']})
        self.call('leave',1)
        self.rejected(404,'poll',8,self.host)

    def test_expiry_and_host_only_topology(self):
        other=self.b.call('join',3,{'code':self.host['code']})
        self.rejected(403,'signal',2,dict(self.guest,to=other['peer'],message={'type':'ice','candidate':{'candidate':'candidate:example'}}))
        self.now+=181
        self.rejected(404,'poll',1,self.host)
        self.assertFalse(self.b.rooms)

    def test_rate_and_unknown_codes(self):
        for _ in range(120):self.call('poll',1)
        self.rejected(429,'poll',1,self.host)
        self.rejected(400,'join',9,{'code':'123456'})
        self.rejected(404,'join',9,{'code':'ZZZZ9999'})

if __name__=='__main__':unittest.main(verbosity=2)
