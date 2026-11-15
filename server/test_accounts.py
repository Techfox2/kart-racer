import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from moderation import blocked_username

class Accounts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(__file__).resolve().parent.parent
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            cls.port = s.getsockname()[1]
        cls.env = dict(os.environ, ACCOUNT_DATA=cls.tmp.name, GAME_ROOT=str(cls.root),
                       PUBLIC_ORIGIN='https://kart.test', PORT=str(cls.port))
        cls.start()

    @classmethod
    def start(cls):
        cls.proc = subprocess.Popen([sys.executable, str(cls.root/'server/app.py')], env=cls.env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        for _ in range(100):
            try:
                c = http.client.HTTPConnection('127.0.0.1', cls.port, timeout=1)
                c.request('GET', '/');r=c.getresponse();r.read();c.close()
                if r.status == 200: return
            except OSError: time.sleep(.05)
        raise AssertionError('Server did not start')

    @classmethod
    def stop(cls):
        cls.proc.terminate();cls.proc.communicate(timeout=10)

    @classmethod
    def tearDownClass(cls):
        cls.stop();cls.tmp.cleanup()

    def request(self, route, data=None, cookie='', origin='https://kart.test', extra=None):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=15)
        headers = {'Cookie':cookie, 'Origin':origin, 'X-Kart-Request':'1','Content-Type':'application/json'}
        headers.update(extra or {})
        c.request('POST' if data is not None else 'GET',route,json.dumps(data) if data is not None else None,headers)
        r=c.getresponse();result=(r.status,dict(r.getheaders()),r.read());c.close();return result

    def test_01_registration_login_persistence_logout(self):
        password=secrets.token_urlsafe(20)
        user={'username':'TestRacer42','password':password}
        code,headers,body=self.request('/api/register',user)
        self.assertEqual(code,200)
        self.assertEqual(json.loads(body)['username'],user['username'])
        cookie=headers['Set-Cookie'].split(';')[0]
        for attribute in ['Secure','HttpOnly','SameSite=Strict','Path=/']: self.assertIn(attribute,headers['Set-Cookie'])
        self.assertEqual(self.request('/api/me',cookie=cookie)[0],200)
        room_code,_,room_body=self.request('/api/rooms/create',{},cookie=cookie)
        self.assertEqual(room_code,200)
        self.assertEqual(self.request('/api/rooms/leave',json.loads(room_body),cookie=cookie)[0],200)
        self.assertEqual(self.request('/kart_racer.html',cookie=cookie)[0],200)
        self.assertEqual(self.request('/server/app.py',cookie=cookie)[0],404)
        self.assertEqual(self.request('/assets/../server/app.py',cookie=cookie)[0],404)
        self.assertEqual(self.request('/assets/../../data/accounts.sqlite3',cookie=cookie)[0],404)
        self.assertEqual(self.request('/assets/',cookie=cookie)[0],404)
        with sqlite3.connect(Path(self.tmp.name)/'accounts.sqlite3') as con:
            row=con.execute('SELECT salt,password_hash FROM users').fetchone()
            self.assertNotEqual(row[1],password)
            self.assertEqual(row[1],hashlib.scrypt(password.encode(),salt=bytes.fromhex(row[0]),n=131072,r=8,p=1,maxmem=192*1024*1024,dklen=32).hex())
            self.assertNotEqual(con.execute('SELECT digest FROM sessions').fetchone()[0],cookie.split('=',1)[1])
        self.stop();self.start()
        self.assertEqual(self.request('/api/me',cookie=cookie)[0],200)
        self.assertEqual(self.request('/api/logout',{},cookie=cookie)[0],200)
        self.assertEqual(self.request('/api/me',cookie=cookie)[0],401)
        self.assertEqual(self.request('/api/login',dict(user,password='wrong-password-123'))[0],401)
        self.assertEqual(self.request('/api/login',dict(user,username='testracer42'))[0],200)
        self.assertEqual(self.request('/api/register',dict(user,username='TESTRACER42'))[0],409)

    def test_02_unauthenticated_and_csrf(self):
        self.assertEqual(self.request('/')[0],200)
        self.assertEqual(self.request('/auth.js')[0],200)
        self.assertEqual(self.request('/api/me')[0],401)
        self.assertEqual(self.request('/api/rooms/create',{})[0],401)
        self.assertEqual(self.request('/kart_racer.html')[0],303)
        self.assertEqual(self.request('/quality.js')[0],401)
        self.assertEqual(self.request('/api/register',{},origin='https://foreign.test')[0],403)
        self.assertEqual(self.request('/api/register',{},extra={'X-Kart-Request':''})[0],403)
        self.assertEqual(self.request('/api/register',{},extra={'Content-Type':'text/plain'})[0],415)
        self.assertEqual(self.request('/api/register',{'username':'a@b.com','password':'abcdefghijklm'})[0],400)
        self.assertEqual(self.request('/api/register',{'username':'Racer','password':'short'})[0],400)
        self.assertEqual(self.request('/api/register',{'username':'Racer','password':'x'*5000})[0],413)

    def test_03_profanity_and_rate_limit(self):
        for name in ['FuckRacer','f_u_c_k','f4gg0t','Sch3iss','HurenSohn','c0nn4rd','Encule','putain99','B1tch','n1gg3r','Admin99']:
            self.assertTrue(blocked_username(name),name)
        for name in ['ClassicRacer','Falcon','Assassin','ComputerRacer','Speedy42','Phil_Racer','KartFan','Schumacher']:
            self.assertFalse(blocked_username(name),name)
        for i in range(12):
            code,_,body=self.request('/api/register',{'username':'f_u_c_k','password':'valid-password-123'})
            self.assertEqual(code,400);self.assertEqual(json.loads(body)['error'],'blocked')
        self.assertEqual(self.request('/api/register',{'username':'f_u_c_k','password':'valid-password-123'})[0],429)
        with sqlite3.connect(Path(self.tmp.name)/'accounts.sqlite3') as con:
            self.assertIsNone(con.execute('SELECT id FROM users WHERE username=?',('f_u_c_k',)).fetchone())

if __name__ == '__main__': unittest.main(verbosity=2)
