"""One-time 1.2.6 price migration. Preserve all unrelated account data."""
import json
import time

OPERATION='customizer-price-15000-v1'

def migrate(con):
    con.execute('CREATE TABLE IF NOT EXISTS shop_migrations(operation TEXT PRIMARY KEY,created INTEGER NOT NULL)')
    con.execute('CREATE TABLE IF NOT EXISTS shop_refunds(operation TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,coins INTEGER NOT NULL,source TEXT NOT NULL,PRIMARY KEY(operation,user_id))')
    if con.execute('SELECT 1 FROM shop_migrations WHERE operation=?',(OPERATION,)).fetchone():return 0
    changed=0
    for row in con.execute('SELECT p.user_id,p.state,u.player_id FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.state IS NOT NULL').fetchall():
        state=json.loads(row['state']);progress=json.loads(state['kart-save'])
        if 'customizer' not in progress.get('ownedTools',[]):continue
        # Purchases had no separate receipt before 1.2.6. An explicit latest
        # admin grant is distinguishable through the existing inventory audit.
        source='legacy-purchase'
        for event in con.execute("SELECT details FROM admin_events WHERE action='inventory-save' AND target=? ORDER BY id DESC",(row['player_id'],)):
            detail=json.loads(event[0]);before=detail.get('before',{});after=detail.get('after',{})
            if 'ownedTools' not in before or 'ownedTools' not in after:continue
            had='customizer' in before['ownedTools'];has='customizer' in after['ownedTools']
            if had!=has:
                if has:source='admin-grant'
                break
        refund=2500 if source=='legacy-purchase' else 0
        progress['ownedTools'].remove('customizer');progress['paintMode']='preset';progress['coins']+=refund
        state['kart-save']=json.dumps(progress)
        con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),row['user_id']))
        con.execute('DELETE FROM profile_requests WHERE user_id=?',(row['user_id'],))
        con.execute('INSERT INTO shop_refunds VALUES (?,?,?,?)',(OPERATION,row['user_id'],refund,source))
        con.execute('INSERT INTO admin_events(created,actor,action,target,details) VALUES (?,?,?,?,?)',(int(time.time()),'SYSTEM','customizer-refund',row['player_id'],json.dumps(dict(coins=refund,source=source))))
        changed+=1
    con.execute('INSERT INTO shop_migrations VALUES (?,?)',(OPERATION,int(time.time())))
    return changed
