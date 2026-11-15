/* Lokal: bisheriger PeerJS-Ablauf. Web: eigener Vermittlungsserver, direkte WebRTC-Renndaten. */
const KartRooms=(()=>{
  const peerId=code=>'kart-racer-v3-'+code;
  const limit=7;
  let library;
  function loadPeer(){
    if(window.Peer)return Promise.resolve(window.Peer);
    if(!library)library=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js';
      const fail=()=>{clearTimeout(timer);script.remove();reject(new Error('Der Onlinedienst ist nicht erreichbar. Versuche es erneut.'))};
      const timer=setTimeout(fail,10000);
      script.onload=()=>{if(!window.Peer){fail();return}clearTimeout(timer);resolve(window.Peer)};
      script.onerror=fail;
      document.head.appendChild(script);
    }).catch(error=>{library=null;throw error});
    return library;
  }
  function connect(Peer,id){
    return new Promise((resolve,reject)=>{
      const peer=id?new Peer(id,{secure:true}):new Peer({secure:true});
      const fail=error=>{clearTimeout(timer);peer.destroy();reject(error)};
      const timer=setTimeout(()=>fail(new Error('Der Onlinedienst antwortet nicht. Versuche es erneut.')),10000);
      peer.once('error',fail);
      peer.once('open',()=>{
        clearTimeout(timer);
        peer.off('error',fail);
        resolve(peer);
      });
    });
  }
  const nameOf=name=>typeof name==='string'&&name.trim()?name.trim().slice(0,20):'Racer';
  const driverInfo=({name,pc,ws,car,skin,kartModel,tuning,category,driverClass})=>({driverClass:driverClass||category,tuning:KartTuningStats.clean(tuning,KartTuning.all().map(c=>c.id)),kartModel:KartModels.valid(kartModel),skin:KartSeason.skin(skin),car:KartGT3.valid(car),
    nm:nameOf(name),
    pc:Number.isInteger(pc)&&pc>=0&&pc<=0xffffff?pc:0x4f7d96,
    ws:Number.isInteger(ws)&&ws>=0&&ws<3?ws:0
  });
  const numbers=['pc','x','y','z','h','pitch','roll','v','st','br','tt','fin','ft','sp','ws'];
  const roundFields=[...numbers.filter(key=>key!=='pc'&&key!=='ws'),'oil','tk','hit','bhit','botState','racing','loadReady','raceReady'];
  const tuples=(value,size,max)=>Array.isArray(value)?value.slice(0,max).filter(row=>Array.isArray(row)&&row.length===size&&row.every(Number.isFinite)):[];
  function raceData(data){
    const result={};
    if(!data||typeof data!=='object')return result;
    for(const key of numbers)if(Number.isFinite(data[key]))result[key]=data[key];
    if('bhit' in data&&data.bhit&&Number.isInteger(data.bhit.i)&&data.bhit.i>=0&&data.bhit.i<6&&Number.isInteger(data.bhit.n)&&data.bhit.n>0)result.bhit={i:data.bhit.i,n:data.bhit.n};
    if('visualCategory' in data)result.visualCategory=data.visualCategory==='gt3'?'gt3':'kart';if('car' in data)result.car=KartGT3.valid(data.car);if('oil' in data)result.oil=tuples(data.oil,4,4);
    if('skin' in data)result.skin=KartSeason.skin(data.skin);if('kartModel' in data)result.kartModel=KartModels.valid(data.kartModel);
    if('tk' in data)result.tk=tuples(data.tk,2,8);
    if('hit' in data)result.hit=data.hit&&typeof data.hit.to==='string'&&Number.isFinite(data.hit.n)?{to:data.hit.to.slice(0,64),n:data.hit.n}:null;
    return result;
  }
  function makeRoom(peer,onLost){
    const players=new Map(),subscribers=new Set();
    let closed=false,pending=false;
    const notify=()=>{
      if(pending)return;
      pending=true;
      queueMicrotask(()=>{pending=false;for(const fn of subscribers)fn()});
    };
    function update(id,presence){
      const player=players.get(id);
      if(player){const finished=player.presence.fin>0?{fin:player.presence.fin,ft:player.presence.ft}:null;Object.assign(player.presence,presence,finished)}
      else players.set(id,{peer:id,isMe:id===peer.id,kind:'viewer',presence});
      notify();
    }
    function remove(id){if(players.delete(id))notify()}
    function clearRound(){
      for(const player of players.values())for(const key of roundFields)delete player.presence[key];
    }
    function leave(){
      if(closed)return;
      closed=true;
      subscribers.clear();
      players.clear();
      peer.destroy();
    }
    function lost(message){
      if(closed)return;
      leave();
      onLost(message);
    }
    peer.on('close',()=>lost('Die Verbindung wurde beendet.'));
    return {players,update,remove,clearRound,lost,get closed(){return closed},
      api:{peers:()=>Array.from(players.values()),onPeers:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)},leave}};
  }

  async function host(settings,onLost,mode='local'){
    const Peer=mode==='web'?null:await loadPeer();
    let peer,code;
    if(mode==='web'){peer=await KartWebPeer.host({category:settings.category,mixedClasses:settings.mixedClasses===true,driverClass:settings.driverClass});code=peer.code}
    for(let attempt=0;!peer&&attempt<5;attempt++){
      code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
      try{peer=await connect(Peer,peerId(code));break}
      catch(error){if(error.type!=='unavailable-id')throw error}
    }
    if(!peer)throw new Error('Es konnte kein freier Code erstellt werden. Versuche es erneut.');
    const room=makeRoom(peer,onLost),guests=new Map(),observers=new Set();
    const own={...settings,host:1,mx:limit,go:0,raceStartAt:0,remaining:0,guestInvites:false},active=new Set(),gate=KartRaceReady.coordinator(),vote=KartMapVote.coordinator(map=>Object.hasOwn(MAPS,map),()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
    room.update(peer.id,own);
    function broadcast(message,except){
      for(const [id,link] of guests)if(id!==except&&link.open)link.send(message);
    }
    function sendState(id,data,except){
      if(peer.setLocked&&id===peer.id&&data.go===0)peer.setLocked(false).catch(()=>{});
      room.update(id,data);
      broadcast({t:'state',id,data},except);
    }
    function publishVote(){const v=vote.snapshot();sendState(peer.id,{vote:v,...v?.done?{map:v.winner}:{}})}
    function castVote(id,token,map){if(!own.go&&vote.cast(id,token,map))publishVote()}
    function markReady(id,round,kind){if(!KartLobbyClasses.allReady(own,room.api.peers()))return;const result=gate.mark(id,round,kind);if(!result)return;sendState(id,{loadReady:result.loaded,raceReady:result.ready});if(result.startAt)sendState(peer.id,{raceStartAt:result.startAt})}
    function returnDriver(id){
      if(active.has(id)&&own.go&&(!gate.startAt||Date.now()<gate.startAt+600)){active.clear();gate.cancel();room.clearRound();sendState(peer.id,{go:0,raceStartAt:0,remaining:0,order:[]});return}
      if(!active.delete(id))return;
      if(room.players.has(id))sendState(id,{racing:false});
      if(active.size){sendState(peer.id,{remaining:active.size});return}
      room.clearRound();gate.cancel();
      sendState(peer.id,{go:0,raceStartAt:0,remaining:0,order:[]});
    }
    peer.on('disconnected',()=>{
      setTimeout(()=>{if(!room.closed&&!peer.destroyed&&peer.disconnected)peer.reconnect()},1000);
    });
    peer.on('connection',link=>{
      const id=link.peer;
      const timer=setTimeout(()=>link.close(),mode==='web'?40000:8000);
      const drop=()=>{
        clearTimeout(timer);
        if(guests.get(id)!==link)return;
        guests.delete(id);observers.delete(id);
        room.remove(id);
        broadcast({t:'left',id});if(!own.go){vote.roster([...room.players.keys()]);publishVote()}
        returnDriver(id);
      };
      link.on('close',drop);
      link.on('error',()=>{drop();link.close()});
      link.on('data',msg=>{
        if(room.closed||!msg||typeof msg!=='object')return;
        if(guests.get(id)===link){
          if(observers.has(id))return;
          if(msg.t==='vehicle-class'){const category=msg.category,ok=!own.go&&KartLobbyClasses.accepts(own,category);if(ok)sendState(id,{driverClass:category,visualCategory:category,loadReady:false,raceReady:false});link.send({t:'class-result',request:msg.request,ok,reason:KartLobbyClasses.message(own.category)});return}
          if(msg.t==='map-vote'){castVote(id,msg.voteId,msg.map);return}
          if(!active.has(id)||msg.round!==own.go)return;
          if(msg.t==='ready')markReady(id,msg.round,msg.kind);
          else if(msg.t==='back')returnDriver(id);
          else if(msg.t==='state'){const driver=room.players.get(id)?.presence;if(!driver||!KartLobbyClasses.accepts(own,driver.driverClass))return;const clean=raceData(msg.data);clean.visualCategory=driver.driverClass;clean.car=driver.car;clean.kartModel=driver.kartModel;if(id===KartBots.authority(room.api.peers(),own.order||[])&&KartBots.clean(msg.data?.botState))clean.botState=msg.data.botState;sendState(id,clean,id);}
          return;
        }
        if(msg.t!=='join')return;
        clearTimeout(timer);
        const observer=mode==='web'&&peer.observers.has(id);
        const reason=msg.protocol!==KartRaceReady.protocol?KartRaceReady.text().version:own.go&&!observer?'Das Rennen läuft bereits.':!observer&&room.players.size>=limit?'Das Spiel ist voll.':guests.has(id)||id===peer.id?'Du bist bereits verbunden.':!observer&&!KartLobbyClasses.accepts(own,msg.category)?KartLobbyClasses.message(own.category):'';
        if(reason){
          link.send({t:'reject',reason});
          setTimeout(()=>link.close(),2000);
          return;
        }
        const data=driverInfo(msg);
        link.send({t:'welcome',protocol:KartRaceReady.protocol,now:Date.now(),players:Array.from(room.players,([id,p])=>[id,p.presence])});
        guests.set(id,link);
        if(observer){observers.add(id);return}
        room.update(id,data);
        broadcast({t:'state',id,data},id);vote.roster([...room.players.keys()]);publishVote();
      });
    });
    room.api.presence=async data=>{
      if(room.closed)return;
      if('category' in data||'mixedClasses' in data){if(own.go)throw Error('Das Rennen läuft bereits.');const category=data.category??own.category,mixedClasses=data.mixedClasses??own.mixedClasses;if(!KartLobbyClasses.valid(category)||typeof mixedClasses!=='boolean')throw Error('Ungültige Fahrzeugklasse.');if(peer.setClassPolicy)await peer.setClassPolicy(category,mixedClasses);data={...data,category,mixedClasses};for(const player of room.players.values())sendState(player.peer,{loadReady:false,raceReady:false})}
      if('guestInvites' in data){if(own.go)return;if(peer.setGuestInvites)await peer.setGuestInvites(!!data.guestInvites)}
      if(data.go){
        if(own.go||(own.vote&&!own.vote.done)||room.players.size+KartBots.normalize(own.bots,room.players.size).count<2)return;
        if(!KartLobbyClasses.allReady(own,room.api.peers()))throw Error(KartLobbyClasses.message(own.category));if(peer.setLocked)await peer.setLocked(true);
        const order=[...room.players.keys()].sort();room.clearRound();for(const id of order)active.add(id);gate.begin(data.go,order);
        sendState(peer.id,{...data,order,raceStartAt:0,remaining:active.size});
      }else sendState(peer.id,data);
    };
    room.api.setVehicleClass=async category=>{if(own.go||!KartLobbyClasses.accepts(own,category))throw Error(KartLobbyClasses.message(own.category));if(peer.setVehicleClass)await peer.setVehicleClass(category);sendState(peer.id,{driverClass:category,visualCategory:category,loadReady:false,raceReady:false})};
    room.api.chooseMap=map=>{if(own.go||!Object.hasOwn(MAPS,map))return;vote.cancel();sendState(peer.id,{map,vote:null})};
    room.api.startVote=maps=>{if(!own.go&&vote.begin(maps,[...room.players.keys()]))publishVote()};
    room.api.vote=(token,map)=>castVote(peer.id,token,map);
    room.api.ready=(round,kind)=>{if(!room.closed)markReady(peer.id,round,kind)};
    room.api.back=round=>{if(!room.closed&&round===own.go)returnDriver(peer.id)};
    room.api.restart=round=>{if(room.closed||round!==own.go)return;active.clear();gate.cancel();room.clearRound();sendState(peer.id,{go:0,raceStartAt:0,remaining:0,order:[]});queueMicrotask(()=>{if(!room.closed)room.api.presence({go:Math.max(Date.now(),round+1)})})};
    return {room:room.api,code,host:true,mode,invitePeer:peer.id,now:Date.now};
  }

  async function join(code,driver,onLost,mode='local',spectator=false){
    const peer=mode==='web'?await (spectator?KartWebPeer.watch(code):KartWebPeer.join(code,driver.category)):await connect(await loadPeer());
    const room=makeRoom(peer,onLost);
    return new Promise((resolve,reject)=>{
      let ready=false,sent,offset=0,link;const classRequests=new Map();let classSequence=0;
      const fail=message=>{
        if(room.closed)return;
        clearTimeout(timer);
        if(ready)room.lost(message);
        else{room.api.leave();reject(new Error(message))}
      };
      const timer=setTimeout(()=>fail(mode==='web'?'Keine direkte Verbindung möglich. Prüft eure Netzwerke.':'Verbindung abgelaufen. Prüfe den Code und eure Internetverbindungen.'),mode==='web'?45000:15000);
      peer.on('error',error=>{
        if(error.type==='peer-unavailable')fail('Spiel nicht gefunden. Prüfe den Code und ob der Host noch wartet.');
        else if(!ready)fail('Der Onlinedienst ist nicht erreichbar. Versuche es erneut.');
      });
      try{link=peer.connect(peerId(code),{serialization:'json',reliable:true})}
      catch(error){fail('Die Verbindung konnte nicht aufgebaut werden.');return}
      if(!link){fail('Die Verbindung konnte nicht aufgebaut werden.');return}
      link.on('open',()=>{sent=Date.now();link.send({t:'join',...driver,protocol:KartRaceReady.protocol})});
      link.on('close',()=>fail('Die Verbindung zum Host wurde getrennt.'));
      link.on('error',()=>fail('Die Verbindung zum Host ist fehlgeschlagen.'));
      link.on('data',msg=>{
        if(room.closed||!msg||typeof msg!=='object')return;
        if(!ready){
          if(msg.t==='reject'){fail(msg.reason);return}
          if(msg.t!=='welcome'||!Array.isArray(msg.players)||!Number.isFinite(msg.now))return;
          if(msg.protocol!==KartRaceReady.protocol){fail(KartRaceReady.text().version);return}
          clearTimeout(timer);
          const received=Date.now();
          offset=msg.now-(received+sent)/2;
          for(const [id,data] of msg.players)room.update(id,data);
          if(!spectator)room.update(peer.id,driverInfo(driver));
          ready=true;
          resolve({room:room.api,code,host:false,spectator,mode,invitePeer:peer.id,now:()=>Date.now()+offset});
        }else if(msg.t==='class-result'){const pending=classRequests.get(msg.request);if(pending){clearTimeout(pending.timer);classRequests.delete(msg.request);if(msg.ok)pending.resolve();else pending.reject(Error(msg.reason))}
        }else if(msg.t==='state'){
          if(msg.id===link.peer&&msg.data?.go===0)room.clearRound();
          room.update(msg.id,msg.data);
        }else if(msg.t==='left')room.remove(msg.id);
      });
      const round=()=>room.players.get(link.peer)?.presence.go;
      room.api.presence=async data=>{if(!spectator&&link.open&&!room.closed)link.send({t:'state',data,round:round()})};
      room.api.setVehicleClass=async category=>{const policy=room.players.get(link.peer)?.presence;if(!policy||policy.go||!KartLobbyClasses.accepts(policy,category))throw Error(KartLobbyClasses.message(policy?.category));if(peer.setVehicleClass)await peer.setVehicleClass(category);return new Promise((resolve,reject)=>{const request=++classSequence,timer=setTimeout(()=>{classRequests.delete(request);reject(Error('Klassenwechsel nicht bestätigt.'))},5000);classRequests.set(request,{resolve,reject,timer});link.send({t:'vehicle-class',category,request})})};
      room.api.vote=(voteId,map)=>{if(!spectator&&link.open&&!room.closed)link.send({t:'map-vote',voteId,map})};
      room.api.ready=(round,kind)=>{if(!spectator&&link.open&&!room.closed)link.send({t:'ready',round,kind})};
      room.api.back=round=>{if(!spectator&&link.open&&!room.closed)link.send({t:'back',round})};
    });
  }
  return {host,join};
})();
