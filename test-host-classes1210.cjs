const assert=require('assert'),vm=require('vm'),fs=require('fs');
class Emitter{constructor(){this.handlers={}}on(k,f){(this.handlers[k]??=[]).push(f)}emit(k,v){for(const f of this.handlers[k]||[])f(v)}}
class Link extends Emitter{constructor(id){super();this.peer=id;this.open=true;this.sent=[]}send(m){this.sent.push(m)}close(){this.open=false;this.emit('close')}}
(async()=>{
 const peer=new Emitter();Object.assign(peer,{id:'host',code:'ABCD1234',observers:new Set(),destroy(){},async setLocked(){},async setClassPolicy(){},async setVehicleClass(){}});
 const timers=new Set(),context={window:{},console,Date,Map,Set,Object,Number,Math,Promise,Error,queueMicrotask,crypto:{getRandomValues:a=>{a[0]=12;return a}},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.add(t);return t},clearTimeout:t=>{clearTimeout(t);timers.delete(t)},KartWebPeer:{host:async()=>peer},KartLobbyClasses:require('./lobby-classes.js'),KartTuningStats:require('./tuning-stats.js'),KartTuning:{all:()=>[{id:'porsche'}]},KartGT3:{valid:x=>x||'porsche'},KartModels:{valid:x=>x||'original'},KartSeason:{skin:x=>x||'original'},KartBots:{normalize:()=>({count:0}),authority:()=>'',clean:()=>false},KartRaceReady:{...require('./race-ready.js'),text:()=>({version:'version'})},KartMapVote:require('./lobby-vote.js'),MAPS:{circuit:{}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('network-runtime.js','utf8'),context);const rooms=vm.runInContext('KartRooms',context);
 try{
 const session=await rooms.host({category:'gt3',driverClass:'gt3',mixedClasses:false,car:'porsche',map:'circuit'},()=>{},'web');
 const wrong=new Link('wrong');peer.emit('connection',wrong);wrong.emit('data',{t:'join',category:'kart',protocol:8});assert(wrong.sent.some(m=>m.t==='reject'));
 const guest=new Link('guest');peer.emit('connection',guest);guest.emit('data',{t:'join',category:'gt3',car:'porsche',protocol:8});assert(guest.sent.some(m=>m.t==='welcome'));
 guest.emit('data',{t:'vehicle-class',category:'kart',request:1});assert.equal(guest.sent.at(-1).ok,false);
 await session.room.presence({mixedClasses:true});guest.emit('data',{t:'vehicle-class',category:'kart',request:2});assert.equal(guest.sent.at(-1).ok,true);
 await session.room.presence({mixedClasses:false});await assert.rejects(session.room.presence({go:100}));
 guest.emit('data',{t:'vehicle-class',category:'gt3',request:3});await session.room.presence({go:100});
 guest.emit('data',{t:'vehicle-class',category:'kart',request:4});assert.equal(guest.sent.at(-1).ok,false);
 guest.emit('data',{t:'state',round:100,data:{visualCategory:'kart',car:'amg',x:1,y:2,z:3,h:0}});
 const remote=session.room.peers().find(p=>p.peer==='guest').presence;assert.equal(remote.visualCategory,'gt3');assert.equal(remote.car,'porsche');
 guest.emit('data',{t:'state',round:100,data:{mixedClasses:true,category:'kart',driverClass:'kart'}});assert.equal(remote.driverClass,'gt3');assert.equal(session.room.peers().find(p=>p.peer==='host').presence.mixedClasses,false);
 console.log('PASS host protocol rejects wrong-class joins/switches/start, guest policy forgery and race-packet model substitution');
 }finally{for(const t of timers)clearTimeout(t)}
})().catch(e=>{console.error(e);process.exitCode=1});
