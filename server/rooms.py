"""Ephemeral WebRTC signaling. No race state or persistent IP storage."""
import re
import secrets
import string
import threading
import time

class RoomError(Exception):
    def __init__(self, status, code): self.status, self.code = status, code

class Broker:
    @staticmethod
    def category(data, key='category', default='kart'):
        value=data.get(key,default)
        if value not in ('kart','gt3'):raise RoomError(400,'invalid_class')
        return value

    @staticmethod
    def accepts(room, category):
        return room['mixed_classes'] or category==room['category']

    def __init__(self, clock=time.monotonic):
        self.rooms = {}
        self.rates = {}
        self.clock = clock
        self.lock = threading.Lock()

    def prune(self, now):
        for code, room in list(self.rooms.items()):
            if now-room['members'][room['host']]['seen'] > 180:
                del self.rooms[code]; continue
            for peer, member in list(room['members'].items()):
                if peer != room['host'] and now-member['seen'] > 180:
                    del room['members'][peer]
        self.rates = {k:v for k,v in self.rates.items() if v[1]>now}

    def rate(self, key, limit, now):
        count, until = self.rates.get(key, (0, now+60))
        if count >= limit: raise RoomError(429,'rate')
        self.rates[key] = (count+1,until)

    def observer(self,uid,data):
        with self.lock:
            m=self.rooms.get(data.get('code'),{}).get('members',{}).get(data.get('peer'),{})
            return m.get('uid')==uid and m.get('observer',False)

    def call(self, action, uid, data, admin=False):
        with self.lock:
            now=self.clock();self.prune(now)
            if action in ('create','join','watch'):
                self.rate(('entry',uid),30,now)
            if action=='watch' and not admin:raise RoomError(403,'forbidden')
            if action=='create':
                category=self.category(data);driver_class=self.category(data,'driverClass',category)
                mixed=data.get('mixedClasses',False)
                if type(mixed)!=bool:raise RoomError(400,'invalid')
                if not mixed and driver_class!=category:raise RoomError(409,'class_'+category)
                if len(self.rooms)>=500: raise RoomError(503,'busy')
                if sum(any(m['uid']==uid for m in r['members'].values()) for r in self.rooms.values())>=3:
                    raise RoomError(409,'room_limit')
                while True:
                    code=''.join(secrets.choice(string.ascii_uppercase+string.digits) for _ in range(8))
                    if code not in self.rooms and any(c.isdigit() for c in code) and any(c.isalpha() for c in code): break
                peer=secrets.token_hex(16)
                self.rooms[code]={'host':peer,'members':{peer:{'uid':uid,'seen':now,'queue':[],'category':driver_class}},'seq':0,'locked':False,'guest_invites':False,'category':category,'mixed_classes':mixed}
                return {'code':code,'peer':peer,'host':peer}
            code=data.get('code')
            if not isinstance(code,str) or not re.fullmatch('[A-Z0-9]{8}',code): raise RoomError(400,'code')
            room=self.rooms.get(code)
            if not room: raise RoomError(404,'room_missing')
            if action in ('join','watch'):
                observer=action=='watch'
                category=self.category(data)
                if not observer and not self.accepts(room,category):raise RoomError(409,'class_'+room['category'])
                if room['locked'] and not observer: raise RoomError(409,'race_started')
                if not observer and sum(not m.get('observer',False) for m in room['members'].values())>=7: raise RoomError(409,'room_full')
                if observer and sum(m.get('observer',False) for m in room['members'].values())>=16:raise RoomError(409,'room_full')
                if sum(m['uid']==uid for m in room['members'].values())>=2: raise RoomError(409,'room_limit')
                peer=secrets.token_hex(16)
                room['members'][peer]={'uid':uid,'seen':now,'queue':[],'observer':observer,'category':category}
                return {'code':code,'peer':peer,'host':room['host'],'observer':observer}
            peer=data.get('peer')
            if not isinstance(peer,str): raise RoomError(403,'forbidden')
            member=room['members'].get(peer)
            if not member or member['uid']!=uid: raise RoomError(403,'forbidden')
            member['seen']=now
            if action=='poll':
                self.rate(('poll',peer),120,now)
                after=data.get('after',0)
                if type(after)!=int or after<0 or after>room['seq']: raise RoomError(400,'invalid')
                member['queue']=[x for x in member['queue'] if x['seq']>after]
                return {'messages':member['queue'],'peers':list(room['members']),'classes':{p:m['category'] for p,m in room['members'].items() if not m.get('observer',False)},'policy':{'category':room['category'],'mixedClasses':room['mixed_classes']},'observers':[p for p,m in room['members'].items() if m.get('observer',False)] if peer==room['host'] else []}
            if action=='leave':
                if peer==room['host']: del self.rooms[code]
                else: del room['members'][peer]
                return {'ok':True}
            if action=='lock':
                if peer!=room['host']: raise RoomError(403,'forbidden')
                if type(data.get('locked'))!=bool: raise RoomError(400,'invalid')
                if data['locked'] and any(not m.get('observer',False) and not self.accepts(room,m['category']) for m in room['members'].values()):raise RoomError(409,'class_mismatch')
                room['locked']=data['locked'];return {'ok':True}
            if action=='class-policy':
                if peer!=room['host']:raise RoomError(403,'forbidden')
                if room['locked']:raise RoomError(409,'race_started')
                category=self.category(data)
                if type(data.get('mixedClasses'))!=bool:raise RoomError(400,'invalid')
                room['category']=category;room['mixed_classes']=data['mixedClasses']
                return {'ok':True}
            if action=='vehicle-class':
                if room['locked']:raise RoomError(409,'race_started')
                if member.get('observer',False):raise RoomError(403,'forbidden')
                category=self.category(data)
                if not self.accepts(room,category):raise RoomError(409,'class_'+room['category'])
                member['category']=category
                return {'ok':True}
            if action=='invite-policy':
                if peer!=room['host']:raise RoomError(403,'forbidden')
                if type(data.get('allowed'))!=bool:raise RoomError(400,'invalid')
                if room['locked']:raise RoomError(409,'race_started')
                room['guest_invites']=data['allowed'];return {'ok':True}
            if action=='signal':
                self.rate(('signal',peer),150,now)
                target=data.get('to');message=data.get('message')
                if not isinstance(target,str) or target not in room['members'] or target==peer: raise RoomError(400,'invalid')
                if peer!=room['host'] and target!=room['host']: raise RoomError(403,'forbidden')
                if not isinstance(message,dict): raise RoomError(400,'invalid')
                kind=message.get('type')
                if kind in ('offer','answer'):
                    if (kind=='offer') != (peer!=room['host']): raise RoomError(403,'forbidden')
                    sdp=message.get('sdp')
                    if not isinstance(sdp,str) or not sdp.startswith('v=0') or len(sdp)>32000: raise RoomError(400,'invalid')
                    clean={'type':kind,'sdp':sdp}
                elif kind=='ice':
                    candidate=message.get('candidate')
                    if not isinstance(candidate,dict): raise RoomError(400,'invalid')
                    text=candidate.get('candidate');mid=candidate.get('sdpMid');index=candidate.get('sdpMLineIndex')
                    if not isinstance(text,str) or len(text)>2000 or (mid is not None and (not isinstance(mid,str) or len(mid)>128)) or (index is not None and (type(index)!=int or not 0<=index<32)):
                        raise RoomError(400,'invalid')
                    clean={'type':'ice','candidate':{'candidate':text,'sdpMid':mid,'sdpMLineIndex':index}}
                else: raise RoomError(400,'invalid')
                queue=room['members'][target]['queue']
                if len(queue)>=256: raise RoomError(429,'rate')
                room['seq']+=1;queue.append({'seq':room['seq'],'from':peer,'message':clean})
                return {'ok':True}
            raise RoomError(404,'not_found')

broker=Broker()
