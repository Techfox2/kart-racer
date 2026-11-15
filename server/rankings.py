"""Per-track/mode/model leaderboards. Rewards require a strictly faster world record."""
import json
import math
import datetime
from pathlib import Path

RULES=json.loads((Path(__file__).resolve().parent.parent/'assets/tracks/race-rules.json').read_text(encoding='utf-8'))

def minimum(track,mode,car):
    category='kart' if car=='kart' or car.startswith('kart-') else 'gt3'
    return RULES['tracks'][track]['length']*RULES['distanceMargin']/RULES['maxSpeed'][mode][category]

def plausible(key,seconds):
    mode,car,track=parse_key(key)
    return type(seconds) in (int,float) and math.isfinite(seconds) and minimum(track,mode,car)<=seconds<10**7

TRACKS=('circuit','snow','indoor','spa','monaco','monza','nurburgring','shanghai','switchback','hairpin')
MODES=('luckyblock','competitive')
CARS=('kart','kart-apex','kart-rally','kart-vector','kart-christmas','porsche','amg','ferrari','bmw','aston','audi','lambo','mclaren')

def parse_key(key):
    parts=key.split(':') if isinstance(key,str) else []
    if len(parts)!=3 or parts[0] not in MODES or parts[1] not in CARS or parts[2] not in TRACKS:raise ValueError('invalid record category')
    return parts

def record(con,uid,state,rewards=False,approved=False):
    if not state:return 0
    progress=json.loads(state['kart-save']);bonus=0
    for key,seconds in progress.get('records',{}).items():
        try:mode,car,track=parse_key(key)
        except ValueError:continue
        if type(seconds) in (int,float) and 0<seconds<20 and not approved:
            pending(con,uid,key,seconds);continue
        if not approved and not plausible(key,seconds):continue
        category='kart' if car=='kart' or car.startswith('kart-') else 'gt3';ms=max(1,round(seconds*1000));args=(category,mode,car,track)
        own=con.execute('SELECT milliseconds FROM lap_records WHERE user_id=? AND category=? AND mode=? AND car=? AND track=?',(uid,*args)).fetchone()
        floor=math.ceil(minimum(track,mode,car)*1000)
        if own and (own[0]<20000 or own[0]>=floor) and ms>=own[0]:continue
        previous=con.execute('SELECT min(milliseconds) FROM lap_records WHERE category=? AND mode=? AND car=? AND track=? AND (milliseconds>=? OR milliseconds<20000)',(*args,floor)).fetchone()[0]
        con.execute('INSERT INTO lap_records VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,category,mode,car,track) DO UPDATE SET milliseconds=CASE WHEN milliseconds<? AND milliseconds>=20000 THEN excluded.milliseconds ELSE MIN(milliseconds,excluded.milliseconds) END',(uid,*args,ms,floor))
        if rewards and previous is not None and ms<previous and (not own or own[0]!=previous):bonus+=100*min(4,(previous-ms+999)//1000)
    return bonus

def migrate(con):
    con.execute('CREATE TABLE IF NOT EXISTS ranking_season(id INTEGER PRIMARY KEY CHECK(id=1),generation INTEGER NOT NULL,started TEXT NOT NULL,december INTEGER NOT NULL)')
    con.execute('CREATE TABLE IF NOT EXISTS seasonal_records(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,category TEXT NOT NULL,mode TEXT NOT NULL,car TEXT NOT NULL,track TEXT NOT NULL,milliseconds INTEGER NOT NULL CHECK(milliseconds>0),PRIMARY KEY(user_id,category,mode,car,track))')
    season(con)
    con.execute("CREATE TABLE IF NOT EXISTS record_reviews(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,milliseconds INTEGER NOT NULL,season INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL DEFAULT '',UNIQUE(user_id,key,milliseconds,season))")
    columns={r[1] for r in con.execute('PRAGMA table_info(lap_records)')}
    old=bool(columns) and 'mode' not in columns
    if old:
        con.execute('DROP INDEX IF EXISTS lap_records_order')
        con.execute('ALTER TABLE lap_records RENAME TO lap_records_legacy_migration')
    con.execute('CREATE TABLE IF NOT EXISTS lap_records(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,category TEXT NOT NULL,mode TEXT NOT NULL,car TEXT NOT NULL,track TEXT NOT NULL,milliseconds INTEGER NOT NULL CHECK(milliseconds>0),PRIMARY KEY(user_id,category,mode,car,track))')
    if old:
        con.execute("INSERT INTO lap_records SELECT user_id,category,'legacy','legacy',track,milliseconds FROM lap_records_legacy_migration")
        con.execute('DROP TABLE lap_records_legacy_migration')
    con.execute('CREATE INDEX IF NOT EXISTS lap_records_order ON lap_records(category,mode,car,track,milliseconds,user_id)')
    for table in ('lap_records','seasonal_records'):
        for r in con.execute('SELECT * FROM '+table+' WHERE milliseconds<20000').fetchall():
            if r['mode'] in MODES and r['car'] in CARS:
                pending(con,r['user_id'],':'.join((r['mode'],r['car'],r['track'])),r['milliseconds']/1000,season(con)['id'] if table=='seasonal_records' else 0)
        con.execute(f"DELETE FROM {table} WHERE milliseconds<20000 AND mode IN ('competitive','luckyblock') AND NOT EXISTS(SELECT 1 FROM record_reviews v WHERE v.user_id={table}.user_id AND v.key={table}.mode||':'||{table}.car||':'||{table}.track AND v.milliseconds={table}.milliseconds AND v.status='approved')")
    for row in con.execute('SELECT user_id,state FROM profiles WHERE state IS NOT NULL').fetchall():
        state=json.loads(row['state']);progress=json.loads(state['kart-save'])
        if not columns:
            for category,key in (('kart','best'),('gt3','bestGT3')):
                for track,seconds in progress.get(key,{}).items():
                    if track in TRACKS and type(seconds) in (int,float) and math.isfinite(seconds) and 0<seconds<10**7:
                        con.execute("INSERT OR IGNORE INTO lap_records VALUES (?,?,'legacy','legacy',?,?)",(row['user_id'],category,track,max(1,round(seconds*1000))))
        record(con,row['user_id'],state)

def reset_all(con,operation):
    """One explicit administrative reset; caller owns the transaction."""
    con.execute('CREATE TABLE IF NOT EXISTS ranking_resets(operation TEXT PRIMARY KEY)')
    if con.execute('SELECT 1 FROM ranking_resets WHERE operation=?',(operation,)).fetchone():return False
    for row in con.execute('SELECT user_id,state FROM profiles').fetchall():
        state=json.loads(row['state']) if row['state'] is not None else None
        if state is not None:
            progress=json.loads(state['kart-save'])
            for key in ('best','bestGT3','records'):progress[key]={}
            state['kart-save']=json.dumps(progress)
        con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state) if state is not None else None,row['user_id']))
    con.execute('DELETE FROM lap_records')
    con.execute('DELETE FROM profile_requests')
    con.execute('INSERT INTO ranking_resets VALUES (?)',(operation,))
    return True

def season(con,now=None,reset=False):
    owns_transaction=not con.in_transaction
    if owns_transaction:con.execute('BEGIN IMMEDIATE')
    now=now or datetime.datetime.now(datetime.timezone.utc)
    # The requested automatic reset is December 1, 2026 only; later seasons are manual.
    december=2026 if (now.year,now.month)>=(2026,12) else 2025
    current=con.execute('SELECT generation,started,december FROM ranking_season WHERE id=1').fetchone()
    if not current:
        con.execute('INSERT INTO ranking_season VALUES (1,1,?,?)',(now.isoformat(),december))
    elif reset or current[2]<december:
        con.execute('DELETE FROM seasonal_records')
        con.execute('UPDATE ranking_season SET generation=generation+1,started=?,december=? WHERE id=1',(now.isoformat(),december))
    row=con.execute('SELECT generation,started FROM ranking_season WHERE id=1').fetchone()
    if owns_transaction:con.commit()
    return dict(id=row[0],started=row[1])

def seasonal_record(con,uid,attempts):
    active=season(con)
    for entry in attempts:
        if entry['season']!=active['id']:continue
        if entry['seconds']<20:
            pending(con,uid,entry['key'],entry['seconds'],entry['season']);continue
        mode,car,track=parse_key(entry['key']);category='kart' if car=='kart' or car.startswith('kart-') else 'gt3'
        con.execute('INSERT INTO seasonal_records VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,category,mode,car,track) DO UPDATE SET milliseconds=MIN(milliseconds,excluded.milliseconds)',(uid,category,mode,car,track,round(entry['seconds']*1000)))

def board(con,uid,track,category,mode='competitive',car=None,scope='alltime'):
    if track not in TRACKS or category not in ('kart','gt3') or mode not in MODES:raise ValueError('invalid leaderboard')
    car=car or ('kart' if category=='kart' else 'porsche')
    if car not in CARS or (category=='kart')!=(car=='kart' or car.startswith('kart-')):raise ValueError('invalid car category')
    if scope not in ('seasonal','alltime'):raise ValueError('invalid scope')
    active=season(con);table='seasonal_records' if scope=='seasonal' else 'lap_records'
    args=(track,category,mode,car,math.ceil(minimum(track,mode,car)*1000));where="r.track=? AND r.category=? AND r.mode=? AND r.car=? AND (r.milliseconds>=? OR EXISTS(SELECT 1 FROM record_reviews v WHERE v.user_id=r.user_id AND v.key=r.mode||':'||r.car||':'||r.track AND v.milliseconds=r.milliseconds AND v.status='approved'))"
    rows=con.execute('SELECT r.user_id,r.milliseconds,u.username,u.player_id FROM '+table+' r JOIN users u ON u.id=r.user_id WHERE '+where+' ORDER BY r.milliseconds,u.player_id LIMIT 100',args).fetchall()
    entries=[dict(rank=i+1,id=r['player_id'],username=r['username'],milliseconds=r['milliseconds'],you=r['user_id']==uid) for i,r in enumerate(rows)]
    own=con.execute('SELECT milliseconds FROM '+table+' r WHERE '+where+' AND user_id=?',(*args,uid)).fetchone();mine=None
    if own:
        pid=con.execute('SELECT player_id FROM users WHERE id=?',(uid,)).fetchone()[0]
        rank=1+con.execute('SELECT count(*) FROM '+table+' r JOIN users u ON u.id=r.user_id WHERE '+where+' AND (r.milliseconds<? OR (r.milliseconds=? AND u.player_id<?))',(*args,own[0],own[0],pid)).fetchone()[0]
        mine={'rank':rank,'milliseconds':own[0]}
    return dict(track=track,category=category,mode=mode,car=car,scope=scope,season=active,entries=entries,mine=mine,pending=bool(con.execute("SELECT 1 FROM record_reviews WHERE user_id=? AND key=? AND status='pending'",(uid,mode+':'+car+':'+track)).fetchone()))


def pending(con,uid,key,seconds,generation=0):
    parse_key(key)
    # All-time and seasonal copies share a decision; never reopen a rejection.
    known=con.execute('SELECT status FROM record_reviews WHERE user_id=? AND key=? AND milliseconds=?',(uid,key,round(seconds*1000))).fetchone()
    if known and known[0]!='pending':return
    con.execute('INSERT OR IGNORE INTO record_reviews(user_id,key,milliseconds,season) VALUES (?,?,?,?)',(uid,key,round(seconds*1000),generation))

def review(con,actor,data):
    import admin,profiles
    admin.require(con,actor)
    row=con.execute('SELECT * FROM record_reviews WHERE id=?',(data.get('review'),)).fetchone()
    if not row:raise profiles.ProfileError(404,'not_found')
    if row['user_id']==actor:raise profiles.ProfileError(403,'forbidden')
    decision=data.get('decision');reason=data.get('reason','')
    if decision not in ('approved','rejected') or not isinstance(reason,str) or len(reason)>300:raise profiles.ProfileError(400,'invalid')
    if row['status']!='pending':return {'ok':True,'reward':0}
    uid=row['user_id'];key=row['key'];ms=row['milliseconds'];bonus=0
    if decision=='approved':
        bonus=record(con,uid,{'kart-save':json.dumps({'records':{key:ms/1000}})},True,True)
        mode,car,track=parse_key(key);category='kart' if car.startswith('kart') else 'gt3'
        current=season(con)['id']
        if con.execute('SELECT 1 FROM record_reviews WHERE user_id=? AND key=? AND milliseconds=? AND season=?',(uid,key,ms,current)).fetchone():
            con.execute('INSERT INTO seasonal_records VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,category,mode,car,track) DO UPDATE SET milliseconds=MIN(milliseconds,excluded.milliseconds)',(uid,category,mode,car,track,ms))
        account=profiles.account(con,uid);state=account['state'] or profiles.defaults();progress=json.loads(state['kart-save']);progress['coins']=min(10**12,progress['coins']+bonus);state['kart-save']=json.dumps(progress)
        con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    con.execute('UPDATE record_reviews SET status=?,reason=? WHERE user_id=? AND key=? AND milliseconds=?',(decision,reason,uid,key,ms))
    admin.event(con,actor,'record-'+decision,str(row['id']),{'key':key,'milliseconds':ms,'reason':reason,'reward':bonus})
    return {'ok':True,'reward':bonus}
