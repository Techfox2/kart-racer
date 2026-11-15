"""Additional developer permissions, bound to immutable account identities."""
import json
import re
import admin
import profiles
from profiles import ProfileError

def migrate(con,seeds=None):
    con.executescript('''
    CREATE TABLE IF NOT EXISTS developer_roles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('developer','main')));
    CREATE TABLE IF NOT EXISTS developer_preferences(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,christmas INTEGER NOT NULL DEFAULT 0 CHECK(christmas IN (0,1)));
    ''')
    if seeds is not None and not con.execute("SELECT 1 FROM admin_migrations WHERE name='developers-v1'").fetchone():
        if not isinstance(seeds,dict) or list(seeds.values()).count('main')!=1 or any(not re.fullmatch('[A-Z0-9]{6}',p) or r not in ('developer','main') for p,r in seeds.items()):raise ValueError('Invalid developer seed')
        con.execute('BEGIN IMMEDIATE')
        for pid,role in seeds.items():
            row=con.execute('SELECT id FROM users WHERE player_id=?',(pid,)).fetchone()
            if not row:raise ValueError('Unknown developer identity')
            con.execute('INSERT INTO developer_roles VALUES (?,?)',(row[0],role))
        con.execute("INSERT INTO admin_migrations VALUES ('developers-v1')")

def status(con,uid):
    if not con.execute("SELECT 1 FROM sqlite_master WHERE name='developer_roles'").fetchone():return dict(role=None,christmasPreview=False)
    r=con.execute('SELECT d.role,COALESCE(p.christmas,0) FROM developer_roles d LEFT JOIN developer_preferences p ON p.user_id=d.user_id WHERE d.user_id=? AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE b.user_id=d.user_id)',(uid,)).fetchone()
    return dict(role=r[0] if r else None,christmasPreview=bool(r and r[1]))

def action(con,uid,name,data):
    con.execute('BEGIN IMMEDIATE')
    own=status(con,uid)
    if not own['role']:raise ProfileError(403,'forbidden')
    if name=='preview':
        enabled=data.get('enabled');equip=data.get('kart')
        if type(enabled)!=bool or type(equip)!=bool or (equip and not enabled and not profiles.christmas_active()):raise ProfileError(400,'invalid')
        current=profiles.account(con,uid)
        if type(data.get('revision'))!=int or data['revision']!=current['revision']:raise ProfileError(409,'conflict')
        con.execute('INSERT INTO developer_preferences VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET christmas=excluded.christmas',(uid,int(enabled)))
        state=current['state'] or profiles.defaults();save=json.loads(state['kart-save']);save['kartSkin']='christmas' if equip else 'original';save['kartModel']='christmas' if equip else ('original' if save['kartModel']=='christmas' else save['kartModel']);state['kart-save']=json.dumps(save)
        con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
        admin.event(con,uid,'developer-preview',current['id'],{'before':own['christmasPreview'],'after':enabled,'kart':equip})
        return profiles.account(con,uid)
    if own['role']!='main':raise ProfileError(403,'forbidden')
    if name=='list':
        query=data.get('query','')
        if not isinstance(query,str) or len(query)>20:raise ProfileError(400,'invalid')
        rows=con.execute('SELECT u.player_id AS id,u.username,d.role FROM users u LEFT JOIN developer_roles d ON d.user_id=u.id WHERE instr(lower(u.username),lower(?))>0 OR lower(u.player_id)=lower(?) ORDER BY d.role IS NULL,u.username LIMIT 50',(query.strip(),query.strip()))
        return {'users':[dict(r) for r in rows]}
    if name!='role' or type(data.get('enabled'))!=bool:raise ProfileError(400,'invalid')
    pid=data.get('id')
    if not isinstance(pid,str) or not re.fullmatch('[A-Z0-9]{6}',pid):raise ProfileError(400,'invalid')
    row=con.execute('SELECT u.id,d.role FROM users u LEFT JOIN developer_roles d ON d.user_id=u.id WHERE u.player_id=?',(pid,)).fetchone()
    if not row:raise ProfileError(404,'not_found')
    if row['role']=='main':raise ProfileError(403,'protected')
    if data['enabled']:
        if con.execute('SELECT 1 FROM account_blocks WHERE user_id=?',(row['id'],)).fetchone():raise ProfileError(400,'blocked_account')
        con.execute("INSERT OR IGNORE INTO developer_roles VALUES (?,'developer')",(row['id'],))
    else:
        con.execute('DELETE FROM developer_roles WHERE user_id=?',(row['id'],));con.execute('DELETE FROM developer_preferences WHERE user_id=?',(row['id'],))
        current=profiles.account(con,row['id']);state=current['state']
        if state and not profiles.christmas_active():
            save=json.loads(state['kart-save'])
            if save['kartSkin']=='christmas':
                save['kartSkin']='original';save['kartModel']='original' if save['kartModel']=='christmas' else save['kartModel'];state['kart-save']=json.dumps(save)
                con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),row['id']))
    admin.event(con,uid,'developer-role',pid,{'before':row['role'],'after':'developer' if data['enabled'] else None})
    return {'ok':True}
