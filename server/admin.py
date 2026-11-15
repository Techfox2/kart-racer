"""ID-bound moderation. Seed existing named accounts exactly once, never on signup."""
import re
import time
import json
import profiles
from profiles import ProfileError

LEVEL={'admin':1,'head':2,'founder':3}

def migrate(con,role_seeds=None):
    con.executescript('''
    CREATE TABLE IF NOT EXISTS admin_roles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS account_blocks(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS admin_events(id INTEGER PRIMARY KEY,created INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_migrations(name TEXT PRIMARY KEY);
    ''')
    if 'details' not in {r[1] for r in con.execute('PRAGMA table_info(admin_events)')}:
        con.execute("ALTER TABLE admin_events ADD COLUMN details TEXT NOT NULL DEFAULT '{}'")
        con.commit()
    if 'role' not in {r[1] for r in con.execute('PRAGMA table_info(admin_roles)')}:
        con.execute("ALTER TABLE admin_roles ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','head','founder'))")
        con.commit()
    con.execute("CREATE UNIQUE INDEX IF NOT EXISTS one_founder ON admin_roles(role) WHERE role='founder'")
    con.execute('BEGIN IMMEDIATE')
    if not con.execute("SELECT 1 FROM admin_migrations WHERE name='initial-admins'").fetchone():
        con.execute("INSERT OR IGNORE INTO admin_roles(user_id) SELECT id FROM users WHERE username COLLATE NOCASE IN ('MrBucks','MrBucks2','Anton')")
        con.execute("INSERT INTO admin_migrations VALUES ('initial-admins')")
    if role_seeds is not None and not con.execute("SELECT 1 FROM admin_migrations WHERE name='role-hierarchy-v1'").fetchone():
        if not isinstance(role_seeds,dict) or list(role_seeds.values()).count('founder')!=1 or any(not re.fullmatch('[A-Z0-9]{6}',pid) or role not in LEVEL for pid,role in role_seeds.items()):raise ValueError('Invalid role seed identities')
        for pid,value in role_seeds.items():
            row=con.execute('SELECT a.user_id FROM admin_roles a JOIN users u ON u.id=a.user_id WHERE u.player_id=?',(pid,)).fetchone()
            if not row:raise ValueError('Role seed must refer to an existing admin identity')
            con.execute('UPDATE admin_roles SET role=? WHERE user_id=?',(value,row[0]))
        con.execute("INSERT INTO admin_migrations VALUES ('role-hierarchy-v1')")

def role(con,uid):
    r=con.execute('SELECT role FROM admin_roles WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE user_id=?)',(uid,uid)).fetchone()
    return r[0] if r else None

def allowed(con,uid):
    return bool(role(con,uid))

def protect(con,uid,target,action):
    actor=role(con,uid);target_role=con.execute('SELECT role FROM admin_roles WHERE user_id=?',(target,)).fetchone()
    target_role=target_role[0] if target_role else None
    if action=='role' and actor=='admin':raise ProfileError(403,'forbidden')
    if target_role=='founder' and action!='inventory':raise ProfileError(403,'founder_protected')
    if action=='inventory' and uid==target:return
    if LEVEL.get(target_role,0)>=LEVEL.get(actor,0):raise ProfileError(403,'higher_role')

def require(con,uid):
    if not allowed(con,uid):raise ProfileError(403,'forbidden')

def event(con,uid,action,target,details=None):
    actor=con.execute('SELECT player_id FROM users WHERE id=?',(uid,)).fetchone()[0]
    con.execute('INSERT INTO admin_events(created,actor,action,target,details) VALUES (?,?,?,?,?)',(int(time.time()),actor,action,target,json.dumps(details or {})))

def overview(con,uid,data,broker):
    require(con,uid)
    query=data.get('query','')
    status=data.get('status','all')
    if not isinstance(query,str) or len(query)>20 or status not in ('all','online','offline'):raise ProfileError(400,'invalid')
    # instr uses literal characters, not user-controlled SQL wildcard syntax.
    rows=con.execute('''SELECT * FROM (SELECT u.id,u.player_id,u.username,a.role,
        a.user_id IS NOT NULL AS admin,EXISTS(SELECT 1 FROM account_blocks b WHERE b.user_id=u.id) AS blocked,
        EXISTS(SELECT 1 FROM activity p WHERE p.user_id=u.id AND p.seen>?) AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE b.user_id=u.id) AS online
        FROM users u LEFT JOIN admin_roles a ON a.user_id=u.id
        WHERE instr(lower(u.username),lower(?))>0 OR lower(u.player_id)=lower(?))
        WHERE ?='all' OR online=? ORDER BY admin DESC,username LIMIT 100''',(int(time.time())-90,query.strip(),query.strip(),status,int(status=='online'))).fetchall()
    import devtools
    users=[dict(developer=devtools.status(con,r['id'])['role'],id=r['player_id'],username=r['username'],admin=bool(r['admin']),role=r['role'],blocked=bool(r['blocked']),online=bool(r['online'])) for r in rows]
    with broker.lock:
        broker.prune(broker.clock())
        snapshots=[(code,r['members'][r['host']]['uid'],r['locked'],[m['uid'] for m in r['members'].values()]) for code,r in broker.rooms.items()]
    def person(user_id):
        r=con.execute('SELECT player_id,username FROM users WHERE id=?',(user_id,)).fetchone()
        return dict(id=r['player_id'],username=r['username']) if r else None
    rooms=[dict(code=code,host=person(host),locked=locked,members=[p for p in map(person,members) if p]) for code,host,locked,members in snapshots]
    audit=[dict(r) for r in con.execute('SELECT created,actor,action,target,details FROM admin_events ORDER BY id DESC LIMIT 30')]
    for entry in audit:entry['details']=json.loads(entry['details'])
    return dict(reviews=[dict(r) for r in con.execute("SELECT v.*,u.username,u.player_id FROM record_reviews v JOIN users u ON u.id=v.user_id WHERE v.status='pending' ORDER BY v.id LIMIT 200")],users=users,rooms=rooms,audit=audit,myRole=role(con,uid))

def action(con,uid,name,data,broker):
    con.execute('BEGIN IMMEDIATE')
    require(con,uid)
    if name=='review-record':
        import rankings
        return rankings.review(con,uid,data)
    if name=='reset-season':
        import rankings
        before=rankings.season(con)
        if data.get('season')!=before['id']:raise ProfileError(409,'conflict')
        after=rankings.season(con,reset=True);event(con,uid,name,'season',{'previousSeason':before['id'],'season':after['id']});return after
    if name=='list':return overview(con,uid,data,broker)
    if name in ('inventory','inventory-save'):return inventory(con,uid,name,data)
    if name=='close-room':
        code=data.get('code')
        if not isinstance(code,str) or not re.fullmatch('[A-Z0-9]{8}',code):raise ProfileError(400,'invalid')
        with broker.lock:
            if code not in broker.rooms:raise ProfileError(404,'room_missing')
            del broker.rooms[code]
        event(con,uid,name,code)
        return {'ok':True}
    pid=data.get('id');enabled=data.get('enabled')
    if not isinstance(pid,str) or not re.fullmatch('[A-Z0-9]{6}',pid) or type(enabled)!=bool:raise ProfileError(400,'invalid')
    target=con.execute('SELECT id FROM users WHERE player_id=?',(pid,)).fetchone()
    if not target:raise ProfileError(404,'not_found')
    target=target[0]
    protect(con,uid,target,name)
    if name=='role':
        if enabled:
            value=data.get('role','admin')
            if value not in ('admin','head') or value=='head' and role(con,uid)!='founder':raise ProfileError(403,'forbidden')
            if con.execute('SELECT 1 FROM account_blocks WHERE user_id=?',(target,)).fetchone():raise ProfileError(409,'blocked_account')
            con.execute('INSERT INTO admin_roles(user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',(target,value))
        else:
            if allowed(con,target) and con.execute('SELECT count(*) FROM admin_roles').fetchone()[0]<=1:raise ProfileError(409,'last_admin')
            con.execute('DELETE FROM admin_roles WHERE user_id=?',(target,))
    elif name=='suspend':
        if enabled:
            con.execute('INSERT OR IGNORE INTO account_blocks VALUES (?)',(target,))
            con.execute('DELETE FROM sessions WHERE user_id=?',(target,))
            with broker.lock:
                for code,r in list(broker.rooms.items()):
                    if r['members'][r['host']]['uid']==target:del broker.rooms[code]
                    else:
                        for peer,m in list(r['members'].items()):
                            if m['uid']==target:del r['members'][peer]
        else:con.execute('DELETE FROM account_blocks WHERE user_id=?',(target,))
    else:raise ProfileError(404,'not_found')
    event(con,uid,name+('-on' if enabled else '-off'),pid,{'role':data.get('role','admin')} if name=='role' and enabled else None)
    return {'ok':True}

def inventory(con,uid,name,data):
    pid=data.get('id')
    if not isinstance(pid,str) or not re.fullmatch('[A-Z0-9]{6}',pid):raise ProfileError(400,'invalid')
    target=con.execute('SELECT id FROM users WHERE player_id=?',(pid,)).fetchone()
    if not target:raise ProfileError(404,'not_found')
    target=target[0];protect(con,uid,target,'inventory');current=profiles.account(con,target);state=current['state'] or profiles.defaults();progress=json.loads(state['kart-save'])
    keys=('owned','ownedCars','ownedProfileBackgrounds','ownedProfileIcons','ownedKarts','ownedAmbient','ownedTools')
    selections=[('paint','owned',0),('car','ownedCars','porsche'),('profileBackground','ownedProfileBackgrounds','purple'),('profileIcon','ownedProfileIcons','helmet'),('kartModel','ownedKarts','original'),('ambient','ownedAmbient','default')]
    preferences=json.loads(state['kart-settings']);before_glass=preferences.get('glass',True)
    audit_keys=('upgrades','coins','xp','claimed','pass','paintMode','customPaint','savedPaints',*keys,*(s[0] for s in selections))
    if name=='inventory-save':
        if type(data.get('revision'))!=int or data['revision']!=current['revision']:raise ProfileError(409,'conflict')
        coins=data.get('coins')
        if type(coins)!=int or not 0<=coins<=10**12:raise ProfileError(400,'invalid')
        level=data.get('level',progress['xp']//250+1)
        if type(level)!=int or not 1<=level<=4000000001:raise ProfileError(400,'invalid')
        before={k:progress[k] for k in audit_keys}
        choices={'owned':(set(range(len(profiles.PRICES))),{0,1},int),'ownedCars':(set(profiles.CAR_PRICES),{'porsche'},str),'ownedProfileBackgrounds':(set(profiles.PROFILE_BACKGROUNDS),{'purple'},str),'ownedProfileIcons':(set(profiles.PROFILE_ICONS),{'helmet'},str),'ownedKarts':(set(profiles.KART_PRICES),{'original','christmas'},str),'ownedAmbient':(set(profiles.AMBIENT),{'default'},str),'ownedTools':(set(profiles.TOOL_PRICES),set(),str)}
        for key,(allowed_values,required,kind) in choices.items():
            values=data.get(key,progress[key] if key in ('ownedKarts','ownedAmbient','ownedTools') else None)
            if key=='ownedKarts' and isinstance(values,list) and 'christmas' not in values:values=values+['christmas']
            if key=='ownedCars' and 'ownedTools' not in data and isinstance(values,list) and all(isinstance(v,str) for v in values):values=list(dict.fromkeys(values+[v for v in progress['ownedCars'] if v in profiles.EXTRA_CARS]))
            if not isinstance(values,list) or len(values)>len(allowed_values) or any(type(v)!=kind for v in values):raise ProfileError(400,'invalid')
            if len(set(values))!=len(values) or not required.issubset(values) or not set(values).issubset(allowed_values):raise ProfileError(400,'invalid')
            progress[key]=values
        progress['coins']=coins
        progress['xp']=min(10**12,(level-1)*250+progress['xp']%250)
        for selected,owned,fallback in selections:
            value=data.get(selected,progress[selected])
            if type(value)!=type(fallback):raise ProfileError(400,'invalid')
            if value not in progress[owned]:
                if value!=progress[selected]:raise ProfileError(400,'invalid')
                value=fallback
            progress[selected]=value
        for field,key,allowed in [('missionClaims','claimed',set(profiles.MISSION_REWARDS)),('levelClaims','pass',set(profiles.progression.LEVEL_REWARDS))]:
            values=data.get(field,list(progress[key]))
            if not isinstance(values,list) or any(not isinstance(v,str) or v not in allowed for v in values) or len(values)!=len(set(values)):raise ProfileError(400,'invalid')
            progress[key]={v:1 for v in values}
        if 'upgrades' in data:
            if data['upgrades']!=profiles.tuning.clean(data['upgrades']):raise ProfileError(400,'invalid')
            for car,parts in data['upgrades'].items():
                if not profiles.tuning.owns(progress,car) and any(level>progress['upgrades'].get(car,{}).get(part,0) for part,level in parts.items()):raise ProfileError(400,'invalid_ownership')
            progress['upgrades']=data['upgrades']
        for key in ('paintMode','customPaint','savedPaints'):
            if key in data:progress[key]=data[key]
        if 'customizer' not in progress['ownedTools']:progress['paintMode']='preset'
        if 'glass' in data:
            if type(data['glass'])!=bool:raise ProfileError(400,'invalid')
            preferences['glass']=data['glass']
        state['kart-settings']=json.dumps(preferences)
        state['kart-save']=json.dumps(progress);profiles.validate(state)
        con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),target))
        event(con,uid,'inventory-save',pid,{'before':{**before,'glass':before_glass},'after':{**{k:progress[k] for k in audit_keys},'glass':preferences.get('glass',True)}})
        current=profiles.account(con,target)
    result=dict(id=pid,username=current['username'],revision=current['revision'],coins=progress['coins'],level=progress['xp']//250+1,**{k:progress[k] for k in (*keys,'paintMode','customPaint','savedPaints',*(s[0] for s in selections))})
    result['glass']=preferences.get('glass',True)
    result['upgrades']=progress['upgrades']
    result.update(missionClaims=list(progress['claimed']),levelClaims=list(progress['pass']))
    if name=='inventory-save' and uid==target:result['account']=current
    return result
