"""Account identities, versioned cloud state, and transactional name changes."""
import copy
import datetime
import json
import math
import re
import secrets
import string
import sqlite3
from moderation import blocked_username
import rankings
import progression
import tuning

TRACKS = ['circuit','snow','indoor','spa','monaco','monza','nurburgring','shanghai','switchback','hairpin']
DEFAULT_SAVE = dict(coins=0,xp=0,races=0,wins=0,podiums=0,t3=0,boxes=0,draftT=0,
                    f1={},claimed={},daily='',owned=[0,1],paint=0,best={},track='circuit',laps=3,comp=False,upgradesEnabled=True,category='kart',car='porsche',ownedCars=['porsche'],bestGT3={},botCount=3,botDifficulty='normal',botItems=False,botCars=['porsche','amg','ferrari','porsche','amg','ferrari'],**{'pass':{}})
PREFS = dict(quality='high',shadows=True,experimentalShaders=False,rearIndicator=True,glass=True,brightness=1,master=80,effects=80,musicVolume=50,music=True)
BINDS = dict(up=['KeyW','ArrowUp'],down=['KeyS','ArrowDown'],left=['KeyA','ArrowLeft'],right=['KeyD','ArrowRight'],drift=['Space',''],item=['KeyE',''],restart=['KeyR',''])
MISSION_REWARDS = progression.REWARDS
PRICES = [0,0,150,150,250,250,300,400,400,800]
CAR_PRICES = {'porsche':0,'amg':1500,'ferrari':2200,'bmw':1800,'aston':2400,'audi':2800,'lambo':3400,'mclaren':3800}
EXTRA_CARS = {'bmw','aston','audi','lambo','mclaren'}
TOOL_PRICES = {'customizer':15000}
CUSTOM_KEYS = ('ownedTools','paintMode','customPaint','savedPaints')
def valid_hex(value):return isinstance(value,str) and re.fullmatch(r'#[0-9a-f]{6}',value) is not None
PROFILE_BACKGROUNDS = {'purple':0,'blue':250,'teal':250,'red':250,'orange':350,'midnight':350}
AMBIENT = {'default':(0,1),'ocean':(3000,5),'forest':(6000,10),'sunset':(12000,20),'midnight':(20000,30)}
KART_PRICES = {'original':0,'apex':1500,'rally':2800,'vector':4500,'christmas':0}
tuning.configure(CAR_PRICES,KART_PRICES)
PROFILE_ICONS = {'helmet':0,'flag':300,'bolt':300,'star':350,'trophy':450,'crown':500}
DEFAULT_SAVE.update(botDifficulties=['normal']*6,mpBotCount=0,mpBotItems=False,mpBotCars=['porsche','amg','ferrari']*2,mpBotDifficulties=['normal']*6)
DEFAULT_SAVE['records']={}
DEFAULT_SAVE['upgrades']={}
DEFAULT_SAVE.update(ownedTools=[],paintMode='preset',customPaint='#e5b30e',savedPaints=[])
DEFAULT_SAVE.update(kartSkin='original',kartModel='original',ownedKarts=['original','christmas'],ambient='default',ownedAmbient=['default'])
QUICK_KEYS=('track','laps','comp','upgradesEnabled','category','botCount','botDifficulty','botItems','botCars','botDifficulties')
DEFAULT_SAVE['quickPlay']={**{key:copy.deepcopy(DEFAULT_SAVE[key]) for key in QUICK_KEYS},'useDaily':False}
DEFAULT_SAVE.update(profileBackground='purple',profileIcon='helmet',ownedProfileBackgrounds=['purple'],ownedProfileIcons=['helmet'])
KEYS = {'kart-save','kart-settings','kart-binds','kart-wheel','kart-language'}

class ProfileError(Exception):
    def __init__(self,status,code): self.status,self.code=status,code

def christmas_active():return datetime.datetime.now(datetime.timezone.utc).month==12

def defaults():
    return {'kart-save':json.dumps(DEFAULT_SAVE),'kart-settings':json.dumps(PREFS),
            'kart-binds':json.dumps(BINDS),'kart-wheel':'0','kart-language':'de'}

def upgrade_state(state, trusted=False):
    if state and isinstance(state,dict) and isinstance(state.get('kart-settings'),str):
        prefs=json.loads(state['kart-settings'])
        if isinstance(prefs,dict):
            prefs.setdefault('experimentalShaders',False)
            prefs.setdefault('rearIndicator',True)
            prefs.setdefault('glass',True)
            state={**state,'kart-settings':json.dumps(prefs)}
    if state and isinstance(state,dict) and isinstance(state.get('kart-save'),str):
        progress=json.loads(state['kart-save'])
        if not isinstance(progress,dict): raise ValueError('invalid progress')
        # Accept saved profiles and requests from clients predating tutorial removal.
        progress.pop('tutorial',None)
        for key,value in [('category','kart'),('car','porsche'),('bestGT3',{})]:
            progress.setdefault(key,value)
        progress.setdefault('ownedCars',list(dict.fromkeys(['porsche',progress['car']])) if trusted else ['porsche'])
        progress.setdefault('records',{})
        progress.setdefault('upgradesEnabled',True)
        progress['upgrades']=tuning.clean(progress.get('upgrades',{}))
        progress.setdefault('kartSkin','original')
        progress.setdefault('botDifficulties',[progress.get('botDifficulty','normal')]*6)
        progress.setdefault('quickPlay',{**{key:copy.deepcopy(progress.get(key,DEFAULT_SAVE[key])) for key in QUICK_KEYS},'useDaily':False})
        if isinstance(progress.get('quickPlay'),dict):progress['quickPlay'].setdefault('upgradesEnabled',True)
        for key in (*CUSTOM_KEYS,'upgrades','kartModel','ownedKarts','ambient','ownedAmbient','mpBotCount','mpBotItems','mpBotCars','mpBotDifficulties','botCount','botDifficulty','botItems','botCars','profileBackground','profileIcon','ownedProfileBackgrounds','ownedProfileIcons'):
            progress.setdefault(key,copy.deepcopy(DEFAULT_SAVE[key]))
        if isinstance(progress.get('ownedKarts'),list) and 'christmas' not in progress['ownedKarts']:progress['ownedKarts'].append('christmas')
        state={**state,'kart-save':json.dumps(progress)}
    return state

def migrate(con):
    columns={x[1] for x in con.execute('PRAGMA table_info(users)')}
    if 'account_id' not in columns: con.execute('ALTER TABLE users ADD COLUMN account_id TEXT')
    if 'player_id' not in columns: con.execute('ALTER TABLE users ADD COLUMN player_id TEXT')
    for row in con.execute('SELECT id FROM users WHERE account_id IS NULL').fetchall():
        con.execute('UPDATE users SET account_id=? WHERE id=?',(secrets.token_hex(16),row[0]))
    for row in con.execute('SELECT id FROM users WHERE player_id IS NULL').fetchall():
        con.execute('UPDATE users SET player_id=? WHERE id=?',(new_player_id(con),row[0]))
    con.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_player_id ON users(player_id)')
    con.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_account_id ON users(account_id)')
    con.executescript('''
    CREATE TABLE IF NOT EXISTS profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state TEXT, revision INTEGER NOT NULL DEFAULT 0, music BLOB, music_type TEXT);
    CREATE TABLE IF NOT EXISTS names(name TEXT PRIMARY KEY COLLATE NOCASE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS profile_requests(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,token TEXT NOT NULL,revision INTEGER NOT NULL,reward INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS immutable_account_id BEFORE UPDATE OF account_id,id ON users
      WHEN NEW.account_id IS NOT OLD.account_id OR NEW.id IS NOT OLD.id BEGIN SELECT RAISE(ABORT,'immutable identity'); END;
    CREATE TRIGGER IF NOT EXISTS require_account_id BEFORE INSERT ON users
      WHEN NEW.account_id IS NULL OR length(NEW.account_id)!=32 BEGIN SELECT RAISE(ABORT,'account identity required'); END;
    CREATE TRIGGER IF NOT EXISTS immutable_player_id BEFORE UPDATE OF player_id ON users
      WHEN NEW.player_id IS NOT OLD.player_id BEGIN SELECT RAISE(ABORT,'immutable player identity'); END;
    CREATE TRIGGER IF NOT EXISTS require_player_id BEFORE INSERT ON users
      WHEN NEW.player_id IS NULL OR length(NEW.player_id)!=6 OR NEW.player_id GLOB '*[^A-Z0-9]*'
      BEGIN SELECT RAISE(ABORT,'player identity required'); END;
    ''')
    con.execute('INSERT OR IGNORE INTO names SELECT username,id FROM users')
    con.execute('INSERT OR IGNORE INTO profiles(user_id) SELECT id FROM users')
    rankings.migrate(con)

def new_player_id(con):
    while True:
        value=''.join(secrets.choice(string.ascii_uppercase+string.digits) for _ in range(6))
        if not con.execute('SELECT 1 FROM users WHERE player_id=?',(value,)).fetchone():return value

def account(con,uid):
    import devtools
    row=con.execute('SELECT username,player_id,state,revision,music IS NOT NULL AS has_music FROM users JOIN profiles ON user_id=users.id WHERE users.id=?',(uid,)).fetchone()
    return dict(username=row['username'],id=row['player_id'],state=upgrade_state(json.loads(row['state']),trusted=True) if row['state'] else None,
                recordReviews=[dict(r) for r in con.execute('SELECT key,milliseconds,status FROM record_reviews WHERE user_id=? ORDER BY id DESC',(uid,))],revision=row['revision'],music=bool(row['has_music']),developer=devtools.status(con,uid))

def validate(state):
    def fail(): raise ProfileError(400,'invalid_state')
    if not isinstance(state,dict) or set(state)!=KEYS or any(not isinstance(v,str) for v in state.values()): fail()
    try:
        state=upgrade_state(state)
        s=json.loads(state['kart-save']);p=json.loads(state['kart-settings']);b=json.loads(state['kart-binds'])
        if not isinstance(s,dict) or set(s)!=set(DEFAULT_SAVE): fail()
        for k in ['coins','xp','races','wins','podiums','t3','boxes']:
            if type(s[k])!=int or not 0<=s[k]<=10**12: fail()
        if not isinstance(s['records'],dict) or len(s['records'])>len(rankings.CARS)*len(rankings.MODES)*len(TRACKS):fail()
        for key,value in s['records'].items():
            rankings.parse_key(key)
            if type(value) not in (int,float) or not math.isfinite(value) or not 0<value<10**7:fail()
        if not s['wins']<=s['podiums']<=s['races']: fail()
        if type(s['draftT']) not in (int,float) or not math.isfinite(s['draftT']) or not 0<=s['draftT']<=10**12: fail()
        for k,allowed in [('f1',TRACKS[3:]),('claimed',MISSION_REWARDS),('pass',progression.LEVEL_REWARDS),('best',TRACKS),('bestGT3',TRACKS)]:
            if not isinstance(s[k],dict) or any(x not in allowed for x in s[k]): fail()
            for v in s[k].values():
                if k in ('best','bestGT3'):
                    if type(v) not in (int,float) or not math.isfinite(v) or not 0<v<10**7: fail()
                elif type(v)!=int or v!=1: fail()
        if not isinstance(s['daily'],str): fail()
        if s['daily']: datetime.date(*map(int,s['daily'].split('-')))
        if not isinstance(s['owned'],list) or not {0,1}.issubset(s['owned']) or any(type(x)!=int or not 0<=x<len(PRICES) for x in s['owned']) or len(set(s['owned']))!=len(s['owned']): fail()
        if type(s['paint'])!=int or s['paint'] not in s['owned'] or s['track'] not in TRACKS or s['laps'] not in [1,3,5] or type(s['comp'])!=bool or type(s['upgradesEnabled'])!=bool: fail()
        if s['category'] not in ('kart','gt3') or s['car'] not in CAR_PRICES: fail()
        if not isinstance(s['ownedCars'],list) or not 1<=len(s['ownedCars'])<=len(CAR_PRICES) or any(not isinstance(x,str) or x not in CAR_PRICES for x in s['ownedCars']) or len(set(s['ownedCars']))!=len(s['ownedCars']) or 'porsche' not in s['ownedCars'] or s['car'] not in s['ownedCars']: fail()
        if type(s['botCount'])!=int or not 0<=s['botCount']<=6 or s['botDifficulty'] not in ('easy','normal','hard') or type(s['botItems'])!=bool: fail()
        if not isinstance(s['botCars'],list) or len(s['botCars'])!=6 or any(not isinstance(x,str) or x not in CAR_PRICES for x in s['botCars']): fail()
        for key in ('botDifficulties','mpBotDifficulties'):
            if not isinstance(s[key],list) or len(s[key])!=6 or any(v not in ('easy','normal','hard') for v in s[key]):fail()
        if type(s['mpBotCount'])!=int or not 0<=s['mpBotCount']<=6 or type(s['mpBotItems'])!=bool:fail()
        if s['kartSkin'] not in ('original','christmas'):fail()
        for selected,owned,choices,starter in [('kartModel','ownedKarts',KART_PRICES,'original'),('ambient','ownedAmbient',AMBIENT,'default')]:
            values=s[owned]
            if not isinstance(values,list) or not 1<=len(values)<=len(choices) or any(not isinstance(v,str) or v not in choices for v in values) or len(set(values))!=len(values) or starter not in values or s[selected] not in values:fail()
        q=s['quickPlay']
        if not isinstance(q,dict) or set(q)!={*QUICK_KEYS,'useDaily'}:fail()
        if q['track'] not in TRACKS or type(q['laps'])!=int or q['laps'] not in (1,3,5) or q['category'] not in ('kart','gt3'):fail()
        if any(type(q[k])!=bool for k in ('comp','upgradesEnabled','botItems','useDaily')):fail()
        if type(q['botCount'])!=int or not 0<=q['botCount']<=6 or q['botDifficulty'] not in ('easy','normal','hard'):fail()
        if not isinstance(q['botCars'],list) or len(q['botCars'])!=6 or any(v not in CAR_PRICES for v in q['botCars']):fail()
        if not isinstance(q['botDifficulties'],list) or len(q['botDifficulties'])!=6 or any(v not in ('easy','normal','hard') for v in q['botDifficulties']):fail()
        if not isinstance(s['mpBotCars'],list) or len(s['mpBotCars'])!=6 or any(v not in CAR_PRICES for v in s['mpBotCars']):fail()
        for key,owned,prices,starter in [('profileBackground','ownedProfileBackgrounds',PROFILE_BACKGROUNDS,'purple'),('profileIcon','ownedProfileIcons',PROFILE_ICONS,'helmet')]:
            values=s[owned]
            if not isinstance(values,list) or not 1<=len(values)<=len(prices) or any(not isinstance(v,str) or v not in prices for v in values) or len(values)!=len(set(values)) or starter not in values or s[key] not in values:fail()
        if not isinstance(s['ownedTools'],list) or len(s['ownedTools'])>len(TOOL_PRICES) or any(not isinstance(v,str) or v not in TOOL_PRICES for v in s['ownedTools']) or len(set(s['ownedTools']))!=len(s['ownedTools']):fail()
        if s['paintMode'] not in ('preset','custom') or (s['paintMode']=='custom' and 'customizer' not in s['ownedTools']):fail()
        if not valid_hex(s['customPaint']):fail()
        if not isinstance(s['savedPaints'],list) or len(s['savedPaints'])>8 or any(not valid_hex(v) for v in s['savedPaints']) or len(set(s['savedPaints']))!=len(s['savedPaints']):fail()
        if not isinstance(p,dict) or set(p)!=set(PREFS) or p['quality'] not in ['low','medium','high']: fail()
        for k in ['shadows','music','experimentalShaders','rearIndicator','glass']:
            if type(p[k])!=bool: fail()
        if p['experimentalShaders'] and p['quality']!='high':fail()
        for k in ['brightness','master','effects','musicVolume']:
            if type(p[k]) not in (int,float) or not math.isfinite(p[k]) or not (0.6<=p[k]<=1.5 if k=='brightness' else 0<=p[k]<=100): fail()
        if not isinstance(b,dict) or set(b)!=set(BINDS): fail()
        if any(not isinstance(v,list) or len(v)!=2 or any(not isinstance(x,str) or not re.fullmatch('[A-Za-z0-9]{0,32}',x) for x in v) for v in b.values()): fail()
        if state['kart-wheel'] not in ['0','1','2'] or state['kart-language'] not in ['de','en','fr']: fail()
    except (ValueError,TypeError,KeyError,OverflowError): fail()
    return state

def owns_record_car(progress,car):return car=='kart' or (car.startswith('kart-') and car[5:] in progress['ownedKarts']) or car in progress['ownedCars']

def transition(old,new,allow_christmas=False):
    """Reject direct coin edits/refunds. Race results remain client-reported."""
    a,b=json.loads(old['kart-save']),json.loads(new['kart-save'])
    if a['upgrades']!=b['upgrades']:raise ProfileError(400,'invalid_ownership')
    if b['kartModel']!=a['kartModel'] and b['kartModel']=='christmas' and not (christmas_active() or allow_christmas):raise ProfileError(400,'season')
    if b['kartSkin']!=a['kartSkin'] and b['kartSkin']=='christmas' and not (christmas_active() or allow_christmas):raise ProfileError(400,'season')
    for key,value in b['records'].items():
        if value<a['records'].get(key,float('inf')):
            _,car,_=rankings.parse_key(key)
            if not owns_record_car(b,car):raise ProfileError(400,'invalid_ownership')
    if set(a['ownedCars'])!=set(b['ownedCars']): raise ProfileError(400,'invalid_ownership')
    if any(set(a[k])!=set(b[k]) for k in ('ownedProfileBackgrounds','ownedProfileIcons','ownedKarts','ownedAmbient','ownedTools')):raise ProfileError(400,'invalid_ownership')
    if any(b[k]<a[k] for k in ['xp','races','wins','podiums','t3','boxes','draftT']): raise ProfileError(400,'invalid_state')
    if any(not set(a[k]).issubset(b[k]) for k in ['claimed','pass','f1','owned']): raise ProfileError(400,'invalid_state')
    for key in b['claimed']:
        if key not in a['claimed'] and not progression.completed(b,key):raise ProfileError(400,'mission_locked')
    for key in b['pass']:
        if key not in a['pass'] and b['xp']//250+1<int(key):raise ProfileError(400,'level')
    gains=(b['races']-a['races'])*400
    gains+=sum(v for k,v in MISSION_REWARDS.items() if k in b['claimed'] and k not in a['claimed'])
    gains+=sum(progression.LEVEL_REWARDS[k] for k in b['pass'] if k not in a['pass'])
    if b['daily']!=a['daily']:
        date=datetime.date(*map(int,b['daily'].split('-'))) if b['daily'] else None
        now=datetime.datetime.now(datetime.timezone.utc).date()
        if date is None or abs((date-now).days)>1 or (a['daily'] and date<=datetime.date(*map(int,a['daily'].split('-')))): raise ProfileError(400,'invalid_state')
        gains+=50
    spent=sum(PRICES[x] for x in b['owned'] if x not in a['owned'])
    if b['coins']>a['coins']+gains-spent: raise ProfileError(400,'invalid_balance')

def save(con,uid,data):
    con.execute('BEGIN IMMEDIATE')
    current=account(con,uid)
    allow_christmas=current['developer']['christmasPreview']
    token=data.get('requestId')
    if token is not None:
        if not isinstance(token,str) or not re.fullmatch('[a-f0-9]{32}',token):raise ProfileError(400,'invalid')
        receipt=con.execute('SELECT * FROM profile_requests WHERE user_id=? AND token=?',(uid,token)).fetchone()
        if receipt:
            if current['revision']!=receipt['revision']:raise ProfileError(409,'conflict')
            return dict(current,recordReward=receipt['reward']) if receipt['reward'] else current
    if type(data.get('revision'))!=int or data['revision']!=current['revision']: raise ProfileError(409,'conflict')
    # An already-open pre-GT3 client must not erase newer selections or records.
    state=data.get('state')
    try:
        progress=json.loads(state['kart-save'])
        if not isinstance(progress,dict): raise ValueError()
        prefs=json.loads(state['kart-settings'])
        if not isinstance(prefs,dict):raise ValueError()
        if 'glass' not in prefs:
            old_prefs=json.loads(current['state']['kart-settings']) if current['state'] else PREFS
            prefs['glass']=old_prefs.get('glass',True)
        if 'rearIndicator' not in prefs:
            old_prefs=json.loads(current['state']['kart-settings']) if current['state'] else PREFS
            prefs['rearIndicator']=old_prefs.get('rearIndicator',True)
        if 'experimentalShaders' not in prefs:
            old_prefs=json.loads(current['state']['kart-settings']) if current['state'] else PREFS
            prefs['experimentalShaders']=old_prefs['experimentalShaders'] if prefs.get('quality')=='high' else False
        if current['state'] is not None:
            previous=json.loads(current['state']['kart-save']);legacy='ownedCars' not in progress
            if 'ownedTools' not in progress and isinstance(progress.get('ownedCars'),list):
                progress['ownedCars']=list(dict.fromkeys(progress['ownedCars']+[v for v in previous['ownedCars'] if v in EXTRA_CARS]))
                if previous['car'] in EXTRA_CARS:progress['car']=previous['car']
                for key in ('botCars','mpBotCars'):
                    if isinstance(progress.get(key),list) and len(progress[key])==6:
                        progress[key]=[old if old in EXTRA_CARS else new for old,new in zip(previous[key],progress[key])]
                q=progress.get('quickPlay')
                if isinstance(q,dict) and isinstance(q.get('botCars'),list) and len(q['botCars'])==6:
                    q['botCars']=[old if old in EXTRA_CARS else new for old,new in zip(previous['quickPlay']['botCars'],q['botCars'])]
            if isinstance(progress.get('quickPlay'),dict):progress['quickPlay'].setdefault('upgradesEnabled',previous['quickPlay']['upgradesEnabled'])
            for key in (*CUSTOM_KEYS,'upgradesEnabled','upgrades','kartModel','ownedKarts','ambient','ownedAmbient','kartSkin','quickPlay','records','botDifficulties','mpBotCount','mpBotItems','mpBotCars','mpBotDifficulties','category','car','bestGT3','ownedCars','botCount','botDifficulty','botItems','botCars','profileBackground','profileIcon','ownedProfileBackgrounds','ownedProfileIcons'):
                if key not in progress:progress[key]=previous[key]
            if legacy and progress.get('car') not in progress['ownedCars']:progress['car']=previous['car']
        state={**state,'kart-save':json.dumps(progress),'kart-settings':json.dumps(prefs)}
    except (ValueError,TypeError,KeyError): raise ProfileError(400,'invalid_state')
    state=validate(state)
    if current['state'] is not None: transition(current['state'],state,allow_christmas)
    elif json.loads(state['kart-save'])['ownedCars']!=['porsche']: raise ProfileError(400,'invalid_ownership')
    elif current['state'] is None and any(json.loads(state['kart-save'])[k]!=DEFAULT_SAVE[k] for k in ('ownedProfileBackgrounds','ownedProfileIcons','ownedKarts','ownedAmbient','ownedTools','upgrades')):raise ProfileError(400,'invalid_ownership')
    if current['state'] is None:
        progress=json.loads(state['kart-save'])
        if (progress['kartSkin']=='christmas' or progress['kartModel']=='christmas') and not (christmas_active() or allow_christmas):raise ProfileError(400,'season')
        for key in progress['records']:
            if not owns_record_car(progress,rankings.parse_key(key)[1]):raise ProfileError(400,'invalid_ownership')
    incoming=json.loads(state['kart-save']);previous=json.loads(current['state']['kart-save']) if current['state'] else {}
    for key,value in incoming['records'].items():
        if value!=previous.get('records',{}).get(key) and not (0<value<20 or rankings.plausible(key,value)):raise ProfileError(400,'invalid_record')
    for field,car in [('best','kart'),('bestGT3','porsche')]:
        for track,value in incoming[field].items():
            if value!=previous.get(field,{}).get(track) and not 0<value<20 and value<rankings.minimum(track,'luckyblock',car):raise ProfileError(400,'invalid_record')
    attempts=data.get('raceRecords',[])
    if not isinstance(attempts,list) or len(attempts)>20:raise ProfileError(400,'invalid_record')
    for entry in attempts:
        try:
            if not isinstance(entry,dict) or type(entry.get('season'))!=int or not (type(entry.get('seconds')) in (int,float) and 0<entry['seconds']<20 or rankings.plausible(entry.get('key'),entry.get('seconds'))):raise ValueError()
            if not owns_record_car(incoming,rankings.parse_key(entry['key'])[1]):raise ValueError()
        except (ValueError,TypeError,KeyError):raise ProfileError(400,'invalid_record')
    reward=rankings.record(con,uid,state,rewards=True)
    for entry in attempts:
        if entry['seconds']>=20:reward+=rankings.record(con,uid,{'kart-save':json.dumps({'records':{entry['key']:entry['seconds']}})},rewards=True)
    rankings.seasonal_record(con,uid,attempts)
    if reward:
        progress=json.loads(state['kart-save']);reward=min(reward,10**12-progress['coins']);progress['coins']+=reward;state['kart-save']=json.dumps(progress)
    con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    result=account(con,uid)
    if token:con.execute('INSERT INTO profile_requests VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token,revision=excluded.revision,reward=excluded.reward',(uid,token,result['revision'],reward))
    return dict(result,recordReward=reward) if reward else result

def buy_car(con,uid,data):
    car=data.get('car')
    if not isinstance(car,str) or car not in CAR_PRICES: raise ProfileError(400,'invalid_car')
    con.execute('BEGIN IMMEDIATE')
    current=account(con,uid);state=current['state'] or defaults();progress=json.loads(state['kart-save'])
    # Retrying a successful request must never charge twice.
    if car in progress['ownedCars']:return current
    if type(data.get('revision'))!=int or data['revision']!=current['revision']:raise ProfileError(409,'conflict')
    if progress['coins']<CAR_PRICES[car]:raise ProfileError(409,'coins')
    progress['coins']-=CAR_PRICES[car];progress['ownedCars'].append(car)
    state['kart-save']=json.dumps(progress)
    con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    return account(con,uid)

def buy_cosmetic(con,uid,data):
    kind,item=data.get('kind'),data.get('item')
    if kind not in ('background','icon','ambient','kart','tool') or not isinstance(item,str):raise ProfileError(400,'invalid_item')
    prices,owned={'background':(PROFILE_BACKGROUNDS,'ownedProfileBackgrounds'),'icon':(PROFILE_ICONS,'ownedProfileIcons'),'ambient':({k:v[0] for k,v in AMBIENT.items()},'ownedAmbient'),'kart':(KART_PRICES,'ownedKarts'),'tool':(TOOL_PRICES,'ownedTools')}[kind]
    if item not in prices:raise ProfileError(400,'invalid_item')
    con.execute('BEGIN IMMEDIATE')
    current=account(con,uid);state=current['state'] or defaults();progress=json.loads(state['kart-save'])
    if item in progress[owned]:return current
    if type(data.get('revision'))!=int or data['revision']!=current['revision']:raise ProfileError(409,'conflict')
    if kind=='ambient' and progress['xp']//250+1<AMBIENT[item][1]:raise ProfileError(409,'level')
    if progress['coins']<prices[item]:raise ProfileError(409,'coins')
    progress['coins']-=prices[item];progress[owned].append(item);state['kart-save']=json.dumps(progress)
    con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    return account(con,uid)

def rename(con,uid,data):
    name=data.get('username')
    if not isinstance(name,str) or not re.fullmatch('[A-Za-z0-9_-]{3,20}',name): raise ProfileError(400,'username')
    if blocked_username(name): raise ProfileError(400,'blocked')
    con.execute('BEGIN IMMEDIATE')
    current=account(con,uid)
    if name==current['username']: return current
    if type(data.get('revision'))!=int or data['revision']!=current['revision']: raise ProfileError(409,'conflict')
    owner=con.execute('SELECT user_id FROM names WHERE name=?',(name,)).fetchone()
    if owner and owner['user_id']!=uid: raise ProfileError(409,'taken')
    state=current['state'] or defaults();progress=json.loads(state['kart-save'])
    if progress['coins']<2000: raise ProfileError(409,'coins')
    progress['coins']-=2000;state['kart-save']=json.dumps(progress)
    con.execute('DELETE FROM names WHERE user_id=?',(uid,))
    con.execute('INSERT INTO names VALUES (?,?)',(name,uid))
    con.execute('UPDATE users SET username=? WHERE id=?',(name,uid))
    con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    return account(con,uid)
