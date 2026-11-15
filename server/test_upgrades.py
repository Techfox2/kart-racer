import copy
import json
import unittest
import profiles
import tuning
import test_admin

class UpgradeTests(unittest.TestCase):
    setUp=test_admin.AdminTests.setUp
    tearDown=test_admin.AdminTests.tearDown
    pid=test_admin.AdminTests.pid
    call=test_admin.AdminTests.call

    def fund(self,coins=50000):
        i=self.call(1,'inventory',{'id':self.pid(4)})
        self.call(1,'inventory-save',{**i,'coins':coins})

    def buy(self,car='porsche',part='engine',level=1,revision=None):
        rev=profiles.account(self.c,4)['revision'] if revision is None else revision
        with self.c:return tuning.buy(self.c,4,dict(car=car,part=part,level=level,revision=rev))

    def test_purchase_all_stages_prices_and_duplicate(self):
        self.fund();before=profiles.account(self.c,4);coins=50000
        for part in tuning.PARTS:
            for level in (1,2,3):
                result=self.buy(part=part,level=level);coins-=tuning.PRICES['porsche'][part][level-1]
                self.assertEqual(json.loads(result['state']['kart-save'])['coins'],coins)
                duplicate=self.buy(part=part,level=level,revision=before['revision'])
                self.assertEqual(duplicate,result)
        self.assertEqual(json.loads(result['state']['kart-save'])['upgrades']['porsche'],{p:3 for p in tuning.PARTS})

    def test_wrong_order_balance_ownership_and_conflict_atomic(self):
        self.fund(10);before=profiles.account(self.c,4)
        for args,code in [({'level':2},'order'),({},'coins'),({'car':'amg'},'ownership'),({'revision':-1},'conflict'),({'part':'magic'},'invalid_upgrade'),({'level':True},'invalid_upgrade')]:
            with self.assertRaises(profiles.ProfileError) as e:self.buy(**args)
            self.assertEqual(e.exception.code,code);self.assertEqual(profiles.account(self.c,4),before)

    def test_old_save_preserves_and_cannot_grant(self):
        self.fund();a=self.buy();state=copy.deepcopy(a['state']);p=json.loads(state['kart-save']);del p['upgrades'];state['kart-save']=json.dumps(p)
        with self.c:a=profiles.save(self.c,4,{'state':state,'revision':a['revision']})
        self.assertEqual(json.loads(a['state']['kart-save'])['upgrades'],{'porsche':{'engine':1}})
        p=json.loads(a['state']['kart-save']);p['upgrades']['porsche']['engine']=3;state['kart-save']=json.dumps(p)
        with self.assertRaises(profiles.ProfileError):
            with self.c:profiles.save(self.c,4,{'state':state,'revision':a['revision']})
        state=profiles.defaults();p=json.loads(state['kart-save']);p['upgrades']={'kart':{'engine':1}};state['kart-save']=json.dumps(p)
        with self.assertRaises(profiles.ProfileError):
            with self.c:profiles.save(self.c,3,{'state':state,'revision':0})

    def test_loading_unknown_values_and_legacy_defaults(self):
        self.assertEqual(tuning.clean({'ghost':{'engine':1},'kart':{'magic':1,'engine':True,'aero':4,'brakes':-1,'tyres':2}}),{'kart':{'tyres':2}})
        state=profiles.defaults();p=json.loads(state['kart-save']);del p['upgrades'];state['kart-save']=json.dumps(p)
        self.assertEqual(json.loads(profiles.validate(state)['kart-save'])['upgrades'],{})

    def test_admin_reset_revoke_dormant_and_audit(self):
        self.fund();i=self.call(1,'inventory',{'id':self.pid(4)})
        i=self.call(1,'inventory-save',{**i,'ownedCars':['porsche','amg']});self.buy(car='amg')
        i=self.call(1,'inventory',{'id':self.pid(4)})
        with self.assertRaises(profiles.ProfileError):self.call(4,'inventory-save',{**i,'upgrades':{}})
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**i,'upgrades':{'amg':{'engine':7}}})
        revoked=self.call(1,'inventory-save',{**i,'ownedCars':['porsche']})
        self.assertEqual(revoked['upgrades'],{'amg':{'engine':1}})
        with self.assertRaises(profiles.ProfileError):self.buy(car='amg',level=2)
        with self.assertRaises(profiles.ProfileError):self.call(1,'inventory-save',{**i,'upgrades':{}})
        old=copy.deepcopy(revoked);del old['upgrades'];saved=self.call(1,'inventory-save',old);self.assertEqual(saved['upgrades'],revoked['upgrades'])
        saved=self.call(1,'inventory-save',{**saved,'upgrades':{}});self.assertEqual(saved['upgrades'],{})
        audit=self.call(1,'list',{})['audit'][0]['details'];self.assertEqual(audit['before']['upgrades'],revoked['upgrades']);self.assertEqual(audit['after']['upgrades'],{})

    def test_every_vehicle_price_table_matches_client(self):
        from pathlib import Path
        catalog=json.loads((Path(__file__).resolve().parent.parent/'assets/tuning/catalog.json').read_text(encoding='utf-8'))
        self.assertEqual(set(tuning.PRICES),set(profiles.CAR_PRICES)|{'kart' if k=='original' else 'kart-'+k for k in profiles.KART_PRICES})
        for car,parts in catalog['cars'].items():
            for part,levels in parts['parts'].items():self.assertEqual(tuning.PRICES[car][part],[s['price'] for s in levels])

if __name__=='__main__':unittest.main()
