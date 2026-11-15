"""Kart Racer accounts and static delivery. Python 3.12+, standard library only."""
import hashlib
import gzip
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from http.cookies import SimpleCookie, CookieError
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs
from moderation import blocked_username
from rooms import broker, RoomError
import profiles
import social
import staticfiles
import ice
import rankings
import admin
import devtools

ROOT = Path(os.environ.get('GAME_ROOT', Path(__file__).resolve().parent.parent)).resolve()
DATA = Path(os.environ.get('ACCOUNT_DATA', '/var/www/kartracer/data')).resolve()
ORIGIN = os.environ['PUBLIC_ORIGIN'].rstrip('/')
PORT = int(os.environ.get('PORT', '3060'))
COOKIE = '__Host-kart_session'
TTL = 7 * 24 * 3600
HASH_SLOTS = threading.BoundedSemaphore(2)
PUBLIC = {'assets/branding/grand-poly.webp', 'assets/branding/favicon.png', 'assets/branding/apple-touch-icon.png', 'login.html', 'auth.css', 'auth.js', 'updates.js', 'social.css', 'release-notes.json', 'assets/backgrounds/multiplayer-garage-v2.webp', 'assets/backgrounds/multiplayer-christmas-v1.webp', 'season.js'}
GAME = {'lobby-classes.js','ui-settings.js','ui-settings.css','tuning-data.js','tuning-stats.js','tuning-visuals.js','tuning.js','tuning.css','clipboard.js','monaco-scenery.js','racing.js','race-hud.js','bot-driving.js','track-terrain.js','vehicle-geometry.js','race-ready.js', 'lobby-vote.js', 'kart_racer.html', 'quality.js', 'art.js', 'scenery.js', 'account.js', 'account-store.js', 'web-rooms.js', 'friends.js', 'privacy.js', 'rankings.js', 'motion.js', 'admin.js', 'bots.js', 'bots-ui.js', 'assets.js', 'gt3.js', 'track-physics.js', 'pit-stops.js', 'quick-play.js', 'stylized.js', 'ambient.js', 'ambient.css', 'kart-models.js', 'kart-designs.js', 'world-style.js', 'experimental-shaders.js', 'garage.js', 'gt3-extra.js', 'kart-tracks.js', 'cockpit.js', 'progression.js', 'developer.js', 'winter.js'}

def db():
    con = sqlite3.connect(DATA / 'accounts.sqlite3', timeout=10)
    con.execute('PRAGMA foreign_keys=ON')
    con.row_factory = sqlite3.Row
    return con

def initialize():
    os.umask(0o077)
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(DATA, 0o700)
    with db() as con:
        con.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          salt TEXT NOT NULL, password_hash TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
          digest TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
        ''')
        profiles.migrate(con)
        social.migrate(con)
        seed_file=DATA/'role-seeds.json'
        admin.migrate(con,json.loads(seed_file.read_text()) if seed_file.is_file() else None)
        con.commit()
        dev_seed=DATA/'developer-seeds.json'
        devtools.migrate(con,json.loads(dev_seed.read_text()) if dev_seed.is_file() else None)
        con.commit()
        import customizer_refund
        con.execute('BEGIN IMMEDIATE');customizer_refund.migrate(con)
        con.execute('CREATE TABLE IF NOT EXISTS music_uploads(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, token TEXT, content BLOB, total INTEGER, mime TEXT, expires INTEGER)')
    os.chmod(DATA / 'accounts.sqlite3', 0o600)

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=131072, r=8, p=1,
                          maxmem=192 * 1024 * 1024, dklen=32).hex()

class Handler(SimpleHTTPRequestHandler):
    server_version = 'KartRacer'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, *args):
        pass  # Never log credentials, cookies or query strings.

    def end_headers(self):
        self.send_header('Cache-Control', 'private, no-cache' if getattr(self,'static_cacheable',False) else 'private, no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def reply(self, code, value, cookie=None):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if cookie is not None:
            self.send_header('Set-Cookie', f'{COOKIE}={cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={TTL if cookie else 0}')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def session(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            token = cookies[COOKIE].value
            if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
                return None
        except (KeyError, ValueError, CookieError):
            return None
        with db() as con:
            return con.execute('SELECT users.id,username,sessions.digest FROM sessions JOIN users ON users.id=user_id WHERE digest=? AND expires>? AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE account_blocks.user_id=users.id)',
                               (digest(token), int(time.time()))).fetchone()

    def redirect(self, path):
        self.send_response(303)
        self.send_header('Location', path)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        self.static_cacheable=False
        name = unquote(urlsplit(self.path).path).lstrip('/')
        user = self.session()
        if name=='api/admin/status':
            if not user:return self.reply(401,{'error':'unauthorized'})
            with db() as con:return self.reply(200,{'admin':admin.allowed(con,user['id']),'role':admin.role(con,user['id'])})
        if name=='api/rankings/season':
            user=self.session()
            if not user:return self.reply(401,{'error':'unauthorized'})
            with db() as con:
                con.execute('BEGIN IMMEDIATE');result=rankings.season(con)
            return self.reply(200,result)
        if name=='api/rankings':
            if not user:return self.reply(401,{'error':'unauthorized'})
            query=parse_qs(urlsplit(self.path).query)
            try:
                with db() as con:result=rankings.board(con,user['id'],query.get('track',[''])[0],query.get('category',[''])[0],query.get('mode',['competitive'])[0],query.get('car',[None])[0],query.get('scope',['alltime'])[0])
            except ValueError:return self.reply(400,{'error':'invalid'})
            return self.reply(200,result)
        if name == 'api/ice':
            if not user: return self.reply(401, {'error':'unauthorized'})
            return self.reply(200, ice.configuration(user['id']))
        if name=='api/social':
            if not user:return self.reply(401,{'error':'unauthorized'})
            with db() as con:result=social.overview(con,user['id'])
            return self.reply(200,result)
        if name == 'api/me':
            if not user: return self.reply(401, {'error':'unauthorized'})
            with db() as con: return self.reply(200, profiles.account(con,user['id']))
        if name == 'api/account/music':
            if not user: return self.reply(401, {'error':'unauthorized'})
            with db() as con: row=con.execute('SELECT music,music_type FROM profiles WHERE user_id=?',(user['id'],)).fetchone()
            if row['music'] is None: return self.reply(404, {'error':'not_found'})
            content=row['music'];start,end=0,len(content)-1;status=200
            match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
            if match:
                start=int(match[1]);end=min(int(match[2]) if match[2] else end,end);status=206
                if start>end: return self.reply(416,{'error':'invalid'})
            self.send_response(status);self.send_header('Content-Type',row['music_type']);self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Length',str(end-start+1))
            if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{len(content)}')
            self.end_headers()
            if self.command!='HEAD':self.wfile.write(content[start:end+1])
            return
        if name in ('', 'index.html'):
            name = 'kart_racer.html' if user else 'login.html'
        if name == 'login':
            name = 'login.html'
        if name == 'login.html' and user:
            return self.redirect('/')
        if name not in PUBLIC:
            if not user:
                if name == 'kart_racer.html':
                    return self.redirect('/login')
                return self.reply(401, {'error': 'unauthorized'})
            if name not in GAME and not name.startswith(('assets/', 'vendor/')):
                return self.reply(404, {'error': 'not_found'})
        target = (ROOT / name).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file() or any(part.startswith('.') for part in Path(name).parts):
            return self.reply(404, {'error': 'not_found'})
        resolved_name = target.relative_to(ROOT).as_posix()
        if resolved_name not in PUBLIC | GAME and not resolved_name.startswith(('assets/', 'vendor/')):
            return self.reply(404, {'error': 'not_found'})
        if name=='kart_racer.html':
            with db() as con: boot=profiles.account(con,user['id'])
            embedded=json.dumps(boot).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
            body=target.read_text(encoding='utf8').replace('<head>','<head><script>window.KART_ACCOUNT='+embedded+';</script>',1).encode()
            zipped=staticfiles.accepts_gzip(self.headers.get('Accept-Encoding',''))
            if zipped:body=gzip.compress(body,compresslevel=6)
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Vary','Accept-Encoding')
            if zipped:self.send_header('Content-Encoding','gzip')
            self.send_header('Content-Length',str(len(body)));self.end_headers()
            if self.command!='HEAD':self.wfile.write(body)
            return
        return staticfiles.serve(self,target)

    def limited(self, username):
        now = int(time.time())
        # Nginx overwrites X-Real-IP; the backend only accepts loopback connections.
        ip = self.headers.get('X-Real-IP', self.client_address[0])[:128]
        keys = [(digest('ip:' + ip), 30), (digest('user:' + username.lower()), 12)]
        with db() as con:
            con.execute('BEGIN IMMEDIATE')
            con.execute('DELETE FROM attempts WHERE expires<=?', (now,))
            con.execute('DELETE FROM sessions WHERE expires<=?', (now,))
            for key, limit in keys:
                row = con.execute('SELECT count FROM attempts WHERE key=?', (key,)).fetchone()
                if row and row['count'] >= limit:
                    return True
            for key, _ in keys:
                con.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now + 900))
        return False

    def do_POST(self):
        self.static_cacheable=False
        route = urlsplit(self.path).path
        dev_action=route.removeprefix('/api/dev/') if route.startswith('/api/dev/') else None
        admin_action=route.removeprefix('/api/admin/') if route.startswith('/api/admin/') else None
        social_action=route.removeprefix('/api/social/') if route.startswith('/api/social/') else None
        room_action = route.removeprefix('/api/rooms/') if route.startswith('/api/rooms/') else None
        if route not in ('/api/login', '/api/register', '/api/logout','/api/account/state','/api/account/rename','/api/account/buy-car','/api/account/buy-cosmetic','/api/account/buy-upgrade','/api/account/music') and room_action not in ('create','join','watch','poll','signal','leave','lock','invite-policy','class-policy','vehicle-class') and social_action not in ('request','accept','decline','cancel','remove','invite','open-invite','dismiss-invite','seen','search','profile','privacy','heartbeat') and admin_action not in ('list','role','suspend','close-room','inventory','inventory-save','reset-season','review-record') and dev_action not in ('list','role','preview'):
            return self.reply(404, {'error': 'not_found'})
        if self.headers.get('Origin') != ORIGIN or self.headers.get('X-Kart-Request') != '1':
            return self.reply(403, {'error': 'forbidden'})
        if route=='/api/account/music':
            return self.upload_music()
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json' or self.headers.get('Transfer-Encoding'):
            return self.reply(415, {'error': 'invalid'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 1 <= size <= (49152 if room_action == 'signal' else 65536 if route=='/api/account/state' else 4096):
                return self.reply(413, {'error': 'invalid'})
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.reply(400, {'error': 'invalid'})
        if dev_action:
            user=self.session()
            if not user:return self.reply(401,{'error':'unauthorized'})
            try:
                with db() as con:result=devtools.action(con,user['id'],dev_action,data)
                return self.reply(200,result)
            except profiles.ProfileError as error:return self.reply(error.status,{'error':error.code})
        if admin_action:
            user=self.session()
            if not user:return self.reply(401,{'error':'unauthorized'})
            try:
                with db() as con:result=admin.action(con,user['id'],admin_action,data,broker)
                return self.reply(200,result)
            except profiles.ProfileError as error:return self.reply(error.status,{'error':error.code})
        if social_action:
            user=self.session()
            if not user:return self.reply(401,{'error':'unauthorized'})
            try:
                with db() as con:result=social.action(con,user['id'],social_action,data)
                return self.reply(200,result)
            except profiles.ProfileError as error:return self.reply(error.status,{'error':error.code})
        if route in ('/api/account/state','/api/account/rename','/api/account/buy-car','/api/account/buy-cosmetic','/api/account/buy-upgrade'):
            user=self.session()
            if not user:return self.reply(401,{'error':'unauthorized'})
            try:
                with db() as con:
                    action={'/api/account/state':profiles.save,'/api/account/rename':profiles.rename,'/api/account/buy-car':profiles.buy_car,'/api/account/buy-cosmetic':profiles.buy_cosmetic,'/api/account/buy-upgrade':profiles.tuning.buy}[route]
                    result=action(con,user['id'],data)
                return self.reply(200,result)
            except profiles.ProfileError as error:
                return self.reply(error.status,{'error':error.code})
            except sqlite3.IntegrityError:
                return self.reply(409,{'error':'taken'})
        if room_action:
            user = self.session()
            if not user:
                return self.reply(401, {'error': 'unauthorized'})
            try:
                is_admin=False
                if room_action=='watch' or room_action=='poll' and broker.observer(user['id'],data):
                    with db() as con:is_admin=admin.allowed(con,user['id'])
                    if not is_admin:return self.reply(403,{'error':'forbidden'})
                result=broker.call(room_action,user['id'],data,admin=is_admin)
                if room_action=='watch':
                    with db() as con:admin.event(con,user['id'],'watch-lobby',data['code'],{})
                return self.reply(200,result)
            except RoomError as error:
                return self.reply(error.status, {'error':error.code})
        if route == '/api/logout':
            user = self.session()
            if user:
                with db() as con:
                    con.execute('DELETE FROM sessions WHERE digest=?', (user['digest'],))
            return self.reply(200, {'ok': True}, '')
        username, password = data.get('username'), data.get('password')
        if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,20}', username):
            return self.reply(400, {'error': 'username'})
        if not isinstance(password, str) or not 12 <= len(password) <= 128:
            return self.reply(400, {'error': 'password'})
        if self.limited(username):
            return self.reply(429, {'error': 'rate'})
        if route == '/api/register' and blocked_username(username):
            return self.reply(400, {'error': 'blocked'})
        if not HASH_SLOTS.acquire(blocking=False):
            return self.reply(503, {'error': 'busy'})
        try:
            with db() as con:
                row = con.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
            salt = row['salt'] if row else secrets.token_hex(16)
            hashed = password_hash(password, salt)
            if route == '/api/register':
                if row:
                    return self.reply(409, {'error': 'taken'})
                with db() as con:
                    try:
                        con.execute('BEGIN IMMEDIATE')
                        if con.execute('SELECT 1 FROM names WHERE name=?',(username,)).fetchone():
                            return self.reply(409,{'error':'taken'})
                        user_id = con.execute('INSERT INTO users(username,salt,password_hash,created,account_id,player_id) VALUES(?,?,?,?,?,?)',
                                              (username, salt, hashed, int(time.time()),secrets.token_hex(16),profiles.new_player_id(con))).lastrowid
                        con.execute('INSERT INTO names VALUES (?,?)',(username,user_id))
                        con.execute('INSERT INTO profiles(user_id,state) VALUES (?,?)',(user_id,json.dumps(profiles.defaults())))
                    except sqlite3.IntegrityError:
                        return self.reply(409, {'error': 'taken'})
            else:
                if not row or not hmac.compare_digest(row['password_hash'], hashed):
                    return self.reply(401, {'error': 'credentials'})
                user_id, username = row['id'], row['username']
            token = secrets.token_urlsafe(32)
            previous = self.session()
            with db() as con:
                con.execute('BEGIN IMMEDIATE')
                if con.execute('SELECT 1 FROM account_blocks WHERE user_id=?',(user_id,)).fetchone():
                    return self.reply(403,{'error':'account_blocked'})
                if previous:
                    con.execute('DELETE FROM sessions WHERE digest=?', (previous['digest'],))
                con.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), user_id, int(time.time()) + TTL))
            return self.reply(200, {'username': username}, token)
        finally:
            HASH_SLOTS.release()

    def upload_music(self):
        user=self.session()
        if not user:return self.reply(401,{'error':'unauthorized'})
        try:
            size=int(self.headers.get('Content-Length','0'));offset=int(self.headers.get('X-Kart-Offset','-1'));total=int(self.headers.get('X-Kart-Total','0'))
            mime=self.headers.get('Content-Type','');token=self.headers.get('X-Kart-Upload','')
            if not 0<size<=262144 or not 0<=offset<total<=25*1024*1024 or offset+size>total or not re.fullmatch('[a-f0-9]{32}',token) or mime not in ('audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac','audio/x-flac','audio/webm','audio/opus') or self.headers.get('Transfer-Encoding'):
                return self.reply(400,{'error':'music'})
            chunk=self.rfile.read(size)
            if len(chunk)!=size:return self.reply(400,{'error':'music'})
            with db() as con:
                con.execute('BEGIN IMMEDIATE');con.execute('DELETE FROM music_uploads WHERE expires<?',(int(time.time()),))
                if offset==0:
                    con.execute('INSERT OR REPLACE INTO music_uploads VALUES (?,?,?,?,?,?)',(user['id'],token,b'',total,mime,int(time.time())+900))
                upload=con.execute('SELECT * FROM music_uploads WHERE user_id=?',(user['id'],)).fetchone()
                if not upload or upload['token']!=token or len(upload['content'])!=offset or upload['total']!=total or upload['mime']!=mime:return self.reply(409,{'error':'music'})
                content=upload['content']+chunk
                if len(content)==total:
                    con.execute('UPDATE profiles SET music=?,music_type=? WHERE user_id=?',(content,mime,user['id']))
                    con.execute('DELETE FROM music_uploads WHERE user_id=?',(user['id'],))
                else:con.execute('UPDATE music_uploads SET content=? WHERE user_id=?',(content,user['id']))
            return self.reply(200,{'ok':True,'complete':offset+size==total})
        except ValueError:return self.reply(400,{'error':'music'})

if __name__ == '__main__':
    initialize()
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
