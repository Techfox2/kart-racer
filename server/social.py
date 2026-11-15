"""Friendships refer to immutable internal user keys, never to names."""
import re
import json
import secrets
import time
from rooms import broker, RoomError
from profiles import ProfileError
from profiles import TRACKS

CURRENT_VERSION='1.2.10'
PRIVACY_DEFAULTS={'online':'friends','track':'friends','coins':'private','friends':'private'}

def migrate(con):
    con.executescript('''
    CREATE TABLE IF NOT EXISTS friendships(a INTEGER REFERENCES users(id) ON DELETE CASCADE,
      b INTEGER REFERENCES users(id) ON DELETE CASCADE, requester INTEGER REFERENCES users(id) ON DELETE CASCADE,
      accepted INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, PRIMARY KEY(a,b), CHECK(a<b));
    CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY, sender INTEGER REFERENCES users(id) ON DELETE CASCADE,
      recipient INTEGER REFERENCES users(id) ON DELETE CASCADE, mode TEXT NOT NULL, code TEXT NOT NULL,
      peer TEXT NOT NULL, expires INTEGER NOT NULL, UNIQUE(sender,recipient));
    CREATE TABLE IF NOT EXISTS release_seen(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, version TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS privacy(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, settings TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, tab TEXT NOT NULL, track TEXT, seen INTEGER NOT NULL, PRIMARY KEY(user_id,tab));
    ''')

def player(con,uid):
    r=con.execute('SELECT player_id,username FROM users WHERE id=?',(uid,)).fetchone()
    return {'id':r['player_id'],'username':r['username']}

def privacy(con,uid):
    row=con.execute('SELECT settings FROM privacy WHERE user_id=?',(uid,)).fetchone()
    return {**PRIVACY_DEFAULTS,**(json.loads(row['settings']) if row else {})}

def details(con,viewer,uid):
    result=player(con,uid);settings=privacy(con,uid);a,b=sorted([viewer,uid])
    edge=con.execute('SELECT accepted,requester FROM friendships WHERE a=? AND b=?',(a,b)).fetchone()
    friend=bool(edge and edge['accepted'])
    result['relationship']='self' if viewer==uid else 'friend' if friend else ('outgoing' if edge['requester']==viewer else 'incoming') if edge else 'none'
    def visible(key):return viewer==uid or settings[key]=='everyone' or settings[key]=='friends' and friend
    active=con.execute('SELECT track FROM activity WHERE user_id=? AND seen>? ORDER BY (track IS NOT NULL) DESC,seen DESC LIMIT 1',(uid,int(time.time())-90)).fetchone()
    if visible('online'):result['online']=active is not None
    if visible('track'):result['track']=active['track'] if active else None
    if visible('coins'):
        row=con.execute('SELECT state FROM profiles WHERE user_id=?',(uid,)).fetchone()
        result['coins']=json.loads(json.loads(row['state'])['kart-save'])['coins'] if row and row['state'] else 0
    if visible('friends'):
        result['friends']=[player(con,r['b'] if r['a']==uid else r['a']) for r in con.execute('SELECT a,b FROM friendships WHERE (a=? OR b=?) AND accepted=1 ORDER BY created DESC LIMIT 200',(uid,uid))]
    return result

def web_room(uid,code,peer):
    with broker.lock:
        broker.prune(broker.clock());room=broker.rooms.get(code)
        member=room['members'].get(peer) if room else None
        if not member or member['uid']!=uid:raise ProfileError(404,'room_missing')
        if peer!=room['host'] and not room.get('guest_invites',False):raise ProfileError(403,'invites_disabled')
        if room['locked']:raise ProfileError(409,'race_started')
        if len(room['members'])>=7:raise ProfileError(409,'room_full')

def overview(con,uid):
    con.execute('DELETE FROM invitations WHERE expires<=?',(int(time.time()),))
    friends=[];incoming=[];outgoing=[]
    for r in con.execute('SELECT * FROM friendships WHERE a=? OR b=?',(uid,uid)):
        oid=r['b'] if r['a']==uid else r['a']
        item=details(con,uid,oid) if r['accepted'] else player(con,oid)
        (friends if r['accepted'] else outgoing if r['requester']==uid else incoming).append(item)
    invites=[]
    for r in con.execute('SELECT * FROM invitations WHERE recipient=?',(uid,)).fetchall():
        if r['mode']=='web':
            try:web_room(r['sender'],r['code'],r['peer'])
            except ProfileError:
                con.execute('DELETE FROM invitations WHERE id=?',(r['id'],));continue
        invites.append({'id':r['id'],'from':player(con,r['sender']),'mode':r['mode'],'code':r['code']})
    seen=con.execute('SELECT version FROM release_seen WHERE user_id=?',(uid,)).fetchone()
    return {'friends':sorted(friends,key=lambda x:x['username'].lower()),'incoming':incoming,'outgoing':outgoing,'invites':invites,'seen':seen['version'] if seen else None}

def action(con,uid,verb,data):
    now=int(time.time());con.execute('BEGIN IMMEDIATE')
    if verb=='heartbeat':
        tab,track=data.get('tab'),data.get('track')
        if not isinstance(tab,str) or not re.fullmatch('[a-f0-9]{32}',tab) or track is not None and track not in TRACKS:raise ProfileError(400,'invalid')
        con.execute('DELETE FROM activity WHERE seen<=?',(now-90,))
        con.execute('INSERT INTO activity VALUES (?,?,?,?) ON CONFLICT(user_id,tab) DO UPDATE SET track=excluded.track,seen=excluded.seen',(uid,tab,track,now))
        con.execute('DELETE FROM activity WHERE user_id=? AND tab NOT IN (SELECT tab FROM activity WHERE user_id=? ORDER BY seen DESC LIMIT 10)',(uid,uid))
        return {'ok':True}
    if verb=='privacy':
        settings=data.get('settings')
        if settings is not None:
            if not isinstance(settings,dict) or set(settings)!=set(PRIVACY_DEFAULTS) or any(v not in ('everyone','friends','private') for v in settings.values()):raise ProfileError(400,'invalid')
            con.execute('INSERT INTO privacy VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings',(uid,json.dumps(settings)))
        return {'settings':privacy(con,uid)}
    if verb=='seen':
        if data.get('version')!=CURRENT_VERSION:raise ProfileError(400,'invalid')
        con.execute('INSERT INTO release_seen VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version',(uid,CURRENT_VERSION))
        return {'ok':True}
    key='social:'+str(uid)
    con.execute('DELETE FROM attempts WHERE expires<=?',(now,))
    count=con.execute('SELECT count FROM attempts WHERE key=?',(key,)).fetchone()
    if count and count['count']>=60:raise ProfileError(429,'rate')
    con.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,now+60))
    con.commit() # Failed lookups count toward the limit too.
    con.execute('BEGIN IMMEDIATE')
    if verb=='search':
        query=data.get('query')
        if not isinstance(query,str) or not re.fullmatch('[A-Za-z0-9_-]{3,20}',query.strip()):raise ProfileError(400,'username')
        query=query.strip();prefix=query.replace('_','\\_')+'%'
        rows=con.execute("SELECT id FROM users WHERE id!=? AND (username LIKE ? ESCAPE '\\' OR player_id=?) ORDER BY (player_id=?) DESC,(username=? COLLATE NOCASE) DESC,username LIMIT 20",(uid,prefix,query.upper(),query.upper(),query)).fetchall()
        return {'players':[details(con,uid,r['id']) for r in rows]}
    if verb=='profile':
        target=data.get('target')
        if not isinstance(target,str) or not re.fullmatch('[A-Za-z0-9]{6}',target):raise ProfileError(400,'invalid_id')
        row=con.execute('SELECT id FROM users WHERE player_id=?',(target.upper(),)).fetchone()
        if not row:raise ProfileError(404,'player_missing')
        return details(con,uid,row['id'])
    if verb in ('open-invite','dismiss-invite'):
        iid=data.get('invite')
        if not isinstance(iid,str):raise ProfileError(400,'invalid')
        r=con.execute('SELECT * FROM invitations WHERE id=? AND recipient=? AND expires>?',(iid,uid,now)).fetchone()
        if not r:raise ProfileError(404,'invite_missing')
        if verb=='open-invite' and r['mode']=='web':web_room(r['sender'],r['code'],r['peer'])
        if verb=='dismiss-invite':con.execute('DELETE FROM invitations WHERE id=?',(iid,))
        return {'mode':r['mode'],'code':r['code']}
    target=data.get('target');kind=data.get('kind','id')
    if not isinstance(target,str) or kind not in ('name','id'):raise ProfileError(400,'invalid')
    if kind=='id':
        target=target.strip().upper()
        if not re.fullmatch('[A-Z0-9]{6}',target):raise ProfileError(400,'invalid_id')
        other=con.execute('SELECT id FROM users WHERE player_id=?',(target,)).fetchone()
    else:
        if not re.fullmatch('[A-Za-z0-9_-]{3,20}',target.strip()):raise ProfileError(400,'username')
        other=con.execute('SELECT id FROM users WHERE username=?',(target.strip(),)).fetchone()
    if not other:raise ProfileError(404,'player_missing')
    oid=other['id']
    if oid==uid:raise ProfileError(400,'self')
    a,b=sorted([uid,oid]);edge=con.execute('SELECT * FROM friendships WHERE a=? AND b=?',(a,b)).fetchone()
    if verb=='request':
        if edge:return {'ok':True}
        for user in (uid,oid):
            if con.execute('SELECT count(*) FROM friendships WHERE a=? OR b=?',(user,user)).fetchone()[0]>=200:raise ProfileError(409,'friend_limit')
        con.execute('INSERT INTO friendships VALUES (?,?,?,0,?)',(a,b,uid,now))
    elif verb=='accept':
        if not edge or edge['requester']==uid:raise ProfileError(403,'forbidden')
        con.execute('UPDATE friendships SET accepted=1 WHERE a=? AND b=?',(a,b))
    elif verb in ('decline','cancel','remove'):
        if not edge: return {'ok':True}
        if (verb=='decline' and (edge['accepted'] or edge['requester']==uid)) or (verb=='cancel' and (edge['accepted'] or edge['requester']!=uid)) or (verb=='remove' and not edge['accepted']):raise ProfileError(403,'forbidden')
        con.execute('DELETE FROM friendships WHERE a=? AND b=?',(a,b))
        con.execute('DELETE FROM invitations WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',(uid,oid,oid,uid))
    elif verb=='invite':
        if not edge or not edge['accepted']:raise ProfileError(403,'not_friends')
        mode,code,peer=data.get('mode'),data.get('code'),data.get('peer','')
        if mode not in ('local','web') or not isinstance(code,str) or not isinstance(peer,str):raise ProfileError(400,'invalid')
        if not re.fullmatch('[A-Z0-9]{8}' if mode=='web' else '[0-9]{6}',code):raise ProfileError(400,'invalid')
        if mode=='web':web_room(uid,code,peer)
        con.execute('INSERT INTO invitations VALUES (?,?,?,?,?,?,?) ON CONFLICT(sender,recipient) DO UPDATE SET id=excluded.id,mode=excluded.mode,code=excluded.code,peer=excluded.peer,expires=excluded.expires',(secrets.token_hex(16),uid,oid,mode,code,peer,now+300))
    else:raise ProfileError(404,'not_found')
    return {'ok':True}
