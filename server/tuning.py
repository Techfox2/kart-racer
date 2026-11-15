"""Authoritative upgrade prices and ownership. Call purchases inside the caller's transaction."""
import json
from pathlib import Path

PRICES=json.loads(Path(__file__).with_name('tuning-prices.json').read_text(encoding='utf-8'))
PARTS=tuple(PRICES['kart'])

def configure(cars,karts):
    # New registered vehicles inherit a safe class table until authored overrides are added.
    for car in cars:PRICES.setdefault(car,{k:list(v) for k,v in PRICES['porsche'].items()})
    for model in karts:PRICES.setdefault('kart' if model=='original' else 'kart-'+model,{k:list(v) for k,v in PRICES['kart'].items()})

def clean(value):
    if not isinstance(value,dict):return {}
    result={}
    for car,parts in value.items():
        if car not in PRICES or not isinstance(parts,dict):continue
        levels={part:level for part,level in parts.items() if part in PRICES[car] and type(level)==int and 1<=level<=len(PRICES[car][part])}
        if levels:result[car]=levels
    return result

def owns(progress,car):
    return (car=='kart' or car.startswith('kart-') and car[5:] in progress['ownedKarts'] or car in progress['ownedCars']) and car in PRICES

def buy(con,uid,data):
    import profiles
    error=profiles.ProfileError
    car,part,level=data.get('car'),data.get('part'),data.get('level')
    if not isinstance(car,str) or car not in PRICES or not isinstance(part,str) or part not in PRICES[car] or type(level)!=int or not 1<=level<=len(PRICES[car][part]):raise error(400,'invalid_upgrade')
    con.execute('BEGIN IMMEDIATE')
    current=profiles.account(con,uid);state=current['state'] or profiles.defaults();progress=json.loads(state['kart-save'])
    if not owns(progress,car):raise error(403,'ownership')
    old=progress['upgrades'].get(car,{}).get(part,0)
    # A duplicate stage purchase is idempotent, including a retried request after a lost response.
    if old>=level:return current
    if type(data.get('revision'))!=int or data['revision']!=current['revision']:raise error(409,'conflict')
    if level!=old+1:raise error(409,'order')
    price=PRICES[car][part][level-1]
    if progress['coins']<price:raise error(409,'coins')
    progress['coins']-=price;progress['upgrades'].setdefault(car,{})[part]=level
    state['kart-save']=json.dumps(progress)
    con.execute('UPDATE profiles SET state=?,revision=revision+1 WHERE user_id=?',(json.dumps(state),uid))
    return profiles.account(con,uid)
