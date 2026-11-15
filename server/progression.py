"""Shared progression catalog; existing reward IDs and amounts remain stable."""
import json
from pathlib import Path
CATALOG=json.loads((Path(__file__).resolve().parent.parent/'assets/progression/catalog.json').read_text(encoding='utf-8'))
MISSIONS={m['id']:m for m in CATALOG['missions']}
REWARDS={k:m['reward'] for k,m in MISSIONS.items()}
LEVEL_REWARDS={str(l['level']):l['reward'] for l in CATALOG['levels']}
TOURS={'f1':['spa','monaco','monza'],'gpTour':['spa','monaco','monza','nurburgring','shanghai'],'kartTour':['switchback','hairpin']}
def completed(progress,key):
    mission=MISSIONS[key];stat=mission['stat']
    value=sum(bool(progress['f1'].get(k)) for k in TOURS[stat]) if stat in TOURS else progress.get(stat,0)
    return value>=mission['goal']
