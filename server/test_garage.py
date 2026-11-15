import concurrent.futures
import copy
import json
import unittest
import test_customization
import profiles
import rankings

class GarageTests(test_customization.Customization):
    def save_progress(self,a,updates,uid=1):
        p=json.loads(a['state']['kart-save']);p.update(updates)
        with self.db() as c:return profiles.save(c,uid,{'revision':a['revision'],'state':{**a['state'],'kart-save':json.dumps(p)}})
    def test_tool_purchase_concurrent_and_colours(self):
        with self.db() as c:revision=profiles.account(c,1)['revision']
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda _:self.buy('tool','customizer',revision=revision),range(2)))
        a=self.buy('tool','customizer',revision=0)
        self.assertEqual(json.loads(a['state']['kart-save'])['coins'],35000)
        a=self.save_progress(a,dict(paintMode='custom',customPaint='#238adf',savedPaints=['#238adf','#000000']))
        with self.db() as c:self.assertEqual(json.loads(profiles.account(c,1)['state']['kart-save'])['customPaint'],'#238adf')
        with self.assertRaises(profiles.ProfileError) as e:self.buy('tool','customizer',2)
        self.assertEqual(e.exception.code,'coins')
    def test_invalid_tool_colours_and_ownership(self):
        with self.db() as c:a=profiles.account(c,1)
        for patch in [dict(ownedTools=['customizer']),dict(paintMode='custom'),dict(customPaint='#fff'),dict(customPaint='<script>'),dict(savedPaints=['#000000']*2),dict(savedPaints=['#%06x'%i for i in range(9)]),dict(ownedTools=[{}])]:
            with self.assertRaises(profiles.ProfileError):self.save_progress(a,patch)
        self.buy('tool','customizer');
        with self.db() as c:
            fresh=profiles.defaults();p=json.loads(fresh['kart-save']);p['ownedTools']=['customizer'];fresh['kart-save']=json.dumps(p)
            c.execute('INSERT INTO users(id,username,account_id,player_id) VALUES (3,?,?,?)',('Third','a'*32,'ZZZZZ3'));c.execute('INSERT INTO profiles(user_id) VALUES(3)');c.commit()
            with self.assertRaises(profiles.ProfileError):profiles.save(c,3,{'revision':0,'state':fresh})
    def test_new_cars_bots_records_and_legacy(self):
        for car in profiles.EXTRA_CARS:
            with self.db() as c:
                a=profiles.account(c,1);profiles.buy_car(c,1,{'revision':a['revision'],'car':car})
        a=self.buy('tool','customizer');p=json.loads(a['state']['kart-save'])
        cars=sorted(profiles.EXTRA_CARS)+['porsche'];quick=copy.deepcopy(p['quickPlay']);quick['botCars']=cars
        a=self.save_progress(a,dict(car='mclaren',category='gt3',botCars=cars,mpBotCars=cars,quickPlay=quick,paintMode='custom',customPaint='#123abc',savedPaints=['#123abc']))
        old=copy.deepcopy(a['state']);s=json.loads(old['kart-save'])
        for key in profiles.CUSTOM_KEYS:del s[key]
        s['ownedCars']=['porsche'];s['car']='porsche';s['botCars']=['porsche']*6;s['mpBotCars']=['porsche']*6;s['quickPlay']['botCars']=['porsche']*6;old['kart-save']=json.dumps(s)
        with self.db() as c:a=profiles.save(c,1,{'revision':a['revision'],'state':old})
        p=json.loads(a['state']['kart-save']);self.assertEqual(p['car'],'mclaren');self.assertEqual(p['paintMode'],'custom');self.assertTrue(profiles.EXTRA_CARS.issubset(p['ownedCars']))
        for key in ('botCars','mpBotCars'):self.assertEqual(p[key],cars)
        self.assertEqual(p['quickPlay']['botCars'],cars)
        for car in profiles.EXTRA_CARS:
            key='competitive:'+car+':monza';a=self.save_progress(a,dict(records={**json.loads(a['state']['kart-save'])['records'],key:60}))
            self.assertNotIn('recordReward',a)
        a=self.save_progress(a,dict(records={**json.loads(a['state']['kart-save'])['records'],'competitive:mclaren:monza':59.5}));self.assertNotIn('recordReward',a)
        with self.db() as c:self.assertEqual(rankings.board(c,1,'monza','gt3','competitive','bmw')['entries'][0]['milliseconds'],60000)
        full=profiles.defaults();s=json.loads(full['kart-save']);s['ownedCars']=list(profiles.CAR_PRICES);s['ownedKarts']=list(profiles.KART_PRICES);s['records']={m+':'+c+':'+t:60 for m in rankings.MODES for c in rankings.CARS for t in profiles.TRACKS};full['kart-save']=json.dumps(s);profiles.validate(full)

if __name__=='__main__':unittest.main()
