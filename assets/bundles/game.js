
;/* network-runtime.js */
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


;/* game.js */
const $=id=>document.getElementById(id);
const SETTINGS_DEFAULT={quality:'high',shadows:true,experimentalShaders:false,rearIndicator:true,glass:true,brightness:1,master:80,effects:80,musicVolume:50,music:true};
const PREF={...SETTINGS_DEFAULT};
try{const saved=JSON.parse(KartStorage.getItem('kart-settings')||'{}');for(const k in PREF)if(typeof saved[k]===typeof PREF[k])PREF[k]=saved[k]}catch(e){}
if(!['low','medium','high'].includes(PREF.quality))PREF.quality='high';
for(const k of ['master','effects','musicVolume'])PREF[k]=Number.isFinite(PREF[k])?Math.max(0,Math.min(100,PREF[k])):SETTINGS_DEFAULT[k];
PREF.brightness=Number.isFinite(PREF.brightness)?Math.max(.6,Math.min(1.5,PREF.brightness)):1;
document.documentElement.dataset.glass=String(PREF.glass);
const graphicsRenderers=new Set();
function applyGraphics(r){applyQuality(r);r._qualityKey=null}
const musicPlayer=new Audio();musicPlayer.loop=true;let musicURL='',settingsSection='controls';
function applyMusic(){musicPlayer.volume=PREF.master*PREF.musicVolume/10000;if(PREF.music&&musicURL&&!window.kartAudioPaused)musicPlayer.play().catch(()=>{});else musicPlayer.pause()}
function savePreferences(){document.documentElement.dataset.glass=String(PREF.glass);try{KartStorage.setItem('kart-settings',JSON.stringify(PREF))}catch(e){}for(const r of graphicsRenderers)applyGraphics(r);for(const m of surfaceMaterials)updateSurface(m);for(const m of artMaterials)refreshArt(m);for(const r of [SR.scene,window.kartRaceScene].filter(Boolean))r.traverse(g=>{if(g.userData.paints)KartModels.setSkin(g,g.userData.skin)});applyMusic()}
function soundLevel(){return PREF.master*PREF.effects/10000}
function drawPreferences(){
 $('rearIndicatorToggle').checked=PREF.rearIndicator;
 const range=(key,label,min,max,step)=>'<label class="pref-row">'+label+' <output id="value-'+key+'">'+PREF[key]+'</output><input type="range" data-pref="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+PREF[key]+'"></label>';
 const toggle=(key,label)=>'<label class="pref-row">'+label+' <input type="checkbox" data-pref="'+key+'" '+(PREF[key]?'checked':'')+'></label>';
 $('settings-graphics').innerHTML='<p class="note">Renderer: WebGL · Three.js</p><label class="pref-row">Renderqualität<select data-pref="quality"><option value="low">Niedrig · sparsam</option><option value="medium">Mittel</option><option value="high">Sehr hoch</option></select></label>'+toggle('glass','Glass')+toggle('shadows','Schatten')+toggle('experimentalShaders','Shader · Experimental')+range('brightness','Helligkeit',.6,1.5,.05)+'<p class="note">Strukturierte Materialien und Texturfilterung sind aktiv. Hohe Qualität erhöht die Bildauflösung.</p>';
 $('settings-graphics').querySelector('select').value=PREF.quality;const shaderToggle=$('settings-graphics').querySelector('[data-pref=experimentalShaders]');shaderToggle.disabled=PREF.quality!=='high';shaderToggle.closest('label').classList.toggle('pref-disabled',shaderToggle.disabled);
 $('settings-sound').innerHTML=range('master','Gesamtlautstärke',0,100,1)+range('effects','Motor & Reifengeräusche',0,100,1)+toggle('music','Musik abspielen')+range('musicVolume','Musiklautstärke',0,100,1)+'<label class="pref-row">Eigene Hintergrundmusik<input id="musicFile" type="file" accept="audio/*"></label><p class="note">Noch keine Musik enthalten. Deine Audiodatei wird in Schleife gespielt und bleibt für diese Sitzung geladen.</p>';
 document.querySelectorAll('[data-pref]').forEach(input=>input.oninput=()=>{PREF[input.dataset.pref]=input.type==='checkbox'?input.checked:input.tagName==='SELECT'?input.value:+input.value;if(input.dataset.pref==='quality'){if(PREF.quality!=='high')PREF.experimentalShaders=false;shaderToggle.checked=PREF.experimentalShaders;shaderToggle.disabled=PREF.quality!=='high';shaderToggle.closest('label').classList.toggle('pref-disabled',shaderToggle.disabled)}const output=$('value-'+input.dataset.pref);if(output)output.value=input.value;savePreferences()});
 $('musicFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(window.KartAccount){try{await KartAccount.uploadMusic(file)}catch(error){window.accountError?.('music')}return;}musicPlayer.pause();if(musicURL)URL.revokeObjectURL(musicURL);musicURL=URL.createObjectURL(file);musicPlayer.src=musicURL;applyMusic()};
}
function selectSettings(section){KartUI.settings(section,()=>{settingsSection=section;$('reset').hidden=['account','privacy'].includes(section);if(section==='privacy')window.refreshPrivacy?.();if(section==='account')window.refreshAccount?.();rebind=null;document.querySelectorAll('#settingsTabs button').forEach(b=>{b.classList.toggle('on',b.dataset.section===section);b.setAttribute('aria-pressed',b.dataset.section===section)});for(const name of ['controls','graphics','sound','language','account','privacy'])$('settings-'+name).hidden=name!==section;});}

const MAPS={"circuit":{"S":1.7,"W":14,"bw":8,"ctrl":[[0,0],[60,-10],[120,20],[150,90],[110,150],[40,130],[-10,170],[-80,150],[-110,90],[-70,40],[-100,-20],[-50,-60]],"sky":["#4a86d4","#b6d6ee","#f3e9d0"],"fog":14279912,"fogN":180,"fogF":900,"hemi":[12572927,7035450,0.8],"sunC":16769720,"sunI":1.25,"ground":"#3f7d2c","road":"#3a3c40","tree":2054698,"grip":1,"off":0.6,"trees":true,"mount":true,"mc":8360864,"mh":120},"snow":{"S":1.5,"W":13,"bw":8,"ctrl":[[0,0,0],[70,-20,3],[140,0,9],[190,60,18],[170,130,25],[100,150,30],[60,125,27],[20,150,18],[-40,170,12],[-110,130,15],[-130,60,9],[-80,10,3],[-130,-50,-4],[-60,-90,-6],[-10,-60,-3]],"sky":["#7fa3c7","#cfdde9","#f1f5f8"],"fog":14411502,"fogN":80,"fogF":520,"hemi":[15134975,12110040,0.95],"sunC":16774368,"sunI":1,"ground":"#f2f6fa","road":"#dfe7ee","line":"#7d8d9c","tree":6260087,"grip":0.65,"off":0.4,"trees":true,"mount":true,"snow":true,"terrain":true},"indoor":{"S":1.3,"W":12,"bw":2.2,"ctrl":[[60.104076400856535,48,1.15966796875],[70.67491704571634,44.34621756054176,3.9396286010742188],[78.52976026345937,33.941125496954285,5],[83.36674883427459,18.368804753524316,5],[85,5.878304635907295e-15,5],[83.36674883427459,-18.368804753524305,5],[78.52976026345937,-33.94112549695428,5.328063964843751],[70.67491704571636,-44.34621756054175,7.850532531738281],[60.10407640085654,-48,9.94384765625],[47.22346980666619,-44.34621756054176,10],[32.52809175103264,-33.941125496954285,10],[16.58267737137093,-18.368804753524337,10],[1.0409497792752502e-14,-1.175660927181459e-14,10],[-16.58267737137091,18.368804753524316,10],[-32.52809175103262,33.94112549695427,10],[-47.22346980666617,44.34621756054175,9.607658386230467],[-60.104076400856535,48,7.03369140625],[-70.67491704571634,44.34621756054176,5.031929016113282],[-78.52976026345935,33.94112549695432,5],[-83.36674883427457,18.368804753524344,5],[-85,1.7634913907721887e-14,5],[-83.36674883427459,-18.368804753524312,5],[-78.52976026345937,-33.9411254969543,4.785156250000002],[-70.67491704571637,-44.346217560541746,2.9663085937500027],[-60.104076400856556,-48,0.7812500000000018],[-47.22346980666619,-44.34621756054176,0],[-32.52809175103268,-33.94112549695433,0],[-16.58267737137094,-18.36880475352435,0],[-2.0818995585505004e-14,-2.351321854362918e-14,0],[16.582677371370902,18.36880475352431,0],[32.52809175103265,33.94112549695429,0],[47.22346980666616,44.346217560541746,0]],"sky":["#1b1e24","#23272e","#2a2f37"],"fog":2303790,"fogN":90,"fogF":420,"hemi":[14673663,5593439,0.95],"sunC":16777215,"sunI":0.55,"ground":"#3b3f45","road":"#2d2f33","tree":0,"grip":1.05,"off":0.75,"indoor":true},"spa":{"S":1,"W":12,"bw":7,"ctrl":[[-99.6,-408,0],[-104.6,-416.7,0],[-109.6,-425.4,0],[-114.6,-434,-0.1],[-119.6,-442.7,-0.1],[-124.6,-451.4,-0.1],[-129.6,-460.1,-0.1],[-133.6,-469.3,-0.2],[-131.5,-478.7,-0.6],[-122.9,-483.1,-2.6],[-113.3,-480.4,-3.2],[-104.2,-476.2,-3.4],[-95.2,-471.8,-3.7],[-86.2,-467.4,-4],[-77.4,-462.5,-4.3],[-68.9,-457.2,-4.7],[-60.7,-451.5,-5.1],[-52.7,-445.5,-5.4],[-44.8,-439.3,-5.9],[-37.2,-432.8,-6.5],[-30,-425.9,-7.2],[-23.2,-418.5,-8.1],[-16.6,-411,-8.5],[-10.1,-403.3,-8.7],[-3.7,-395.6,-8.9],[2.8,-388,-9],[9.2,-380.3,-9.2],[15.7,-372.7,-9.4],[22.2,-365,-9.5],[28.6,-357.4,-9.7],[35.1,-349.7,-9.9],[41.6,-342.1,-10.1],[48.6,-335,-10.3],[56.8,-329.2,-9.8],[65.2,-323.8,-8.5],[73.2,-317.8,-6.8],[79.9,-310.3,-4.7],[84.9,-301.6,-2.9],[88.2,-292.2,-1.4],[90.1,-282.4,-0.4],[91.5,-272.5,0.7],[94.3,-262.9,3],[98.9,-253.9,5.2],[104.1,-245.4,6.1],[109.5,-236.9,6.5],[114.8,-228.5,7],[120.2,-220,7.4],[125.5,-211.5,7.9],[130.8,-203,8.4],[136.2,-194.6,9],[141.5,-186.1,9.7],[146.8,-177.6,10.4],[151.9,-169,11.4],[156.3,-160,12.9],[160.2,-150.7,14.6],[163.4,-141.2,15.6],[166.2,-131.6,16.1],[169,-122,16.3],[171.8,-112.4,16.4],[174.6,-102.7,16.4],[177.3,-93.1,16.5],[180.1,-83.5,16.6],[182.9,-73.9,16.7],[185.7,-64.2,16.8],[188.4,-54.6,16.9],[191.2,-45,17],[194,-35.4,17],[196.8,-25.8,17.1],[199.6,-16.1,17.2],[202.4,-6.5,17.3],[205.2,3.1,17.4],[208,12.7,17.4],[210.8,22.3,17.5],[213.6,32,17.6],[216.4,41.6,17.7],[219.3,51.2,17.8],[222.1,60.8,17.8],[224.9,70.4,17.9],[227.7,80,18],[230.5,89.7,18.1],[233.2,99.3,18.3],[235.9,108.9,18.7],[238.6,118.6,19.2],[241.1,128.3,19.9],[241.2,138.3,21.7],[236.4,146.9,22.8],[228.6,153.2,22.6],[222.2,160.8,21.9],[220.2,170.5,21.3],[221.6,180.4,21.1],[223.8,190.2,21],[226,200,20.9],[227.4,209.9,20.5],[225.9,219.7,19.4],[220.2,227.8,18.3],[212.3,234.1,17.8],[204.1,239.7,17.7],[195.8,245.4,17.7],[187.6,251.1,17.7],[179.3,256.7,17.6],[171.1,262.4,17.6],[162.8,268.1,17.6],[154.5,273.7,17.5],[146.3,279.4,17.5],[138,285.1,17.4],[129.7,290.7,17.4],[120.8,295.1,17],[110.9,295.3,16.1],[102.4,290.1,14.9],[98,281.3,13.8],[98.8,271.4,12.4],[104.4,263.2,10.7],[112.4,257.3,9.9],[120.9,252,9.8],[129.5,246.8,9.6],[138,241.5,9.4],[146.2,235.8,9.1],[152.3,228,7.9],[153.7,218.2,6.7],[151.5,208.4,6.3],[148.3,198.9,6.2],[145,189.5,6.1],[141.8,180,6],[138.6,170.5,5.9],[135.8,160.9,5.8],[133.3,151.2,5.5],[131.1,141.4,5.3],[129.2,131.6,5.2],[127.3,121.7,5.1],[125.4,111.9,5],[123.5,102,4.9],[121.7,92.2,4.8],[119.9,82.3,4.6],[118.2,72.5,4.3],[116.6,62.6,4.1],[114.9,52.7,3.7],[112.1,43.1,2.6],[107,34.5,1.5],[99.7,27.6,0.8],[91,22.7,0.4],[81.4,20.1,0.2],[71.4,19.1,0],[61.4,18.5,-0.2],[51.4,18.7,-0.5],[41.6,20.6,-1],[32.3,24.2,-1.7],[23.7,29.4,-2.3],[16.2,36,-2.9],[10.1,43.9,-3.5],[5.2,52.7,-4],[1.1,61.8,-4.2],[-2.6,71.1,-4.3],[-6.4,80.4,-4.3],[-10.1,89.7,-4.4],[-13.9,99,-4.5],[-17.6,108.3,-4.6],[-21.4,117.5,-4.6],[-25.1,126.8,-4.7],[-28.9,136.1,-4.8],[-32.6,145.4,-4.8],[-36.4,154.7,-4.9],[-40.5,163.8,-5],[-46.3,172,-5.2],[-54.3,177.9,-5.5],[-63.9,180.7,-6],[-73.8,180.1,-6.9],[-83.1,176.4,-7.9],[-91.9,171.6,-8.7],[-101.4,168.5,-9.7],[-111.3,168.7,-10.4],[-120.6,172.3,-10.9],[-128.1,178.9,-11.4],[-134,187,-11.8],[-139.5,195.4,-11.9],[-144.9,203.8,-12],[-150.3,212.2,-12.1],[-155.7,220.6,-12.2],[-161.1,229.1,-12.3],[-166.6,237.5,-12.4],[-173,245.1,-13],[-181.9,249.4,-14],[-191.8,248.7,-14.4],[-200.6,244,-14.4],[-208.7,238.1,-14.3],[-216.9,232.3,-14.2],[-225,226.4,-14.1],[-232.9,220.3,-13.9],[-239.6,212.9,-13.6],[-244.4,204.1,-13.1],[-246.7,194.4,-12.7],[-246.4,184.4,-12.5],[-243.9,174.7,-12],[-240.4,165.3,-11.5],[-236.9,156,-11],[-232.7,146.9,-10.5],[-227.8,138.1,-10.1],[-222.3,129.8,-9.6],[-216.3,121.8,-9.2],[-209.7,114.2,-8.8],[-203,106.8,-8.5],[-195.9,99.7,-8.3],[-188.7,92.7,-8.1],[-181.5,85.8,-7.9],[-173.9,79.2,-7.8],[-165.9,73.2,-7.5],[-157.5,67.8,-7.4],[-148.7,62.9,-7.3],[-139.8,58.3,-7.2],[-130.9,53.7,-7.2],[-122,49.1,-7.2],[-113.1,44.5,-7.2],[-104.2,39.9,-7.1],[-95.3,35.3,-7.1],[-86.6,30.3,-7],[-78.3,24.8,-6.7],[-70.6,18.4,-6.3],[-63.4,11.4,-5.8],[-56.9,3.8,-5.3],[-51.1,-4.4,-4.8],[-46.1,-13,-4.4],[-41.5,-22,-4],[-37.3,-31,-3.7],[-33.1,-40.2,-3.5],[-29,-49.3,-3.3],[-24.9,-58.4,-3.2],[-20.9,-67.6,-3],[-17.7,-77.1,-2.6],[-16.2,-87,-2.4],[-16.6,-97,-2.2],[-19,-106.7,-2.1],[-22.6,-116,-2.1],[-26.2,-125.4,-2],[-29.9,-134.7,-2],[-33.5,-144.1,-1.9],[-37.1,-153.4,-1.9],[-40.6,-162.8,-1.8],[-44.1,-172.2,-1.7],[-47.5,-181.6,-1.6],[-50.4,-191.2,-1.5],[-52.6,-201,-1.3],[-54.5,-210.8,-1.1],[-55.9,-220.7,-0.9],[-57.1,-230.7,-0.7],[-58,-240.6,-0.5],[-58.7,-250.6,-0.5],[-59.3,-260.6,-0.4],[-60,-270.6,-0.4],[-60,-280.6,-0.3],[-56.2,-289.6,-0.1],[-47.6,-294.7,0.1],[-42.6,-303,0.1],[-44.1,-312.8,0.1],[-49.3,-321.4,0.1],[-54.5,-329.9,0.1],[-59.7,-338.5,0.1],[-64.7,-347.2,0.1],[-69.7,-355.9,0.1],[-74.6,-364.6,0],[-79.6,-373.3,0],[-84.6,-381.9,0],[-89.6,-390.6,0],[-94.6,-399.3,0]],"corners":[[0.033,"La Source"],[0.11,"Eau Rouge"],[0.143,"Raidillon"],[0.164,"Kemmel-Gerade"],[0.323,"Les Combes"],[0.341,"Malmedy"],[0.405,"Bruxelles"],[0.446,"Pouhon"],[0.531,"Les Fagnes"],[0.621,"Campus"],[0.682,"Stavelot"],[0.723,"Blanchimont"],[0.935,"Bus Stop"],[0.975,"Start/Ziel"]],"sky":["#4a86d4","#b6d6ee","#e9eee6"],"fog":13229540,"fogN":160,"fogF":800,"hemi":[12572927,4876856,0.85],"sunC":16771524,"sunI":1.15,"ground":"#3f7d2c","road":"#3a3c40","tree":1923628,"grip":1,"off":0.6,"trees":true,"mount":true,"mc":6126170,"mh":140,"terrain":true},"monaco":{"S":1,"W":9.5,"bw":1.6,"ctrl":[[-248.6,184.8,0],[-249.6,174.8,0.031],[-250.4,164.9,0.069],[-251.3,154.9,0.1],[-251.9,144.9,0.131],[-252.1,134.9,0.175],[-252.1,124.9,0.231],[-251.8,114.9,0.306],[-251.2,104.9,0.4],[-250.4,94.9,0.5],[-249.3,85,0.6],[-247.5,75.2,0.706],[-244.8,65.5,0.831],[-241.7,56,0.975],[-239.1,46.4,1.125],[-237.8,36.4,1.294],[-237.8,26.4,1.55],[-233.9,17.5,1.962],[-224.9,13.5,2.519],[-215.1,11.7,3.163],[-205.1,10.9,3.837],[-195.1,9.8,4.481],[-185.2,8.6,5.069],[-175.3,7.3,5.625],[-165.4,5.9,6.169],[-155.5,4.2,6.675],[-145.7,2.2,7.088],[-136.1,-0.5,7.381],[-126.5,-3.3,7.6],[-116.9,-6.1,7.8],[-107.3,-8.9,8.006],[-97.7,-11.7,8.238],[-88,-14.3,8.506],[-78.4,-17,8.8],[-68.7,-19.4,9.1],[-58.8,-21.2,9.4],[-48.9,-22.8,9.7],[-39,-24,9.994],[-29.1,-25,10.262],[-19.4,-27.4,10.488],[-10,-31,10.663],[-0.9,-35.2,10.794],[8.1,-39.4,10.9],[17.2,-43.7,11.012],[26.3,-47.9,11.188],[35.4,-51.9,11.481],[44.8,-55.4,11.875],[54.5,-58,12.306],[64.2,-60.2,12.775],[74.1,-62,13.319],[84,-63.5,13.938],[93.8,-65,14.619],[103.7,-66.6,15.394],[113.5,-68.7,16.306],[122.9,-72,17.3],[131.7,-76.8,18.238],[139.7,-82.7,19.056],[146.8,-89.8,19.781],[152.9,-97.7,20.419],[157.5,-106.6,20.938],[159.5,-116.4,21.325],[159.2,-126.4,21.631],[157.5,-136.2,21.944],[154.4,-145.7,22.319],[150.3,-154.8,22.775],[144.3,-162.8,23.313],[136.7,-169.3,23.919],[129.3,-176.1,24.587],[122.6,-183.4,25.256],[118.2,-192.4,25.794],[117.5,-202.3,26.156],[120.6,-211.7,26.425],[125.5,-220.5,26.663],[131.4,-228.5,26.856],[137.6,-236.4,26.988],[143.6,-244.4,27.063],[149.6,-252.4,27.094],[155.6,-260.4,27.106],[161.5,-268.5,27.131],[167.5,-276.5,27.169],[173.4,-284.6,27.194],[179.4,-292.6,27.2],[185.3,-300.6,27.206],[191.3,-308.7,27.231],[197.2,-316.7,27.275],[203.2,-324.8,27.325],[209.5,-332.5,27.344],[218.4,-336.4,27.212],[227.8,-333.3,26.775],[234.3,-325.8,25.987],[236.9,-316.2,24.956],[237.9,-306.3,23.863],[241.1,-296.8,22.869],[245,-289,21.981],[250,-278,21.075],[255,-267,20.1],[261,-258,19.1],[269,-254,18.1],[278,-256,17.1],[282,-264,16.1],[280,-273,15.1],[274,-282,14.1],[267,-291,13.087],[261,-300,11.969],[259,-310,10.525],[264,-319,8.681],[266.3,-324.6,6.8],[275.8,-327.6,5.313],[285.2,-331.1,4.269],[294.8,-334.1,3.544],[304.7,-334.6,3.069],[312.1,-328.6,2.781],[313.5,-318.7,2.619],[313.2,-308.7,2.531],[312.9,-298.8,2.475],[312.5,-288.8,2.425],[312.1,-278.8,2.369],[311.1,-268.8,2.3],[309.7,-258.9,2.231],[308.2,-249,2.175],[306.7,-239.1,2.125],[305.2,-229.2,2.069],[303.4,-219.4,1.994],[301.1,-209.6,1.906],[298.7,-199.9,1.831],[296.2,-190.2,1.769],[293,-180.8,1.694],[289.4,-171.4,1.606],[285.3,-162.3,1.531],[280.4,-153.6,1.469],[275.5,-144.9,1.394],[270.1,-136.4,1.3],[264.1,-128.4,1.2],[257.9,-120.6,1.1],[251.5,-112.9,1],[244.8,-105.5,0.9],[238,-98.1,0.8],[231.2,-90.8,0.7],[223.5,-84.4,0.6],[215.1,-79,0.5],[206.5,-73.8,0.4],[198,-68.6,0.3],[189.3,-63.6,0.2],[180.4,-59.1,0.1],[171.4,-54.7,0.006],[162.4,-50.4,-0.069],[153.3,-46.2,-0.125],[144.2,-42,-0.169],[135.1,-37.8,-0.2],[126,-33.8,-0.231],[116.6,-30.2,-0.275],[107.2,-27,-0.325],[97.6,-23.9,-0.375],[88,-21.3,-0.431],[78.2,-19,-0.5],[68.5,-16.8,-0.569],[58.7,-14.5,-0.631],[48.9,-12.6,-0.706],[39,-11,-0.806],[29.2,-9.4,-0.944],[19.3,-7.6,-1.137],[11.2,-2.2,-1.369],[7.1,6.9,-1.587],[-1.2,11.9,-1.763],[-11.1,11.1,-1.894],[-20.6,8.4,-1.994],[-30.6,8.7,-2.063],[-40.5,9.9,-2.094],[-50.5,11.2,-2.1],[-60.4,12.5,-2.1],[-70.3,13.8,-2.1],[-80.2,15.1,-2.106],[-90.1,16.4,-2.131],[-100.1,17.8,-2.169],[-110,19.2,-2.194],[-119.9,20.6,-2.206],[-129.8,22,-2.231],[-139.7,23.5,-2.269],[-149.6,25,-2.3],[-159.4,26.6,-2.331],[-169.3,28.1,-2.369],[-179.2,29.6,-2.394],[-188.5,33,-2.4],[-194.9,40.7,-2.4],[-199.4,49.6,-2.4],[-203.6,58.7,-2.4],[-207.4,67.9,-2.4],[-210.6,77.4,-2.4],[-212.8,87.1,-2.4],[-214.3,97,-2.4],[-215.3,107,-2.4],[-215.5,117,-2.4],[-215.5,127,-2.4],[-215.2,137,-2.4],[-212.2,146.4,-2.4],[-205.4,153.7,-2.4],[-197.7,160.1,-2.4],[-191.7,168,-2.4],[-189.1,177.6,-2.4],[-187.5,187.5,-2.4],[-185.8,197.4,-2.4],[-184.1,207.2,-2.4],[-182.4,217.1,-2.4],[-180.7,226.9,-2.4],[-178.9,236.8,-2.4],[-176.9,246.6,-2.4],[-175.2,256.4,-2.4],[-179,265.4,-2.4],[-186.7,271.7,-2.4],[-190.1,280.7,-2.4],[-188.1,290.5,-2.394],[-184.9,300,-2.369],[-181.4,309.3,-2.325],[-177.5,318.6,-2.269],[-173,327.5,-2.2],[-167.9,336.1,-2.131],[-162.1,344.3,-2.075],[-155.8,352,-2.025],[-148.7,359.1,-1.969],[-140.8,365.2,-1.9],[-132.1,370,-1.831],[-123.1,374.4,-1.769],[-115.4,380.7,-1.694],[-112.6,390.1,-1.6],[-118.3,397.7,-1.506],[-127.8,400.9,-1.431],[-137.5,403.4,-1.369],[-147.3,405.3,-1.294],[-157.3,406.3,-1.2],[-167.2,405.3,-1.1],[-175.2,399.8,-1],[-178.3,390.3,-0.9],[-181.2,380.8,-0.806],[-186.8,372.5,-0.731],[-192.9,364.6,-0.669],[-198.5,356.3,-0.594],[-203.9,347.9,-0.5],[-209.2,339.4,-0.406],[-213.3,330.3,-0.338],[-216.8,320.9,-0.3],[-219.9,311.4,-0.269],[-222.7,301.8,-0.231],[-225.5,292.2,-0.206],[-228.3,282.6,-0.2],[-231.1,273,-0.2],[-233.8,263.4,-0.194],[-236.5,253.7,-0.169],[-239,244,-0.131],[-241.1,234.2,-0.106],[-242.8,224.4,-0.1],[-244.4,214.5,-0.094],[-245.8,204.6,-0.069],[-247.3,194.7,-0.031]],"corners":[[0.03,"Start/Ziel"],[0.058,"Sainte Dévote"],[0.085,"Beau Rivage"],[0.22,"Massenet"],[0.33,"Casino"],[0.359,"Mirabeau"],[0.374,"Grand Hotel Haarnadel"],[0.392,"Mirabeau Bas"],[0.42,"Portier"],[0.455,"Tunnel"],[0.612,"Nouvelle Chicane"],[0.705,"Tabac"],[0.745,"Piscine"],[0.845,"La Rascasse"],[0.9,"Anthony Noghes"],[0.93,"Start/Ziel"]],"sky":["#4a9fe0","#b9dcf2","#f6f1e0"],"fog":14149358,"fogN":200,"fogF":900,"hemi":[13625087,9077358,0.9],"sunC":16773328,"sunI":1.2,"ground":"#b9b2a3","road":"#35373b","tree":0,"grip":1,"off":0.7,"city":true,"terrain":true,"tn":1.5,"mount":true,"mc":10985360,"mh":200,"curveType":"centripetal","arcDivisions":6000},"monza":{"S":1,"W":13,"bw":7,"ctrl":[[-160.8,189,0],[-159.8,179,0],[-159,169,0],[-158.1,159.1,0],[-157.3,149.1,0],[-156.4,139.1,0],[-155.6,129.1,0],[-154.7,119.1,0],[-153.9,109.2,0],[-153,99.2,0],[-152.2,89.2,0],[-151.3,79.2,0],[-150.5,69.2,0],[-149.6,59.3,0],[-148.8,49.3,0],[-147.9,39.3,0],[-147.1,29.3,0],[-146.2,19.4,-0.1],[-145.2,9.4,-0.1],[-144.3,-0.6,-0.1],[-143.4,-10.6,-0.1],[-142.5,-20.5,-0.1],[-141.5,-30.5,-0.1],[-139.9,-40.4,-0.1],[-133.3,-47.5,-0.2],[-126.3,-54.3,0],[-125.8,-64.2,0.2],[-128,-74,0.2],[-130.6,-83.7,0.2],[-132.9,-93.4,0.2],[-134.3,-103.3,0.3],[-134.7,-113.3,0.4],[-134.2,-123.3,0.5],[-133.4,-133.3,0.5],[-132.7,-143.3,0.5],[-131.9,-153.3,0.5],[-131.1,-163.3,0.5],[-130,-173.2,0.5],[-128.1,-183,0.6],[-125.2,-192.6,0.6],[-121.5,-201.9,0.6],[-117.2,-211,0.6],[-111.9,-219.5,0.7],[-105.9,-227.4,0.7],[-99.1,-234.9,0.7],[-91.8,-241.7,0.8],[-84,-247.9,0.8],[-75.7,-253.5,0.9],[-67,-258.5,0.9],[-58.1,-263,1],[-48.8,-266.8,1.1],[-39.3,-269.9,1.1],[-29.6,-272.5,1.1],[-19.8,-274.5,1.2],[-9.9,-275.9,1.2],[0.1,-276.8,1.2],[10.1,-277.7,1.3],[20.1,-278.5,1.3],[30,-279.4,1.3],[40,-280.2,1.3],[50,-281.1,1.3],[60,-281.9,1.3],[70,-282.6,1.3],[80,-283.2,1.3],[90,-283.8,1.3],[100,-284.4,1.3],[110,-285,1.3],[120,-285.6,1.3],[130,-286.2,1.3],[139.9,-287.6,1.4],[147,-294.2,1.4],[152.9,-302.1,1.4],[162.3,-305.3,1.5],[172.1,-307.4,1.6],[181.8,-310,1.6],[191.3,-313.1,1.6],[200.8,-316.3,1.6],[210.3,-319.5,1.6],[219.8,-322.6,1.6],[229.3,-325.8,1.6],[238.8,-329,1.6],[248.3,-332.1,1.7],[257.8,-335.2,1.7],[267.6,-337.2,1.7],[277.5,-336.2,1.9],[286.5,-331.9,2],[293.6,-324.9,2.1],[297.7,-315.8,2.2],[299.3,-305.9,2.2],[300.3,-296,2.2],[301.2,-286,2.2],[302.1,-276,2.3],[303.1,-266.1,2.3],[304.1,-256.1,2.3],[305.1,-246.1,2.3],[306.1,-236.2,2.3],[307,-226.2,2.3],[306,-216.3,2.3],[299.9,-208.5,2.4],[291.3,-203.4,2.4],[282.5,-198.7,2.4],[273.6,-193.9,2.4],[264.8,-189.2,2.4],[256,-184.4,2.4],[247.2,-179.6,2.4],[238.4,-174.8,2.4],[229.7,-169.9,2.4],[220.9,-165,2.4],[212.2,-160.2,2.5],[203.4,-155.4,2.5],[194.6,-150.6,2.5],[185.9,-145.6,2.5],[177.5,-140.2,2.5],[169.3,-134.4,2.5],[161.3,-128.4,2.4],[153.6,-121.9,2.2],[146,-115.4,2.1],[138.4,-108.9,2.1],[130.8,-102.4,2],[123.2,-95.9,2],[115.6,-89.4,1.9],[108,-82.8,1.9],[100.6,-76.1,1.9],[93.1,-69.4,1.8],[85.7,-62.7,1.8],[78.2,-56.1,1.7],[70.6,-49.5,1.7],[63.1,-42.9,1.6],[55.5,-36.4,1.6],[48,-29.8,1.6],[40.4,-23.2,1.6],[32.9,-16.6,1.5],[25.3,-10,1.5],[17.8,-3.4,1.5],[10.2,3.1,1.4],[2.7,9.7,1.3],[-4.9,16.3,1.3],[-12.3,23,1.1],[-18.8,30.6,0.8],[-20.9,40.2,0.6],[-20.1,50.2,0.5],[-20.3,60.2,0.4],[-22.9,69.8,0.3],[-27.9,78.5,0.2],[-34.7,85.8,0.1],[-42,92.7,0.1],[-46.7,101.4,0],[-48.6,111.3,0],[-49.8,121.2,0],[-51,131.2,0],[-52.2,141.1,0],[-53.4,151,0],[-54.6,161,0],[-55.8,170.9,0],[-56.8,180.9,0],[-57.9,190.9,0],[-58.9,200.8,0],[-59.9,210.8,0],[-61,220.7,0],[-62,230.7,0],[-63,240.7,0],[-64.1,250.6,0],[-65.1,260.6,0],[-66.1,270.6,0],[-67.2,280.5,0],[-68.2,290.5,0],[-69.2,300.4,0],[-70.3,310.4,0],[-71.3,320.4,0],[-72.4,330.3,0],[-73.4,340.3,0],[-74.4,350.2,0],[-75.5,360.2,0],[-76.5,370.2,0],[-77.5,380.1,0],[-78.6,390.1,0],[-79.6,400.1,0],[-80.6,410,-0.1],[-81.7,420,-0.1],[-82.7,429.9,-0.1],[-83.8,439.9,-0.1],[-84.8,449.9,-0.1],[-85.9,459.8,-0.1],[-87.9,469.6,-0.1],[-92.4,478.5,-0.2],[-99.6,485.3,-0.2],[-108.6,489.7,-0.3],[-118.5,491,-0.3],[-128.3,489.3,-0.3],[-137.6,485.6,-0.3],[-146.1,480.3,-0.3],[-153.5,473.6,-0.3],[-159.7,465.7,-0.3],[-164.7,457.1,-0.2],[-168.6,447.8,-0.2],[-171.6,438.3,-0.2],[-173.6,428.5,-0.2],[-174.8,418.5,-0.2],[-175.3,408.5,-0.1],[-175.5,398.5,-0.1],[-175.7,388.5,-0.1],[-175.9,378.5,-0.1],[-176.2,368.5,-0.1],[-176.4,358.4,-0.1],[-176.4,348.4,-0.1],[-176.2,338.4,-0.1],[-175.6,328.4,0],[-174.8,318.4,0],[-173.9,308.5,0],[-172.9,298.5,0],[-171.8,288.5,0],[-170.8,278.6,0],[-169.7,268.6,0],[-168.7,258.7,0],[-167.6,248.7,0],[-166.6,238.7,0],[-165.5,228.8,0],[-164.4,218.8,0],[-163.2,208.9,0],[-161.9,198.9,0]],"corners":[[0.03,"Start/Ziel"],[0.1,"Variante del Rettifilo"],[0.139,"Curva Grande"],[0.31,"Variante della Roggia"],[0.4,"Lesmo 1"],[0.445,"Lesmo 2"],[0.52,"Serraglio"],[0.625,"Variante Ascari"],[0.68,"Gegengerade"],[0.84,"Parabolica"],[0.95,"Start/Ziel"]],"sky":["#4f8bd6","#b4d4ee","#eef0e6"],"fog":13623528,"fogN":200,"fogF":900,"hemi":[13625087,5205816,0.85],"sunC":16773590,"sunI":1.15,"ground":"#4a8431","road":"#3a3c40","tree":2383919,"grip":1.05,"off":0.6,"trees":true,"mount":true,"mc":9413288,"mh":80,"terrain":true,"tn":1.2},"nurburgring":{"S":1,"W":14,"bw":7,"ctrl":[[0,0,0],[-8.11,8.28,0.11],[-16.22,16.55,0.22],[-24.33,24.83,0.32],[-32.44,33.1,0.43],[-40.55,41.38,0.54],[-48.66,49.66,0.65],[-56.77,57.93,0.76],[-64.88,66.21,0.87],[-72.98,74.49,0.99],[-81.09,82.76,1.1],[-89.2,91.04,1.22],[-97.31,99.31,1.33],[-105.42,107.59,1.45],[-113.53,115.87,1.57],[-121.64,124.14,1.69],[-129.75,132.42,1.82],[-137.86,140.7,1.94],[-145.97,148.97,2.07],[-154.08,157.25,2.2],[-162.19,165.52,2.33],[-170.3,173.8,2.46],[-178.41,182.08,2.6],[-186.52,190.35,2.74],[-194.63,198.63,2.88],[-202.7,206.58,3.01],[-210.78,214.52,3.14],[-218.86,222.47,3.28],[-226.94,230.42,3.42],[-235.01,238.37,3.56],[-241.5,243.38,3.65],[-247.98,248.4,3.74],[-254.46,253.41,3.83],[-263.94,260.46,3.97],[-273.41,267.51,4.12],[-281.86,273.31,4.25],[-290.3,279.11,4.38],[-298.75,284.91,4.52],[-307.19,290.7,4.67],[-315.64,296.5,4.82],[-324.49,297.67,4.92],[-330.11,294.63,4.95],[-332.95,287.62,4.89],[-331.06,277.57,4.73],[-328.15,266.46,4.51],[-325.24,255.36,4.29],[-320.56,245.66,4.05],[-315.89,235.95,3.81],[-311.25,227.52,3.59],[-306.61,219.08,3.36],[-301.97,210.65,3.12],[-297.33,202.21,2.88],[-295.84,194.19,2.67],[-296.29,184.06,2.4],[-299.77,172.99,2.12],[-303.55,167.85,2],[-307.33,162.71,1.89],[-315.04,155.93,1.76],[-324.34,151.17,1.71],[-335.04,148.99,1.77],[-342.4,149.3,1.88],[-353.58,150.96,2.08],[-364.75,152.61,2.31],[-375.93,154.27,2.55],[-387.11,155.93,2.8],[-397.28,158.69,3.08],[-407.45,161.46,3.37],[-416.48,164.34,3.64],[-425.51,167.22,3.92],[-432.15,171.32,4.19],[-438.79,175.41,4.45],[-446.1,182.11,4.81],[-449.23,189.04,5.07],[-449.38,199.41,5.34],[-447.25,209.46,5.54],[-442.77,213.71,5.53],[-438.29,217.95,5.53],[-432.3,219.71,5.43],[-426.31,221.46,5.34],[-415.61,220.91,5.09],[-404.92,220.37,4.86],[-393.13,220.84,4.63],[-386.27,224.11,4.58],[-379.75,231.59,4.62],[-378.46,240.32,4.78],[-379.33,251.11,5],[-380.2,261.9,5.21],[-381.44,272.58,5.41],[-382.69,283.25,5.6],[-383.93,293.93,5.76],[-385.73,304.34,5.92],[-387.53,314.75,6.06],[-389.33,325.16,6.19],[-391.13,335.57,6.3],[-392.93,345.98,6.39],[-394.56,354.79,6.46],[-396.18,363.59,6.52],[-397.81,372.4,6.56],[-400.02,383.74,6.6],[-402.23,395.07,6.63],[-404.32,402.71,6.64],[-406.41,410.35,6.65],[-409.92,420.96,6.66],[-413.43,431.57,6.65],[-416.94,442.19,6.63],[-420.46,452.8,6.59],[-423.97,463.41,6.53],[-427.08,473.64,6.46],[-430.2,483.86,6.37],[-433.31,494.08,6.27],[-436.42,504.31,6.15],[-439.54,514.53,6.02],[-442.15,522.44,5.92],[-444.76,530.35,5.81],[-445.7,538.3,5.65],[-446.3,545.86,5.48],[-444.06,555.75,5.18],[-440.48,564.17,4.88],[-435.11,572.74,4.53],[-427.25,580.3,4.14],[-421.68,583.88,3.92],[-413.84,587.62,3.64],[-406,591.37,3.37],[-398.15,595.11,3.1],[-388.79,599.42,2.79],[-379.42,603.73,2.49],[-370.05,608.04,2.19],[-361.89,614.12,1.87],[-357.47,621.13,1.58],[-355.38,627.37,1.35],[-355.03,634.92,1.09],[-355.73,639.13,0.97],[-358.41,648.48,0.69],[-362.84,652.77,0.62],[-367.27,657.06,0.54],[-376.06,661.71,0.53],[-384.85,666.37,0.53],[-393.64,671.02,0.53],[-402.43,675.68,0.54],[-411.72,680.93,0.54],[-421.01,686.18,0.56],[-430.3,691.44,0.57],[-439.6,696.69,0.59],[-448.89,701.94,0.62],[-456.26,706.77,0.62],[-463.64,711.6,0.62],[-471.02,716.43,0.62],[-478.4,721.68,0.6],[-485.78,726.93,0.59],[-493.15,732.17,0.58],[-501.71,739.95,0.5],[-510.26,747.72,0.42],[-518.82,755.49,0.35],[-527.37,763.27,0.27],[-533.43,769.21,0.19],[-539.48,775.16,0.12],[-545.53,781.11,0.04],[-551.15,788.05,-0.08],[-556.77,794.98,-0.2],[-562.39,801.92,-0.33],[-567.83,808.98,-0.46],[-573.27,816.05,-0.59],[-578.7,823.11,-0.73],[-583.64,830.44,-0.88],[-588.58,837.76,-1.03],[-593.53,845.09,-1.18],[-598.91,854.22,-1.39],[-604.29,863.35,-1.59],[-609.67,872.48,-1.79],[-615.05,881.62,-1.98],[-620.43,890.75,-2.17],[-624.71,895.11,-2.23],[-628.99,899.48,-2.29],[-638.64,902.98,-2.23],[-646.99,903.14,-2.1],[-656.2,900.33,-1.88],[-664,894.49,-1.59],[-669.38,886.62,-1.27],[-671.32,877.35,-0.95],[-671.12,868.39,-0.65],[-667.64,859.42,-0.4],[-660.52,852.22,-0.24],[-653.41,845.01,-0.1],[-645.2,836.8,0.07],[-637,828.6,0.22],[-628.79,820.4,0.38],[-620.58,812.19,0.53],[-612.38,803.99,0.67],[-604.17,795.78,0.81],[-595.96,787.58,0.95],[-587.76,779.37,1.08],[-579.55,771.17,1.21],[-571.34,762.97,1.33],[-563.14,754.76,1.45],[-554.93,746.56,1.56],[-546.72,738.35,1.67],[-538.51,730.15,1.78],[-531.75,723.37,1.87],[-524.99,716.59,1.95],[-519.86,708.64,2.12],[-515.09,697.81,2.4],[-513.4,691.46,2.59],[-511.71,685.11,2.77],[-511.36,676.58,3.07],[-511.01,668.04,3.36],[-512.35,660.44,3.66],[-513.7,652.85,3.96],[-516.33,644.95,4.29],[-518.97,637.05,4.62],[-521.6,629.16,4.95],[-522.6,623.08,5.17],[-523.59,617,5.38],[-523.59,606.95,5.7],[-523.59,596.9,6],[-521.83,588.75,6.2],[-520.06,580.61,6.38],[-516.45,569.32,6.61],[-512.84,558.04,6.81],[-509.22,546.75,7.01],[-505.61,535.46,7.18],[-502,524.17,7.34],[-498.38,512.88,7.49],[-494.77,501.6,7.62],[-491.16,490.31,7.73],[-487.54,479.02,7.82],[-483.93,467.73,7.9],[-480.32,456.45,7.95],[-476.7,445.16,7.99],[-473.09,433.87,8.01],[-469.48,422.58,8.01],[-466.34,412.74,8],[-463.2,402.9,7.97],[-460.06,393.06,7.93],[-456.92,383.22,7.87],[-453.78,373.38,7.8],[-450.63,363.54,7.71],[-447.49,353.7,7.61],[-445.01,344.71,7.51],[-442.52,335.72,7.4],[-440.03,326.74,7.28],[-441.43,317.77,7.23],[-446.9,307.33,7.26],[-450.88,302.89,7.3],[-456.1,300.01,7.39],[-466.95,295.21,7.6],[-477.8,290.4,7.8],[-488.65,285.6,8.01],[-499.5,280.8,8.21],[-510.34,276,8.41],[-521.19,271.2,8.6],[-532.04,266.39,8.79],[-542.89,261.59,8.97],[-547.87,257.31,9.02],[-552.84,253.02,9.06],[-558.21,244.53,9.02],[-561.25,234.4,8.89],[-561.59,227.38,8.75],[-561.94,220.37,8.6],[-559.8,211.17,8.33],[-554.73,200.97,7.96],[-548.79,193.33,7.63],[-542.84,185.69,7.28],[-535.46,176.76,6.86],[-528.08,167.83,6.43],[-520.7,158.9,5.98],[-513.32,149.97,5.53],[-505.94,141.04,5.07],[-498.56,132.11,4.61],[-491.17,123.18,4.13],[-483.79,114.25,3.65],[-476.41,105.32,3.17],[-469.03,96.39,2.68],[-461.72,87.49,2.2],[-454.41,78.58,1.71],[-447.1,69.67,1.21],[-439.78,60.77,0.72],[-432.47,51.86,0.23],[-425.16,42.95,-0.26],[-417.85,34.04,-0.75],[-410.54,25.14,-1.24],[-403.23,16.23,-1.72],[-395.92,7.32,-2.2],[-388.01,1.01,-2.59],[-382.96,-2.65,-2.82],[-377.91,-6.31,-3.05],[-371.1,-9.55,-3.29],[-364.28,-12.78,-3.52],[-353.76,-15.8,-3.8],[-343.23,-18.83,-4.06],[-332.71,-21.85,-4.31],[-322.18,-24.87,-4.55],[-311.66,-27.9,-4.76],[-300.6,-30.8,-4.96],[-289.54,-33.71,-5.15],[-278.48,-36.61,-5.31],[-267.42,-39.52,-5.46],[-256.36,-42.42,-5.58],[-245.29,-45.33,-5.69],[-234.23,-48.23,-5.77],[-223.17,-51.14,-5.84],[-212.11,-54.05,-5.89],[-201.05,-56.95,-5.92],[-189.99,-59.86,-5.93],[-178.93,-62.76,-5.92],[-167.87,-65.67,-5.9],[-156.81,-68.57,-5.86],[-145.75,-71.48,-5.8],[-134.69,-74.38,-5.73],[-123.63,-77.29,-5.64],[-112.56,-80.19,-5.54],[-101.5,-83.1,-5.43],[-90.44,-86.01,-5.3],[-79.38,-88.91,-5.16],[-76.5,-91.72,-5.2],[-76.15,-96.24,-5.35],[-78.24,-103.72,-5.65],[-80.18,-112.76,-6],[-78.59,-119.15,-6.17],[-68.69,-124.99,-6.14],[-58.85,-129.47,-6.06],[-49.02,-133.95,-5.97],[-39.18,-138.43,-5.88],[-29.35,-142.91,-5.78],[-21.16,-145.22,-5.65],[-12.97,-147.54,-5.51],[-4.77,-149.85,-5.38],[5.76,-152.3,-5.19],[16.29,-154.76,-5],[26.82,-157.21,-4.82],[37.35,-159.67,-4.63],[47.89,-162.12,-4.45],[58.42,-164.58,-4.27],[68.95,-167.03,-4.1],[79.48,-169.48,-3.93],[85.6,-169.48,-3.8],[91.72,-169.48,-3.67],[97.31,-166.72,-3.48],[102.91,-163.95,-3.28],[107.06,-159.39,-3.07],[111.21,-154.83,-2.85],[115.39,-146.5,-2.52],[117.03,-138.55,-2.24],[116.93,-126.78,-1.87],[113.2,-115.64,-1.57],[105.25,-107.51,-1.45],[97.29,-99.38,-1.34],[89.33,-91.24,-1.22],[81.37,-83.11,-1.11],[73.41,-74.98,-0.99],[65.46,-66.85,-0.88],[57.5,-58.72,-0.77],[49.54,-50.58,-0.66],[41.58,-42.45,-0.56],[33.62,-34.32,-0.45],[25.66,-26.19,-0.34],[17.71,-18.06,-0.23],[9.75,-9.92,-0.13],[1.79,-1.79,-0.02]],"sky":["#287eb5","#a4d5ed","#edf5eb"],"fog":13887727,"fogN":260,"fogF":1250,"hemi":[12572927,7035450,0.8],"sunC":16769720,"sunI":1.25,"ground":"#648747","road":"#343b43","tree":2646847,"grip":1,"off":0.6,"trees":true,"mount":true,"mc":8360864,"mh":120,"corners":[],"terrain":true,"tn":1},"shanghai":{"S":1,"W":14,"bw":7,"ctrl":[[0,0,0],[-10.77,2.7,0.01],[-21.54,5.4,0.02],[-32.31,8.1,0.03],[-43.08,10.81,0.04],[-53.86,13.51,0.05],[-64.63,16.21,0.06],[-76.41,17.3,0.06],[-83.5,17.3,0.06],[-90.58,17.3,0.06],[-96.91,15.27,0.05],[-103.23,13.25,0.05],[-111.88,9.58,0.03],[-117.61,5.92,0.02],[-123.33,2.26,0.01],[-131.58,-5.14,-0.02],[-137.91,-13.56,-0.05],[-142.63,-23.46,-0.08],[-146.56,-33.43,-0.12],[-146.96,-44.03,-0.15],[-146.76,-50.11,-0.17],[-146.56,-56.18,-0.19],[-144.96,-65.38,-0.22],[-142.23,-74.18,-0.25],[-137.11,-81.9,-0.28],[-129.99,-88.52,-0.3],[-122.1,-91.99,-0.31],[-114.21,-95.46,-0.32],[-106.92,-95.46,-0.32],[-99.64,-95.46,-0.32],[-93.94,-93.28,-0.31],[-88.25,-91.09,-0.31],[-83.53,-85.95,-0.29],[-80.33,-80.42,-0.27],[-80,-72.7,-0.25],[-82.33,-61.72,-0.21],[-84.69,-53.46,-0.18],[-87.06,-45.2,-0.16],[-88.25,-38.18,-0.13],[-85.46,-31.17,-0.11],[-78.8,-23.84,-0.08],[-73.08,-21.66,-0.08],[-67.36,-19.48,-0.07],[-61.07,-20.77,-0.07],[-54.78,-22.05,-0.08],[-48.05,-26.42,-0.09],[-43.73,-33.74,-0.12],[-39.8,-41.14,-0.14],[-35.87,-51.04,-0.18],[-33.48,-62.03,-0.21],[-33.08,-68.3,-0.23],[-32.68,-74.57,-0.26],[-34.68,-85.17,-0.29],[-37.84,-91.05,-0.31],[-41,-96.94,-0.33],[-45.33,-104.26,-0.35],[-51.81,-112.17,-0.37],[-58.3,-120.08,-0.4],[-65.24,-127.5,-0.42],[-72.17,-134.92,-0.44],[-79.11,-142.34,-0.46],[-86.04,-149.75,-0.48],[-92.98,-157.17,-0.5],[-99.67,-165.9,-0.52],[-106.36,-174.63,-0.54],[-113.05,-183.36,-0.56],[-119.74,-192.08,-0.57],[-127.1,-200.03,-0.59],[-134.47,-207.98,-0.6],[-141.83,-215.93,-0.62],[-148.72,-223.74,-0.63],[-155.61,-231.55,-0.64],[-162.5,-239.36,-0.65],[-169.39,-247.17,-0.66],[-173.71,-254.54,-0.67],[-178.04,-261.9,-0.68],[-182.03,-272.5,-0.68],[-185.58,-282.92,-0.69],[-189.12,-293.34,-0.7],[-192.67,-303.77,-0.7],[-196.21,-314.19,-0.7],[-199.75,-324.61,-0.7],[-203.3,-335.03,-0.7],[-206.84,-345.46,-0.69],[-210.39,-355.88,-0.68],[-213.4,-364.22,-0.68],[-216.42,-372.55,-0.67],[-219.44,-380.89,-0.66],[-222.06,-389.1,-0.65],[-224.67,-397.31,-0.64],[-227.29,-405.52,-0.63],[-227.69,-411.75,-0.62],[-224.16,-416.89,-0.61],[-217.04,-419.85,-0.6],[-210.95,-418.72,-0.61],[-204.86,-417.59,-0.61],[-198.54,-413.39,-0.62],[-192.22,-409.18,-0.62],[-186.92,-404.78,-0.63],[-181.63,-400.37,-0.64],[-176.31,-394.69,-0.64],[-170.98,-389,-0.65],[-163.5,-381.28,-0.66],[-156.01,-373.57,-0.67],[-149.52,-364.02,-0.68],[-143.03,-354.48,-0.69],[-137.31,-344.46,-0.69],[-131.58,-334.45,-0.7],[-125.86,-324.44,-0.7],[-120.14,-314.42,-0.7],[-115.02,-305.42,-0.7],[-109.91,-296.42,-0.7],[-104.79,-287.42,-0.69],[-99.68,-278.42,-0.69],[-94.57,-269.42,-0.68],[-89.45,-260.42,-0.67],[-84.53,-252.9,-0.67],[-79.6,-245.38,-0.66],[-74.68,-239.5,-0.65],[-69.75,-233.62,-0.64],[-64.23,-228.28,-0.64],[-58.7,-222.94,-0.63],[-52.21,-219.43,-0.62],[-45.72,-215.93,-0.62],[-38.8,-213.36,-0.61],[-31.88,-210.78,-0.61],[-24.79,-209.34,-0.61],[-17.7,-207.9,-0.6],[-9.45,-207.9,-0.6],[-1.2,-207.9,-0.6],[6.09,-209.34,-0.61],[13.38,-210.78,-0.61],[20.47,-213.36,-0.61],[27.55,-215.93,-0.62],[34.64,-220.37,-0.62],[41.73,-224.81,-0.63],[48.45,-230.3,-0.64],[55.18,-235.8,-0.65],[60.47,-242.03,-0.65],[65.76,-248.27,-0.66],[69.57,-256.47,-0.67],[73.39,-264.68,-0.68],[77.21,-272.89,-0.69],[81.63,-282.26,-0.69],[86.06,-291.63,-0.7],[90.48,-301,-0.7],[94.91,-310.37,-0.7],[98.67,-316.06,-0.7],[102.43,-321.75,-0.7],[110.28,-329.46,-0.7],[120.14,-335.31,-0.7],[127.42,-338.46,-0.69],[134.71,-341.62,-0.69],[141.6,-342.16,-0.69],[148.49,-342.71,-0.69],[160.34,-341.62,-0.69],[170.98,-337.57,-0.7],[180.44,-331.33,-0.7],[187.09,-325.8,-0.7],[193.01,-319.18,-0.7],[197.87,-309.75,-0.7],[202.73,-300.32,-0.7],[207.59,-290.89,-0.7],[212.45,-281.46,-0.69],[217.31,-272.03,-0.68],[222.17,-262.6,-0.68],[229.29,-254.89,-0.67],[237.94,-252.32,-0.67],[246.19,-253.8,-0.67],[253.71,-256.76,-0.67],[259.54,-264.47,-0.68],[265.38,-272.19,-0.68],[271.21,-279.9,-0.69],[277.04,-287.62,-0.69],[282.87,-295.33,-0.7],[286.79,-303.05,-0.7],[286.79,-309.98,-0.7],[284.4,-316.99,-0.7],[278.46,-327.09,-0.7],[272.52,-337.19,-0.7],[266.58,-347.29,-0.69],[260.64,-357.39,-0.68],[254.7,-367.48,-0.68],[248.76,-377.58,-0.67],[242.82,-387.68,-0.65],[236.88,-397.78,-0.64],[230.94,-407.87,-0.62],[225,-417.97,-0.61],[219.06,-428.07,-0.59],[213.11,-438.17,-0.57],[207.55,-447.17,-0.55],[201.98,-456.17,-0.53],[196.42,-465.17,-0.51],[190.85,-474.17,-0.49],[185.29,-483.17,-0.46],[179.72,-492.17,-0.44],[174.15,-501.17,-0.42],[168.59,-510.17,-0.39],[162.48,-520.27,-0.36],[156.38,-530.37,-0.33],[150.27,-540.47,-0.3],[144.16,-550.57,-0.27],[138.06,-560.67,-0.23],[131.95,-570.77,-0.2],[125.84,-580.87,-0.16],[119.74,-590.98,-0.13],[113.08,-593.16,-0.12],[106.36,-591.37,-0.13],[100.03,-585.83,-0.15],[92.58,-577.42,-0.18],[85.46,-568.61,-0.21],[78.8,-564.17,-0.22],[70.48,-561.6,-0.23],[61.83,-563.08,-0.22],[53.18,-570.79,-0.2],[48.05,-576.48,-0.18],[42.93,-582.17,-0.16],[37.8,-591.37,-0.13],[34.68,-599.78,-0.1],[33.88,-606.05,-0.08],[33.08,-612.33,-0.06],[33.88,-623.7,-0.02],[35.87,-634.69,0.02],[39.4,-644.98,0.06],[44.13,-651.21,0.08],[48.85,-657.44,0.1],[57.9,-664.46,0.13],[64.19,-667.22,0.14],[70.48,-669.99,0.14],[77.21,-671.43,0.15],[83.93,-672.87,0.15],[94.58,-673.96,0.16],[101.07,-673.61,0.16],[107.56,-673.26,0.16],[116.01,-671.24,0.15],[124.46,-669.21,0.14],[129.99,-666.83,0.13],[135.51,-664.46,0.13],[141.23,-661.34,0.12],[146.96,-658.22,0.1],[154.81,-650.86,0.08],[162.66,-643.5,0.05],[169.59,-633.76,0.02],[176.51,-624.02,-0.02],[183.02,-614.05,-0.05],[189.52,-604.09,-0.08],[196.03,-594.12,-0.12],[202.54,-584.16,-0.15],[209.05,-574.19,-0.19],[215.56,-564.23,-0.22],[222.07,-554.27,-0.25],[228.57,-544.3,-0.29],[235.08,-534.34,-0.32],[241.59,-524.37,-0.35],[248.1,-514.41,-0.38],[254.61,-504.45,-0.41],[261.11,-494.48,-0.43],[267.62,-484.52,-0.46],[274.13,-474.55,-0.49],[280.64,-464.59,-0.51],[287.15,-454.63,-0.53],[293.65,-444.66,-0.56],[300.16,-434.7,-0.58],[306.67,-424.73,-0.6],[313.18,-414.77,-0.61],[319.69,-404.81,-0.63],[326.19,-394.84,-0.64],[332.42,-385.44,-0.66],[338.65,-376.04,-0.67],[344.87,-366.63,-0.68],[351.1,-357.23,-0.68],[357.32,-347.83,-0.69],[363.55,-338.42,-0.69],[369.77,-329.02,-0.7],[376,-319.62,-0.7],[382.22,-310.22,-0.7],[388.45,-300.81,-0.7],[394.67,-291.41,-0.7],[400.9,-282.01,-0.69],[407.12,-272.6,-0.68],[413.35,-263.2,-0.68],[419.57,-253.8,-0.67],[425.63,-244.61,-0.66],[431.69,-235.43,-0.65],[437.74,-226.24,-0.63],[443.8,-217.06,-0.62],[449.86,-207.87,-0.6],[455.91,-198.69,-0.59],[461.97,-189.5,-0.57],[468.03,-180.32,-0.55],[474.1,-170.82,-0.53],[480.18,-161.32,-0.51],[486.25,-151.83,-0.48],[492.33,-142.33,-0.46],[498.41,-132.84,-0.43],[504.48,-123.34,-0.4],[510.56,-113.85,-0.38],[516.81,-104.5,-0.35],[523.07,-95.16,-0.32],[529.33,-85.82,-0.29],[535.58,-76.48,-0.26],[541.84,-67.14,-0.23],[548.1,-57.79,-0.2],[554.35,-48.45,-0.17],[560.61,-39.11,-0.14],[566.86,-29.77,-0.1],[573.56,-19.97,-0.07],[580.26,-10.16,-0.04],[586.96,-0.36,0],[593.66,9.44,0.03],[600.36,19.24,0.07],[607.06,29.04,0.1],[613.76,38.84,0.14],[620.46,48.64,0.17],[627.16,58.44,0.2],[630.69,66.16,0.23],[630.29,73.48,0.25],[625.17,78.63,0.27],[616.92,77.92,0.27],[608.43,73.87,0.25],[599.94,69.82,0.24],[595.02,66.31,0.23],[590.09,62.81,0.22],[584.6,58.79,0.2],[579.11,54.78,0.19],[572.32,45.51,0.16],[565.53,36.23,0.13],[558.74,26.96,0.09],[551.96,17.69,0.06],[545.17,8.42,0.03],[538.38,-0.86,0],[531.59,-10.13,-0.04],[524.8,-19.4,-0.07],[518.01,-28.68,-0.1],[511.22,-37.95,-0.13],[504.43,-47.22,-0.16],[497.65,-56.49,-0.2],[490.86,-65.77,-0.23],[484.07,-75.04,-0.26],[477.28,-84.31,-0.29],[470.49,-93.59,-0.32],[463.7,-102.86,-0.34],[458.58,-105.74,-0.35],[449.13,-106.52,-0.36],[438,-103.89,-0.35],[426.87,-101.26,-0.34],[415.75,-98.63,-0.33],[404.62,-96,-0.32],[393.5,-93.36,-0.32],[382.37,-90.73,-0.31],[371.25,-88.1,-0.3],[360.12,-85.47,-0.29],[349,-82.84,-0.28],[337.87,-80.21,-0.27],[326.75,-77.58,-0.26],[315.62,-74.94,-0.26],[304.5,-72.31,-0.25],[293.22,-69.64,-0.24],[281.94,-66.96,-0.23],[270.66,-64.28,-0.22],[259.39,-61.6,-0.21],[248.11,-58.92,-0.2],[236.83,-56.24,-0.19],[225.55,-53.57,-0.19],[214.28,-50.89,-0.18],[203,-48.21,-0.17],[191.72,-45.53,-0.16],[180.44,-42.85,-0.15],[169.17,-40.17,-0.14],[157.89,-37.5,-0.13],[146.61,-34.82,-0.12],[135.33,-32.14,-0.11],[124.05,-29.46,-0.1],[112.78,-26.78,-0.09],[101.5,-24.1,-0.08],[90.22,-21.43,-0.07],[78.94,-18.75,-0.07],[67.67,-16.07,-0.06],[56.39,-13.39,-0.05],[45.11,-10.71,-0.04],[33.83,-8.03,-0.03],[22.56,-5.36,-0.02],[11.28,-2.68,-0.01]],"sky":["#287eb5","#a4d5ed","#edf5eb"],"fog":13887727,"fogN":260,"fogF":1250,"hemi":[12572927,7035450,0.8],"sunC":16769720,"sunI":1.25,"ground":"#648747","road":"#343b43","tree":2646847,"grip":1,"off":0.6,"trees":true,"mount":true,"mc":8360864,"mh":120,"corners":[],"terrain":true,"tn":1}};
KartTracks.install(MAPS);
let NET=null,cur=null,lview='lhome',lpending=null;
let hostNetwork='local',joinNetwork='local';
const validJoinCode=()=>joinNetwork==='web'?/^[A-Z0-9]{8}$/.test($('jcode').value):/^\d{6}$/.test($('jcode').value);
function setNetwork(kind,mode){
 if(lpending)return;
 if(kind==='host')hostNetwork=mode;else joinNetwork=mode;
 document.querySelectorAll('#'+kind+'Network button').forEach(b=>{const selected=b.dataset.network===mode;b.classList.toggle('on',selected);b.setAttribute('aria-pressed',selected)});
 if(kind==='join'){$('jcode').value='';$('jcode').inputMode=mode==='web'?'text':'numeric';$('jcode').maxLength=mode==='web'?8:6;$('jcode').placeholder=mode==='web'?'A1B2C3D4':'000000';$('jhint').textContent=mode==='web'?'Der Web-Spielcode besteht aus acht Buchstaben und Zahlen.':'Gib den sechsstelligen Code des Hosts ein.';$('jn').disabled=true;}
 lstat('');
}
for(const kind of ['host','join'])document.querySelectorAll('#'+kind+'Network button').forEach(b=>b.onclick=()=>setNetwork(kind,b.dataset.network));
const MAPNAMES={circuit:'Rennstrecke',snow:'Schneeberge',indoor:'Indoor-Kartbahn',spa:'Spa-Francorchamps',monaco:'Monaco',monza:'Monza',nurburgring:'Nürburgring GP',shanghai:'Shanghai',switchback:'Switchback Park',hairpin:'Hairpin Heights'};
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let myName='';try{myName=KartStorage.getItem('kart-name')||''}catch(e){}
const lstat=t=>{$('lstat').textContent=t;$('lstat').hidden=!t};
for(const [key,label] of Object.entries(MAPNAMES)){
  const option=document.createElement('option');option.value=key;option.textContent=label;$('smap').appendChild(option);
}
function showLobbyView(view,focus){
  lview=view;if(view==='lsetup')$('scategory').value=SAVE.category;if(view==='lentry')$('jcategory').value=SAVE.category;
  $('lobby').querySelector('.sheet-head').style.setProperty('--hc',view==='lentry'?'var(--blue)':'var(--purple)');
  for(const id of ['lhome','lsetup','lentry'])$(id).hidden=id!==view;
  $('lobbyTitle').textContent={lhome:'Mehrspieler',lsetup:'Spiel erstellen',lentry:'Mit Code beitreten'}[view];
  lstat('');
  if(focus)$(focus).focus();
}
function openLobby(join=false){
  $('lobby').classList.add('on');
  showLobbyView(join?'lentry':'lhome',join?'jcode':'lcreate');
}
$('lback').onclick=()=>{
  lpending=null;
  $('mk').disabled=false;
  $('jn').disabled=!validJoinCode();
  if(lview!=='lhome'){showLobbyView('lhome','lcreate');return}
  $('lobby').classList.remove('on');$('mpBtn').focus();
};
$('lcreate').onclick=()=>showLobbyView('lsetup','smap');
$('ljoin').onclick=()=>showLobbyView('lentry','jcode');
$('jcode').oninput=()=>{
  const input=$('jcode');
  input.value=joinNetwork==='web'?input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8):input.value.replace(/\D/g,'').slice(0,6);
  $('jn').disabled=!!lpending||!validJoinCode();
};
async function enterOnline(action,status,button){
  if(lpending||cur)return;
  const request={};
  lpending=request;
  $(button).disabled=true;
  lstat(status);
  try{
    const session=await action(message=>{
      if(!cur||cur!==request.session)return;
      clearInterval(cur.countTimer);
      cur.un();cur=null;
      if(NET)leaveOnlineRace();
      else hidePaddock();
      openLobby();
      lstat(message);
    });
    if(lpending!==request){session.room.leave();return}
    cur=request.session=session;
    showPaddock();
    cur.un=cur.room.onPeers(renderRoom);
    renderRoom();
  }catch(error){
    if(lpending===request)lstat(error.type?'Der Onlinedienst ist nicht erreichbar. Versuche es erneut.':error.message);
  }finally{
    if(lpending===request){
      lpending=null;
      $('mk').disabled=false;
      $('jn').disabled=!validJoinCode();
    }
  }
}
$('lsetup').onsubmit=e=>{
  e.preventDefault();
  const mixedClasses=$('scategory').value==='mixed',category=mixedClasses?SAVE.category:$('scategory').value;if(!mixedClasses){SAVE.category=category;persist()}
  const settings={mixedClasses,driverClass:SAVE.category,upgradesAllowed:$('sUpgrades').checked,tuning:KartTuning.network(),bots:KartBots.normalize({count:SAVE.mpBotCount,items:SAVE.mpBotItems,cars:SAVE.mpBotCars,difficulties:SAVE.mpBotDifficulties}),category,car:SAVE.car,nm:myName||'Racer',pc:paintColor(),skin:KartSeason.skin(SAVE.kartSkin),kartModel:SAVE.kartModel,ws:WSTYLE,map:$('smap').value,laps:+$('slaps').value,comp:$('smode').value==='c',seed:Math.floor(Math.random()*1e9)};
  enterOnline(lost=>KartRooms.host(settings,lost,hostNetwork),'Spiel wird erstellt…','mk');
};
$('lentry').onsubmit=e=>{
  e.preventDefault();
  const code=$('jcode').value;
  if(!validJoinCode()){lstat(joinNetwork==='web'?'Der Web-Spielcode besteht aus acht Buchstaben und Zahlen.':'Der Spielcode besteht aus sechs Ziffern.');return}
  SAVE.category=$('jcategory').value;persist();
  enterOnline(lost=>KartRooms.join(code,{category:SAVE.category,tuning:KartTuning.network(),name:myName,pc:paintColor(),skin:KartSeason.skin(SAVE.kartSkin),kartModel:SAVE.kartModel,ws:WSTYLE,car:SAVE.car},lost,joinNetwork),'Verbindung wird aufgebaut…','jn');
};
// The seven slots follow the photographed road, including its background crop.
const podiumPositions=[[0,4],[-5.4,1],[5.4,1],[-4.3,-4],[4.3,-4],[-3.2,-8],[3.2,-8]];
let podiumStage=null;

// Lobby scenery comes solely from the current background image.
function makeLobbyGarage(){return new THREE.Group()}

function openPodiumStage(){
  if(podiumStage)return;
  if(!SR.r)return;
  const arena=$('parking'),canvas=$('showroom');
  const camera=new THREE.PerspectiveCamera(38,1,.1,400);
  camera.position.set(0,33,34);camera.lookAt(0,.5,-13);
  const previous={background:SR.scene.background,fog:SR.scene.fog,objects:SR.scene.children.map(object=>[object,object.visible])};
  for(const [object] of previous.objects)if(object!==SR.kart)object.visible=false;
  SR.scene.background=new THREE.Color(0x243342);SR.scene.fog=new THREE.Fog(0x243342,70,150);
  const pods=makeLobbyGarage();
  SR.scene.add(pods);SR.r._qualityKey=null;
  const observer=new ResizeObserver(sizePodiumStage);
  podiumStage={camera,pods,observer,karts:new Map(),previous};
  arena.prepend(canvas);arena.classList.add('live');
  observer.observe(arena);
  sizePodiumStage();
}
function sizePodiumStage(){
  if(!podiumStage)return;
  const arena=$('parking'),w=arena.clientWidth,h=arena.clientHeight;
  if(!w||!h)return;
  const camera=podiumStage.camera;
  camera.aspect=w/h;
  camera.fov=52;camera.clearViewOffset();
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const imageAspect=1659/948,rx=Math.min(1,camera.aspect/imageAspect),ry=Math.min(1,imageAspect/camera.aspect);
  const anchors=[[.48,.86],[.455,.73],[.55,.69],[.445,.605],[.525,.565],[.41,.49],[.48,.445]],ray=new THREE.Raycaster(),floor=new THREE.Plane(new THREE.Vector3(0,1,0),-.5);
  anchors.forEach(([u,v],i)=>{if(ry<.85)v=.5+(v-.5)*ry/.95;const x=(u-.5)/rx+.5,y=(v-.5)/ry+.5;ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);const hit=ray.ray.intersectPlane(floor,new THREE.Vector3());if(hit)podiumPositions[i]=[hit.x,hit.z]});
  if(cur){cur.parkingRoster=null;renderParking(cur.room.peers())}
  SR.r.setSize(w,h,false);
  positionPodiumLabels();
}
function positionPodiumLabels(){
  if(!podiumStage)return;
  const camera=podiumStage.camera;
  [...$('rplayers').children].forEach((row,i)=>{
    const [x,z]=podiumPositions[i];
    const point=new THREE.Vector3(x,.48,z+(i===0?3.25:2.4)).project(camera);
    row.style.left=((1+point.x)*50)+'%';
    row.style.top=((1-point.y)*50)+'%';
  });
}
function removePodiumKart(kart){
  SR.scene.remove(kart);
  const materials=new Set();
  kart.traverse(part=>{
    if(!part.isMesh)return;
    part.geometry.dispose();
    for(const material of [].concat(part.material))materials.add(material);
  });
  const shared=[wRub,wChr,wAcc,wWood,wMark],textures=[radT,tireSide,tireCap];
  for(const material of materials){
    if(shared.includes(material))continue;
    if(material.map&&!material.map.userData?.sharedSurface&&!textures.includes(material.map))material.map.dispose();
    material.dispose();
  }
}
function updatePodiumKarts(others){
  if(!podiumStage)return;
  const karts=podiumStage.karts,present=new Set(others.map(p=>p.peer));
  for(const [id,kart] of karts){
    if(present.has(id))continue;
    removePodiumKart(kart);karts.delete(id);
  }
  others.forEach((p,i)=>{
    let kart=karts.get(p.peer);if(kart&&kart.userData.lobbyClass!==p.presence.driverClass){removePodiumKart(kart);karts.delete(p.peer);kart=null}
    if(!kart){
      kart=makeKart(p.presence.pc??0x4f7d96,p.presence.ws??0,SR.scene,p.presence.driverClass||hostPlayer(cur.room.peers())?.presence.category,p.presence.car,p.presence.skin,p.presence.kartModel);
      const hp=hostPlayer(cur.room.peers())?.presence;if(hp?.upgradesAllowed&&!p.peer.startsWith('bot:')){const id=KartTuning.id(p.presence.driverClass||hp.category,p.presence.car,p.presence.kartModel||'original');KartTuningVisuals.attach(kart,id,KartTuningStats.clean(p.presence.tuning,KartTuning.all().map(c=>c.id))[id]||{})}kart.userData.lobbyClass=p.presence.driverClass;kart.rotation.y=Math.PI+.18;karts.set(p.peer,kart);
    }
    const [x,z]=podiumPositions[i+1];
    kart.position.set(x,.5,z);kart.scale.setScalar(1.7);
  });
}
function closePodiumStage(){
  if(!podiumStage)return;
  podiumStage.observer.disconnect();
  for(const kart of podiumStage.karts.values())removePodiumKart(kart);
  SR.scene.remove(podiumStage.pods);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  podiumStage.pods.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)for(const material of [].concat(object.material))materials.add(material);
    if(object.isLight&&object.shadow)object.shadow.dispose();
  });
  for(const material of materials){for(const key of ['map','bumpMap','roughnessMap','normalMap'])if(material[key]&&!material[key].userData?.sharedSurface)textures.add(material[key]);material.dispose()}
  for(const geometry of geometries)geometry.dispose();
  for(const texture of textures)texture.dispose();
  for(const [object,visible] of podiumStage.previous.objects)object.visible=visible;
  SR.scene.background=podiumStage.previous.background;SR.scene.fog=podiumStage.previous.fog;
  $('parking').classList.remove('live');
  document.body.prepend($('showroom'));
  podiumStage=null;
  showroomSize();
}
function showPaddock(){
  $('lobby').classList.remove('on');
  $('menu').inert=true;
  $('paddock').hidden=false;
  $('rcode').textContent=cur.code;
  $('rnotice').hidden=true;
  cur.parkingRoster=null;
  openPodiumStage();
  $('paddockTitle').focus();
}
function hidePaddock(){
  $('rconfirm').close();
  $('rexit').close();
  $('rcount').hidden=true;
  $('paddock').hidden=true;
  $('menu').inert=false;
  closePodiumStage();if(!cur&&SR.scene)showroomKart();
}
$('rleave').onclick=()=>{
  if(!cur||$('rexit').open)return;
  $('rexitInfo').textContent=cur.host
    ? 'Wenn du die Lobby verlässt, wird sie geschlossen. Alle anderen Spieler werden ebenfalls aus der Lobby geworfen.'
    : 'Möchtest du die aktuelle Lobby verlassen?';
  $('rexit').showModal();
};
$('rexitCancel').onclick=()=>$('rexit').close();
$('rexitGo').onclick=()=>{
  if(!$('rexit').open||!cur)return;
  const session=cur;
  cur=null;
  clearInterval(session.countTimer);
  session.un();session.room.leave();
  hidePaddock();$('mpBtn').focus();
};
function paddockNotice(message){
  $('rnotice').textContent=message;
  $('rnotice').hidden=false;
}
$('lcopy').onclick=async()=>{
  const session=cur;
  if(!session)return;
  if(!await KartClipboard.copy(session.code)){
    if(cur!==session)return;
    const range=document.createRange(),selection=window.getSelection();
    range.selectNodeContents($('rcode'));selection.removeAllRanges();selection.addRange(range);
  }
};
function renderParking(players){
  const hp=hostPlayer(players)?.presence,bots=KartBots.normalize(hp?.bots,players.length);players=[...players,...Array.from({length:bots.count},(_,i)=>({peer:"bot:"+i,isMe:false,presence:{nm:"Bot "+(i+1),car:bots.cars[i],pc:[0xe8661c,0x12a8ff,0x8c42f5,0x6fbf3a,0xe5b30e,0xc8302a][i],ws:i%3}}))];
  const roster=JSON.stringify(players.map(p=>[p.peer,p.presence.nm,p.presence.pc,p.presence.ws,p.presence.driverClass,p.presence.car,p.presence.skin,p.presence.kartModel,hostPlayer(players)?.presence.category]));
  if(cur.parkingRoster===roster)return;
  cur.parkingRoster=roster;
  const others=players.filter(p=>!p.isMe).slice(0,podiumPositions.length-1);
  const first=players.find(p=>p.isMe)||players[0],slots=[first,...players.filter(p=>p!==first).slice(0,6)];
  const rows=podiumPositions.map(([x,z],i)=>{
    const player=slots[i],row=document.createElement('li'),name=document.createElement('span');
    row.className='parking-slot'+(player?' occupied':'')+(player?.isMe?' self':'');
    row.style.setProperty('--x',(50+x*2.6)+'%');
    row.style.setProperty('--y',(65+z*1.6)+'%');
    name.className='parking-name';
    const role=player?.isMe?(cur.host?' · Du (Host)':' · Du'):player?.presence.host===1?' · Host':'';
    name.textContent=player?player.presence.nm+role:'Frei';
    if(player){
      const icon=document.createElement('span');icon.className='parking-fallback';
      icon.setAttribute('aria-hidden','true');icon.innerHTML=ic('helmet');row.append(icon);
    }
    row.append(name);
    return row;
  });
  $('rplayers').replaceChildren(...rows);
  updatePodiumKarts(others);
  positionPodiumLabels();
}
const hostPlayer=players=>players.find(p=>p.presence.host===1);
const modeLabel=hp=>(hp.category==='gt3'?'GT3 · ':'')+(hp.comp?'Kompetitiv':'Luckyblock');
const lapLabel=hp=>hp.laps+(hp.laps===1?' Runde':' Runden');
function canStart(players){
  return cur?.host&&KartLobbyClasses.allReady(hostPlayer(players)?.presence||{},players)&&!hostPlayer(players)?.presence.go&&!(hostPlayer(players)?.presence.vote&&!hostPlayer(players).presence.vote.done)&&players.length+KartBots.normalize(hostPlayer(players)?.presence.bots,players.length).count>=2;
}
function renderRoom(){
  if(!cur||cur.started)return;
  const players=cur.room.peers().sort((a,b)=>a.peer<b.peer?-1:a.peer>b.peer?1:0);
  const hp=hostPlayer(players)?.presence;
  if(!hp)return;
  const category=hp.category==='gt3'?'gt3':'kart',tuningStyle=category+':'+!!(hp.upgradesAllowed);if(cur.tuningStyle!==tuningStyle){cur.tuningStyle=tuningStyle;showroomKart();if(podiumStage){for(const k of podiumStage.karts.values())removePodiumKart(k);podiumStage.karts.clear()}cur.parkingRoster=null}renderParking(players);
  $('rmap').textContent=MAPNAMES[hp.map];
  $('rmode').textContent=modeLabel(hp);
  $('rlaps').textContent=lapLabel(hp);
  $('rhost').hidden=!cur.host;KartTuning.room(hp);KartLobbyClasses.render(cur);
  $('paddock').classList.toggle('guest-lobby',!cur.host);
  window.refreshInviteControls?.();window.refreshRoomBots?.();KartMapVote.refresh?.();
  $('rlucky').disabled=$('rcomp').disabled=hp.go>0;
  $('rstart').disabled=!canStart(players);
  $('rlucky').setAttribute('aria-pressed',String(!hp.comp));
  $('rcomp').setAttribute('aria-pressed',String(!!hp.comp));
  if($('rconfirm').open){
    $('rgo').disabled=!canStart(players);
    $('rconfirmInfo').textContent=canStart(players)
      ? MAPNAMES[hp.map]+' · '+modeLabel(hp)+' · '+lapLabel(hp)+' · '+players.length+' Fahrer. Der Countdown startet für alle.'
      : 'Mindestens zwei Fahrer müssen in der Lobby sein.';
  }
  if(hp.go>0){
    if(cur.lastRound===hp.go){
      const status='Rennen läuft noch · '+hp.remaining+' auf der Strecke';
      if($('rstatus').textContent!==status)$('rstatus').textContent=status;
    }
    else beginOnline(hp,players.find(p=>p.isMe));
    return;
  }
  $('rstatus').textContent=cur.host
    ? (players.length<2?'Teile den Code. Zum Start braucht ihr mindestens zwei Fahrer.':'Bereit. Du kannst den Modus ändern oder das Rennen starten.')
    : 'Warte auf den Rennstart durch den Host.';
}
function changeRoomMode(comp){
  if(!cur?.host||hostPlayer(cur.room.peers())?.presence.go)return;
  cur.room.presence({comp}).catch(()=>{});
}
$('rlucky').onclick=()=>changeRoomMode(false);
$('rcomp').onclick=()=>changeRoomMode(true);
$('rstart').onclick=()=>{
  if(!cur||!canStart(cur.room.peers()))return;
  $('rconfirm').showModal();
  renderRoom();
};
$('rcancel').onclick=()=>$('rconfirm').close();
$('rgo').onclick=()=>{
  if(!$('rconfirm').open||!cur)return;
  const players=cur.room.peers();
  if(!canStart(players))return;
  $('rconfirm').close();
  cur.room.presence({go:Math.max(cur.now(),(cur.lastRound||0)+1),order:players.map(p=>p.peer).sort()}).catch(()=>{});
};
function beginOnline(hp,player){
  cur.started=true;cur.lastRound=hp.go;
  const slot=cur.spectator?0:hp.order.indexOf(player.peer);
  NET={mixedClasses:hp.mixedClasses===true,driverClass:player?.presence.driverClass||hp.category,upgradesAllowed:hp.upgradesAllowed===true,spectator:!!cur.spectator,bots:KartBots.normalize(hp.bots,hp.order.length),bhit:null,bhitN:0,room:cur.room,code:cur.code,host:cur.host,seed:hp.seed|0,round:hp.go,startAt:cur.spectator?(hp.raceStartAt||0):0,now:cur.now,laps:hp.laps,map:hp.map,name:myName||'Racer',slot,order:hp.order,spinCnt:0,tk:[],oil:[],oilN:0,hit:null,hitN:0,comp:!!hp.comp,category:hp.category==='gt3'?'gt3':'kart',me:cur.spectator?cur.invitePeer:player.peer};
  const race=NET;race.unStart=race.room.onPeers(()=>{if(NET!==race)return;const host=hostPlayer(race.room.peers())?.presence;if(!host||host.go!==race.round){leaveOnlineRace();return}if(Number.isFinite(host.raceStartAt)&&host.raceStartAt>0)race.startAt=host.raceStartAt});
  hidePaddock();boot(NET.map);
}
let stopRace=null;window.kartActiveTrack=null;window.kartHeartbeat?.();
function leaveSingleRace(){
 stopRace?.();document.body.classList.add('lobby');$('menu').style.display='';$('showroom').style.display='';
 $('tomenu').hidden=true;$('tomenu').querySelector('b').textContent='Zum Menü';$('closeLbl').textContent='Schließen';$('close').onclick=closeSettingsLobby;$('wstyle').onclick=cycleLobbyWheel;
 if(!SR.r)showroomStart();renderLobby();clearInterval(lobbyIv);lobbyIv=setInterval(tickLobby,1000);
}
function leaveOnlineRace(){
  const race=NET;
  if(!race)return;
  stopRace?.();race.unStart?.();
  NET=null;
  document.body.classList.add('lobby');
  $('menu').style.display='';
  $('showroom').style.display='';
  $('tomenu').hidden=true;$('tomenu').querySelector('b').textContent='Zum Menü';
  $('closeLbl').textContent='Schließen';$('close').onclick=closeSettingsLobby;$('wstyle').onclick=cycleLobbyWheel;
  renderLobby();
  clearInterval(lobbyIv);lobbyIv=setInterval(tickLobby,1000);
  if(!cur)return;
  cur.started=false;
  race.room.back(race.round);
  showPaddock();renderRoom();
}
// ===== Gemeinsame Bausteine (Lobby + Rennen): Texturen, Kart-Modell, Tastenbelegung =====
function cvs(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t}
const noise=(g,w,h,n,a)=>{for(let i=0;i<n;i++){const v=Math.random()*255|0;g.fillStyle=`rgba(${v},${v},${v},${a})`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}};
// Kart im Stil: verwitterter Lack, Schlicks, Motor mit Kühler (eigenes Emblem)
const radT=cvs(64,64,(g,w,h)=>{g.fillStyle='#55585e';g.fillRect(0,0,w,h);g.fillStyle='#1d1e21';for(let y=3;y<h;y+=6)g.fillRect(4,y,w-8,2)});
const tireSide=cvs(128,32,(g,w,h)=>{g.fillStyle='#1b1b1d';g.fillRect(0,0,w,h);g.fillStyle='#303034';for(let i=0;i<8;i++)g.fillRect(i*16,0,5,h);noise(g,w,h,600,.2)});
const tireCap=cvs(128,128,(g,w,h)=>{g.fillStyle='#1b1b1d';g.fillRect(0,0,w,h);g.fillStyle='#3d4046';g.beginPath();g.arc(64,64,38,0,6.3);g.fill();g.fillStyle='#202226';g.beginPath();g.arc(64,64,24,0,6.3);g.fill();g.fillStyle='#5a5e66';for(let i=0;i<5;i++){g.beginPath();g.arc(64+Math.cos(i*1.2566)*14,64+Math.sin(i*1.2566)*14,3.5,0,6.3);g.fill()}g.fillStyle='#8f949c';g.beginPath();g.arc(64,64,6,0,6.3);g.fill()});
function paintTex(base,cream){return cvs(256,256,(g,w,h)=>{
  g.fillStyle=base;g.fillRect(0,0,w,h);
  g.save();g.translate(128,128);g.rotate(-.65);g.fillStyle=cream;for(let i=-5;i<=5;i++)g.fillRect(i*74-14,-300,28,600);g.restore();
  g.strokeStyle='#2b3a44';g.lineWidth=7;g.beginPath();g.moveTo(128,76);g.lineTo(170,128);g.lineTo(128,180);g.lineTo(86,128);g.closePath();g.stroke();g.beginPath();g.arc(128,128,15,0,6.3);g.stroke();
  for(let i=0;i<26;i++){const x=Math.random()*w,y=Math.random()*h,r=6+Math.random()*26,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(70,52,30,.35)');gr.addColorStop(1,'rgba(70,52,30,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r)}
  g.strokeStyle='rgba(235,225,200,.5)';g.lineWidth=1;for(let i=0;i<40;i++){const x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.random()*24-12,y+Math.random()*24-12);g.stroke()}
  noise(g,w,h,5000,.12)})}
// Lenkräder: 0 rund, 1 Rennlenkrad, 2 klassisch (drehen mit der Lenkung)
const WSTYLES=['Rund','Rennlenkrad','Klassisch'];let WSTYLE=0;try{WSTYLE=(+KartStorage.getItem('kart-wheel'))%3||0}catch(e){}
const wRub=new THREE.MeshStandardMaterial({color:0x1b1b1d,roughness:.85}),wChr=new THREE.MeshStandardMaterial({color:0x9a9fa6,roughness:.35,metalness:.9}),wAcc=new THREE.MeshStandardMaterial({color:0xf0a52b,roughness:.5}),wWood=new THREE.MeshStandardMaterial({color:0x7a4a26,roughness:.6}),wMark=new THREE.MeshBasicMaterial({color:0xffffff});
function makeWheel(style){const g=new THREE.Group();
 const bxm=(w,h,d,m,x,y,z,rz)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(rz)o.rotation.z=rz;o.castShadow=true;g.add(o);return o};
 const tor=(R,r,m)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(R,r,10,28),m);o.castShadow=true;g.add(o);return o};
 const hub=(r,d,m)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d,16),m);o.rotation.x=Math.PI/2;g.add(o)};
 if(style===1){bxm(.34,.045,.05,wRub,0,.14,0);bxm(.34,.045,.05,wRub,0,-.14,0);bxm(.055,.3,.06,wAcc,-.19,0,0);bxm(.055,.3,.06,wAcc,.19,0,0);bxm(.2,.12,.045,wChr,0,0,0);bxm(.03,.1,.02,wMark,0,.14,.03)}
 else if(style===2){tor(.25,.02,wWood);for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.PI/2;bxm(.012,.25,.02,wChr,Math.cos(a)*.125,Math.sin(a)*.125,0,a-Math.PI/2)}hub(.05,.04,wChr);bxm(.03,.05,.02,wMark,0,.25,0)}
 else{tor(.2,.03,wRub);for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.PI/2;bxm(.03,.2,.025,wChr,Math.cos(a)*.1,Math.sin(a)*.1,0,a-Math.PI/2)}hub(.06,.05,wChr);bxm(.04,.06,.035,wAcc,0,.2,0)}
 return g}
function makeKart(color,wstyle,scene,category='kart',car='porsche',livery='original',model='original'){
  if(category==='gt3')return KartGT3.make(color,wstyle,scene,car);
  return KartModels.make(color,wstyle,scene,model,livery);
}
function legacyKart(color,wstyle,scene,livery='original'){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const pt=paintTex('#'+new THREE.Color(color).getHexString(),'#cdbd92');
  const paint=new THREE.MeshStandardMaterial({map:pt,roughness:.6,metalness:.1}),dark=new THREE.MeshStandardMaterial({color:0x2a2b2e,roughness:.7,metalness:.4}),
   chrome=new THREE.MeshStandardMaterial({color:0x9a9fa6,roughness:.35,metalness:.9}),rubber=new THREE.MeshStandardMaterial({color:0x1e1e20,roughness:.9}),
   fabric=new THREE.MeshStandardMaterial({color:0x2d3340,roughness:.9}),helmetM=new THREE.MeshStandardMaterial({color:0xe9e6dc,roughness:.35}),
   radM=new THREE.MeshStandardMaterial({map:radT,roughness:.6,metalness:.5}),tlm=new THREE.MeshStandardMaterial({color:0x3a0000,roughness:.4});
  paint.userData.livery=livery;detailMaterial(paint);restyleKartPaint(paint,color);pbr(chrome,"Metal012",[1,1],{normal:.18,roughness:.28});pbr(dark,"Metal012",[2,2],{tint:0x333b43,normal:.25});
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;body.add(m);return m};
  const slab=(pts,d,y)=>{const ge=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1]))),{depth:d,bevelEnabled:true,bevelThickness:.04,bevelSize:.045,bevelSegments:2});ge.rotateX(Math.PI/2);return add(ge,paint,0,y,0)};
  const bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  add(bx(1.15,.1,2.1),dark,0,.3,-.05);
  slab([[-.95,1],[.95,1],[.82,1.38],[.45,1.52],[-.45,1.52],[-.82,1.38]],.2,.55);
  slab([[-.36,.3],[.36,.3],[.26,.95],[.14,1.22],[-.14,1.22],[-.26,.95]],.16,.82).rotation.x=.14;
  for(const s of[-1,1])slab([[s*.58,-.6],[s*1.02,-.6],[s*1.02,.45],[s*.82,.8],[s*.58,.8]],.26,.64);
  slab([[-.85,-1.3],[.85,-1.3],[.85,-1.06],[-.85,-1.06]],.2,.52);
  add(bx(.7,.1,.6),dark,0,.42,-.3);add(bx(.7,.62,.12),dark,0,.76,-.62,-.25,0,0);
  for(const s of[-1,1])add(bx(.08,.36,.55),dark,s*.36,.62,-.35);
  add(bx(.4,.4,.45),dark,-.3,.62,-.95);add(new THREE.CylinderGeometry(.13,.13,.3,10),dark,.3,.6,-.95,0,0,Math.PI/2);
  add(bx(.08,.55,.7),radM,.62,.78,-.62);
  add(new THREE.CylinderGeometry(.03,.03,.6,8),chrome,0,.83,.31,-.7,0,0);
  const wheelMount=new THREE.Group();wheelMount.position.set(0,1.06,.12);wheelMount.rotation.x=.7;body.add(wheelMount);const steerG=new THREE.Group();wheelMount.add(steerG);steerG.add(makeWheel(wstyle||0));
  add(new THREE.CylinderGeometry(.03,.03,1.5,8),chrome,0,.5,.62,0,0,Math.PI/2);
  add(new THREE.CylinderGeometry(.04,.04,1.8,8),chrome,0,.34,-.9,0,0,Math.PI/2);
  const drvStart=body.children.length;
  // Fahrer: detaillierter Rennanzug, Helm, Visier und Arme am Lenkrad
  const suit=new THREE.MeshStandardMaterial({color:0x172b3d,roughness:.82});
  const suitLight=new THREE.MeshStandardMaterial({color:0xe9e4d6,roughness:.7});
  const accent=new THREE.MeshStandardMaterial({color:0xf0a52b,roughness:.55,metalness:.12});
  const visor=new THREE.MeshStandardMaterial({color:0x101923,roughness:.18,metalness:.72});
  const glove=new THREE.MeshStandardMaterial({color:0x24282d,roughness:.8});
  const skin=new THREE.MeshStandardMaterial({color:0xb87952,roughness:.9});
  const ell=(x,y,z,sx,sy,sz,mat)=>{const m=add(new THREE.SphereGeometry(1,20,16),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
  const limb=(a,b,r,mat)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A),m=add(new THREE.CylinderGeometry(r*.82,r,v.length(),12),mat,...A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m};
  // Sitzender Oberkörper mit farbigen Rennanzug-Panels
  ell(0,.91,-.39,.31,.43,.25,suit);
  ell(0,.94,-.18,.24,.31,.075,suitLight);
  add(bx(.075,.32,.035),accent,0,.93,-.095);
  // Schulterpolster und Ärmel
  for(const side of[-1,1]){
    ell(side*.25,1.08,-.31,.16,.17,.17,suit);
    limb([side*.25,1.08,-.27],[side*.38,.91,.02],.095,suit);
    limb([side*.38,.91,.02],[side*.2,1.0,.14],.075,suitLight);
    ell(side*.2,1.0,.14,.095,.075,.09,glove);
    // kleine gelbe Ärmelstreifen
    ell(side*.31,1.0,-.13,.075,.045,.09,accent);
  }
  // Beine im Cockpit
  for(const side of[-1,1]){
    limb([side*.12,.68,-.45],[side*.13,.48,-.02],.12,suit);
    ell(side*.13,.46,.02,.13,.09,.2,glove);
  }
  // Rennhelm mit farbigem Mittelstreifen, Kinnpartie und dunklem Visier
  ell(0,1.36,-.39,.285,.31,.29,helmetM);
  ell(0,1.38,-.115,.222,.125,.045,visor);
  add(bx(.32,.045,.035),accent,0,1.19,-.16);
  ell(0,1.13,-.29,.17,.075,.18,suitLight);
  // kleine seitliche Helm-Details
  for(const side of[-1,1]){
    ell(side*.27,1.34,-.37,.035,.075,.07,accent);
    ell(side*.285,1.34,-.37,.018,.04,.035,dark);
  }
  const drvParts=body.children.slice(drvStart);
  const legacyDriver=new THREE.Group();for(const part of drvParts)legacyDriver.add(part);body.add(legacyDriver);
  const newDriver=modernDriver(color);body.add(newDriver);legacyDriver.visible=PREF.quality==='low';newDriver.visible=PREF.quality!=='low';
  add(bx(.5,.1,.05),tlm,0,.5,-1.33);
  const wm=[new THREE.MeshStandardMaterial({map:tireSide,roughness:.95}),new THREE.MeshStandardMaterial({map:tireCap,roughness:.8}),new THREE.MeshStandardMaterial({map:tireCap,roughness:.8})],wheels=[],pivots=[];
  for(const m of wm)detailMaterial(m,'rubber');
  for(const[x,z,f]of[[-.92,.9,1],[.92,.9,1],[-.97,-.9,0],[.97,-.9,0]]){const R=f?.3:.34,pv=new THREE.Group();pv.position.set(x,R,z);
    const gm=new THREE.CylinderGeometry(R,R,f?.3:.5,20);gm.rotateZ(Math.PI/2);const w=new THREE.Mesh(gm,wm);w.castShadow=true;pv.add(w);g.add(pv);wheels.push(w);if(f)pivots.push(pv)}
  g.rotation.order='YXZ';g.userData={paint,skin:livery,driverVariants:[legacyDriver,newDriver],body,wheels,pivots,tl:tlm,steerG,fpHide:[0,1,2,3,8,17,18,19,20,21,22,23,24].map(i=>drvParts[i]).concat(newDriver.children)};upgradeArt(g);scene.add(g);return g}
const DEF={up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],drift:['Space',''],item:['KeyE',''],restart:['KeyR','']};
let binds=JSON.parse(JSON.stringify(DEF)),rebind=null;
try{const s=JSON.parse(KartStorage.getItem('kart-binds'));if(s)for(const k in DEF)if(Array.isArray(s[k]))binds[k]=[s[k][0]||'',s[k][1]||'']}catch(e){}
const saveBinds=()=>{try{KartStorage.setItem('kart-binds',JSON.stringify(binds))}catch(e){}};
const actOf=c=>Object.keys(binds).find(a=>binds[a].includes(c));
const NAMES={up:'Gas',down:'Bremse / Rückwärts',left:'Links lenken',right:'Rechts lenken',drift:'Drift',item:'Item benutzen',restart:'Rennen neu starten'};
const nm=c=>!c?'–':c==='Space'?'Leertaste':c.startsWith('Key')?c.slice(3):c.startsWith('Digit')?c.slice(5):c.startsWith('Arrow')?{Up:'↑',Down:'↓',Left:'←',Right:'→'}[c.slice(5)]:c;
function renderBinds(){const b=$('binds');b.innerHTML='';for(const a in NAMES){const r=document.createElement('div');r.className='row';r.innerHTML=`<span>${NAMES[a]}</span>`;
  for(let i=0;i<2;i++){const w=rebind&&rebind.a===a&&rebind.i===i,k=document.createElement('button');k.className='kb'+(w?' wait':'');k.textContent=w?'Taste drücken…':nm(binds[a][i]);k.onclick=()=>{rebind={a,i};renderBinds()};r.appendChild(k)}
  b.appendChild(r)}}
let raceLoad=null,raceLoadId=0;
async function boot(MAPID,setup=null){
 if(raceLoad)return;const job={id:++raceLoadId,cancelled:false,net:NET,abort:new AbortController(),dispose:null};raceLoad=job;
 const lang=document.documentElement.lang,words={de:['Lädt…','Abbrechen','Strecke konnte nicht geladen werden. Bitte erneut versuchen.'],en:['Loading…','Cancel','Could not load the track. Please try again.'],fr:['Chargement…','Annuler','Impossible de charger le circuit. Réessaie.']}[lang]||['Lädt…','Abbrechen','Strecke konnte nicht geladen werden. Bitte erneut versuchen.'];
 const overlay=document.createElement('dialog');overlay.id='raceLoading';overlay.className='kr-dialog';overlay.dataset.noTranslate='';overlay.innerHTML='<div class="kr-body"><div class="race-loading-wheel" aria-hidden="true"></div><p role="status"></p><button class="kr-primary" type="button"></button></div>';overlay.querySelector('p').textContent=words[0];overlay.querySelector('button').textContent=words[1];overlay.setAttribute('aria-label',words[0]);document.body.append(overlay);overlay.showModal();
 const cancel=()=>{if(job.cancelled)return;job.cancelled=true;job.abort.abort();job.dispose?.();job.dispose=null;if(raceLoad===job)raceLoad=null;if(stopRace===cancel)stopRace=null;overlay.remove()};stopRace=cancel;
 const back=()=>{if(job.cancelled||raceLoad!==job)return;cancel();if(job.net){if(NET===job.net)leaveOnlineRace()}else leaveSingleRace()};overlay.querySelector('button').onclick=back;overlay.addEventListener('cancel',e=>{e.preventDefault();back()});
 try{await window.KartAccount?.refreshForRace(job.abort.signal);if(job.cancelled||raceLoad!==job)return;job.progress=structuredClone(SAVE);await Promise.all([...(window.KartAccount?[KartAccount.request('/api/rankings/season',undefined,{signal:job.abort.signal}).then(s=>job.season=s.id)]:[]),KartRace.prepare(),...(KartSeason.active()?[christmasPaint()]:[]),...(MAPID==='monaco'?[KartAssets.script('monaco-scenery.js')]:[]),KartStyle.prepare(KartSeason.active()&&!MAPS[MAPID].indoor),...(KartSeason.active()&&!MAPS[MAPID].indoor?[KartAssets.script('winter.js')]:[]),KartAssets.script('assets/scenery/models.js'),KartAssets.script('world-style.js'),...((NET?SAVE.category:(setup||SAVE).category)==='gt3'?[KartAssets.script('cockpit.js')]:[])]);if(job.cancelled||raceLoad!==job||NET!==job.net)return;await buildRace(MAPID,setup,job.season,job)}
 catch(e){if(!job.cancelled){back();flash(words[2],'var(--red)')}}
 finally{overlay.remove();if(raceLoad===job)raceLoad=null}
}
async function buildRace(MAPID,setup=null,rankingSeason=null,job=null){const RACE=setup||SAVE,MP=KartSeason.active()&&!MAPS[MAPID].indoor?{...MAPS[MAPID],snow:true,winter:true}:MAPS[MAPID],CATEGORY=NET?(NET.mixedClasses?NET.driverClass:NET.category):RACE.category,GT3=CATEGORY==='gt3';leaveLobbyUI();
const inputs=new AbortController(),options={signal:inputs.signal};
let raceFrame=0,resultTimer=0,focusTimer=0;
const toMenu=NET?leaveOnlineRace:leaveSingleRace;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
document.body.prepend(renderer.domElement);
graphicsRenderers.add(renderer);applyGraphics(renderer);
const scene=new THREE.Scene();renderer._kartScene=scene;
if(job)job.dispose=()=>{inputs.abort();disposeTrackScenery(scene);disposeRaceScene(scene);graphicsRenderers.delete(renderer);disposeQuality(renderer);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();if(window.kartRaceScene===scene)window.kartRaceScene=null};
const checkpoint=async()=>{await new Promise(resolve=>setTimeout(resolve,0));if(job&&(job.cancelled||raceLoad!==job||NET!==job.net))throw new DOMException('Cancelled','AbortError')};
await checkpoint();
const cam=new THREE.PerspectiveCamera(62,1,1,900);
function resize(){renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
addEventListener('resize',resize,options);resize();

// Himmel, Nebel, Licht
const sk=document.createElement('canvas');sk.width=2;sk.height=256;
{const g=sk.getContext('2d'),gr=g.createLinearGradient(0,0,0,256);(MP.indoor?MP.sky:MP.snow?['#7cbada','#c6e4ef','#e8eef0']:['#32a8e5','#94d9ed','#d1e8df']).forEach((c,i)=>gr.addColorStop([0,.7,1][i],c));g.fillStyle=gr;g.fillRect(0,0,2,256)}
const bgT=new THREE.CanvasTexture(sk);bgT.encoding=THREE.sRGBEncoding;scene.background=bgT;
scene.fog=new THREE.Fog(MP.indoor?MP.fog:MP.snow?0xd9e8ed:0xa6d2cc,MP.fogN*(MP.indoor?1:1.8),MP.fogF*(MP.indoor?1:1.6));scene.fog.color.convertSRGBToLinear();
scene.add(new THREE.HemisphereLight(MP.indoor?MP.hemi[0]:0xc8eaff,MP.indoor?MP.hemi[1]:0x6b7754,MP.indoor?MP.hemi[2]:.9));
const sun=new THREE.DirectionalLight(MP.indoor?MP.sunC:0xffedcd,MP.indoor?MP.sunI:1.1);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:200});
sun.shadow.bias=-.0004;scene.add(sun,sun.target);

// Texturen
// Current atlas is prepared before this scene is created; no legacy texture construction.
const startT=cvs(128,32,(g,w,h)=>{for(let x=0;x<16;x++)for(let y=0;y<4;y++){g.fillStyle=(x+y)%2?'#111':'#fff';g.fillRect(x*8,y*8,8,8)}});

// Strecke
const S=MP.S,ctrl=MP.ctrl;
const curve=new THREE.CatmullRomCurve3(ctrl.map(p=>new THREE.Vector3(p[0]*S,p[2]||0,p[1]*S)),true,MP.curveType||'catmullrom',.5);curve.arcLengthDivisions=MP.arcDivisions||Math.max(2000,ctrl.length*8);curve.updateArcLengths();
// Abtastung: ca. alle 2 m ein Streckenpunkt (lange F1-Strecken bekommen mehr Punkte)
const L=curve.getLength(),N=Math.max(800,Math.round(L/2)),seg=L/N,W=MP.W,K=1.4,BW=W/2+MP.bw,P=[],T=[];
for(let i=0;i<N;i++){P.push(curve.getPointAt(i/N));T.push(curve.getTangentAt(i/N).setY(0).normalize());if(i%400===399)await checkpoint()}
// Krümmung je Punkt (1/m, positiv = Linkskurve). Daraus ein Innen-Limit für seitliche Versätze,
// damit Fahrbahnrand, Kerbs und Leitplanken in engen Haarnadeln nicht übereinanderklappen.
const KW=Math.max(2,Math.round(4/seg)),KAP=[],MX=[];
for(let i=0;i<N;i++){const a=T[(i-KW+N)%N],b=T[(i+KW)%N];KAP.push(Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/(2*KW*seg))}
{const lim=KAP.map(k=>[k<0?.9/-k:1e9,k>0?.9/k:1e9]),MW=Math.max(1,Math.round(6/seg));
 for(let i=0;i<N;i++){let r=1e9,l=1e9;for(let d=-MW;d<=MW;d++){const q=lim[(i+d+N)%N];if(q[0]<r)r=q[0];if(q[1]<l)l=q[1]}MX.push([r,l])}}
const BANK=KAP.map((k,i)=>{const start=Math.min(i*seg,(N-i)*seg),fade=Math.min(1,Math.max(0,(start-90)/35));return MP.banking?Math.max(-MP.banking,Math.min(MP.banking,k*5))*fade:0}),bankY=(k,o)=>-Math.tan(BANK[k])*o;
const co=(k,o)=>o>=0?Math.min(o,MX[k][1]):-Math.min(-o,MX[k][0]);
const pitBay=KartPits.create(MAPID,P,T,seg,W,BW,co);
const boundary=pitBay.boundary;
const SH_IN=BW+3,SH_OUT=BW+9,SH_DROP=1;
const trackDist=(x,z,step=2)=>{let m=1e12;for(let i=0;i<N;i+=step){const q=(x-P[i].x)**2+(z-P[i].z)**2;if(q<m)m=q}return Math.sqrt(m)}; // Grasstreifen neben der Strecke (nur Gelände-Strecken)
function strip(a,b,y,mat,vrep,colored){
  const pos=[],uv=[],col=[],ix=[];
  for(let i=0;i<=N;i++){const k=i%N,t=T[k],p=P[k],sx=t.z,sz=-t.x,ka=MP.indoor&&a<=-BW?boundary(k,a):co(k,a),kb=co(k,b);
    pos.push(p.x+sx*ka,y+p.y+bankY(k,ka),p.z+sz*ka,p.x+sx*kb,y+p.y+bankY(k,kb),p.z+sz*kb);uv.push(0,i*seg/vrep,1,i*seg/vrep);
    if(colored){const c=(i>>2)%2?[1,1,1]:[.85,.08,.08];col.push(...c,...c)}
    if(i<N){const j=i*2;ix.push(j,j+1,j+2,j+1,j+3,j+2)}}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(colored)g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(ix);g.computeVertexNormals();
  let geometry=g;if(colored){geometry=g.toNonIndexed();g.dispose();const c=geometry.attributes.color;for(let i=0;i<c.count;i++){const rgb=(Math.floor(i/6)>>2)%2?[.93,.89,.83]:[.68,.035,.024];c.setXYZ(i,...rgb)}}const m=new THREE.Mesh(geometry,mat);m.receiveShadow=true;scene.add(m);
}
strip(-W/2,W/2,.02,pbr(new THREE.MeshStandardMaterial({roughness:.9,side:THREE.DoubleSide}),MP.winter?"WinterRoad":MP.snow?"Snow001":"Asphalt012",[W/14,1],{road:true,normal:.15}),14);
strip(W/2,W/2+K,.07,pbr(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide}),"PaintedCurb",[1,1],{normal:.3}),1,true);
strip(-W/2-K,-W/2,.07,pbr(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide}),"PaintedCurb",[1,1],{normal:.3}),1,true);
if(MP.winter){const snowCurb=pbr(new THREE.MeshStandardMaterial({roughness:1,side:THREE.DoubleSide}),'WinterSnow',[1,1]);strip(W/2,W/2+K,.085,snowCurb,1);strip(-W/2-K,-W/2,.085,snowCurb,1)}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),pbr(new THREE.MeshStandardMaterial({roughness:1}),MP.winter?"WinterSnow":MP.snow?"Snow001":MP.indoor?"Concrete034":"Grass001",[180,180],{normal:.8}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);ground.visible=!MP.indoor&&!MP.terrain;
const line=new THREE.Mesh(new THREE.PlaneGeometry(W,2),new THREE.MeshBasicMaterial({map:startT}));
line.rotation.x=-Math.PI/2;line.rotation.z=-Math.atan2(T[0].x,T[0].z)+Math.PI/2*0;
line.position.set(P[0].x,P[0].y+.1,P[0].z);line.rotation.set(-Math.PI/2,0,0);line.rotation.order='YXZ';line.rotation.y=Math.atan2(T[0].x,T[0].z)+Math.PI/2*0;scene.add(line);
// Startbogen
{const a=Math.atan2(T[0].x,T[0].z),m=new THREE.MeshStandardMaterial({color:0xdddddd}),g=new THREE.Group();
 for(const s of[-1,1]){const p=new THREE.Mesh(KartModels.rounded(.6,7,.6,.12),m);p.position.set(s*(W/2+2),3.5,0);p.castShadow=true;g.add(p)}
 const b=new THREE.Mesh(KartModels.rounded(W+4.6,1.25,.7,.16),new THREE.MeshStandardMaterial({color:0xf3c73e}));b.position.y=7;b.castShadow=true;g.add(b);
 g.position.set(P[0].x,P[0].y,P[0].z);g.scale.y=MP.indoor?.6:1;g.rotation.y=a;scene.add(g)}

// Kart
let lamp=null;
// Local road height keeps neighbouring sections at different elevations separate.
const terrain=KartTerrain.create(P,T,seg,BW,MP.tn??5),city=MAPID==='monaco'?KartMonaco.create(P,T,BW):null;
function terrH(x,z){const y=MP.terrain?terrain.height(x,z):0;return city?city.height(x,z,y):y}
if(MP.terrain){const minX=Math.min(...P.map(p=>p.x))-160,maxX=Math.max(...P.map(p=>p.x))+160,minZ=Math.min(...P.map(p=>p.z))-160,maxZ=Math.max(...P.map(p=>p.z))+160,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ,nx=Math.ceil(w/4),nz=Math.ceil(d/4),tg=new THREE.PlaneGeometry(w,d,nx,nz);tg.rotateX(-Math.PI/2);const pa=tg.attributes.position;
 for(let i=0;i<pa.count;i++)pa.setY(i,terrH(pa.getX(i)+cx,pa.getZ(i)+cz));tg.computeVertexNormals();
 const surface=MP.winter?'WinterSnow':MP.snow?'Snow001':MP.city?'Concrete034':'Grass001',tm=new THREE.Mesh(tg,pbr(new THREE.MeshStandardMaterial({roughness:1,color:MP.city?0xc7bca7:0xffffff}),surface,[w/9,d/9],{normal:.4}));tm.name='Road terrain';tm.position.set(cx,0,cz);tm.receiveShadow=true;scene.add(tm);
 // Sample the actual rendered triangles so each bank joins without cracks.
 const meshHeight=(x,z)=>{const u=Math.max(0,Math.min(nx-.00001,(x-minX)/w*nx)),v=Math.max(0,Math.min(nz-.00001,(z-minZ)/d*nz)),ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,k=iz*(nx+1)+ix,A=pa.getY(k),B=pa.getY(k+nx+1),C=pa.getY(k+nx+2),D=pa.getY(k+1);return fx+fz<=1?A+(D-A)*fx+(B-A)*fz:C+(B-C)*(1-fx)+(D-C)*(1-fz)};
 const shM=pbr(new THREE.MeshStandardMaterial({roughness:1,side:THREE.DoubleSide,color:MP.city?0xd4caba:0xffffff}),surface,[1,1]);
 for(const side of [-1,1]){const pos=[],uv=[],ix=[];for(let i=0;i<=N;i++){const k=i%N,p=P[k],t=T[k],outer=terrain.width(k,side,MP.city?BW+5:BW+20),inner=Math.min(BW+2,outer-.5);
  for(const [j,width]of [W/2,inner,outer].entries()){const o=co(k,side*width),x=p.x+t.z*o,z=p.z-t.x*o,y=j===2?meshHeight(x,z)-.025:p.y+bankY(k,o)-.035;pos.push(x,y,z);uv.push(width/8,i*seg/8)}
  if(i<N)for(let j=0;j<2;j++){const n=i*3+j;ix.push(n,n+1,n+3,n+1,n+4,n+3)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const bank=new THREE.Mesh(g,shM);bank.name='Road banks';bank.receiveShadow=true;scene.add(bank)}
}
if(city)city.build(scene,terrH,MP.snow);
// Berge, Schneefall, Flure
await checkpoint();
// Rounded distant hills and clouds are built with the common scenery style.
createTrackScenery(scene,P,{width:W,border:BW,height:terrH,snow:!!MP.snow,winter:!!MP.winter,indoor:!!MP.indoor,city:!!MP.city,seed:MAPID.split('').reduce((s,c)=>s+c.charCodeAt(0),39)});
const winterTracks=MP.winter?KartWinter.trails(scene,(x,z,car)=>{const i=nearest(x,z,car.userData.snowIdx??0,car.userData.snowIdx===undefined?N:NW);car.userData.snowIdx=i;return roadY(x,z,i)}):null;
let snowP=null;
if(MP.snow){const g=new THREE.BufferGeometry(),arr=new Float32Array((MP.winter?900:1800)*3);for(let i=0;i<arr.length;i+=3){arr[i]=(Math.random()-.5)*120;arr[i+1]=Math.random()*34;arr[i+2]=(Math.random()-.5)*120}
 g.setAttribute('position',new THREE.BufferAttribute(arr,3));snowP=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:MP.winter?.13:.35,transparent:true,opacity:.8,depthWrite:false}));snowP.frustumCulled=false;scene.add(snowP)}
function fall(dt){const a=snowP.geometry.attributes.position,s=a.array;for(let i=0;i<s.length;i+=3){s[i+1]-=dt*(MP.winter?1+(i%7)*.12:4+(i%7));s[i]+=dt*Math.sin(i+raceT*.5)*.8;
 if(s[i+1]<cam.position.y-6)s[i+1]+=34;let d=s[i]-cam.position.x;if(d>60)s[i]-=120;else if(d<-60)s[i]+=120;d=s[i+2]-cam.position.z;if(d>60)s[i+2]-=120;else if(d<-60)s[i+2]+=120}a.needsUpdate=true}
if(MP.indoor){const wallM=pbr(new THREE.MeshStandardMaterial({roughness:.95,side:THREE.DoubleSide}),"Concrete034",[2,2]),flM=pbr(new THREE.MeshStandardMaterial({color:0x4a4d52,roughness:1,side:THREE.DoubleSide}),"Concrete034",[8,8]),clM=new THREE.MeshStandardMaterial({color:0xcfcac0,roughness:1,side:THREE.DoubleSide}),lpM=new THREE.MeshBasicMaterial({color:0xfff1c8,side:THREE.DoubleSide}),HC=4.6,WO=BW+.6;
 const wall=off0=>{const pos=[],uv=[],ix=[];for(let i=0;i<=N;i++){const k=i%N,t=T[k],p=P[k],off=boundary(k,off0),x=p.x+t.z*off,z=p.z-t.x*off;pos.push(x,p.y,z,x,p.y+HC,z);uv.push(0,i*seg/12,1,i*seg/12);if(i<N){const j=i*2;ix.push(j,j+1,j+2,j+1,j+3,j+2)}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const m=new THREE.Mesh(g,wallM);m.receiveShadow=true;scene.add(m)};
  wall(WO);wall(-WO);
 strip(-WO,WO,-.06,flM,10);strip(-WO,WO,HC,clM,12);strip(-1.2,1.2,HC-.3,lpM,1);
 lamp=new THREE.PointLight(0xffe2b0,1.1,45);scene.add(lamp);
 
 
 
 }
// Leitplanken: Hitbox = exakt die sichtbare Planken-Linie (BP), auf beiden Seiten.
// Bei harten Einschlägen fliegen Teile weg (nur Optik) und stehen nach kurzer Zeit wieder – die Wand bleibt immer fest.
const BP=[[],[]];for(let k=0;k<N;k++)for(let si=0;si<2;si++){const o=boundary(k,si?BW:-BW);BP[si].push({x:P[k].x+T[k].z*o,y:P[k].y+bankY(k,o),z:P[k].z-T[k].x*o})}
const BSTEP=MP.city?1:4,NB=Math.ceil(N/BSTEP),bars=[],flying=[],BLEN=seg*4,bl=new THREE.InstancedMesh(KartModels.rounded(.6,1.1,1,.14),KartStyle.apply(new THREE.MeshStandardMaterial({roughness:.76}),17,[1,1],false),NB*2),bd=new THREE.Object3D();
bd.rotation.order='YXZ';
{const cc=new THREE.Color();
 let c=0;for(let i=0;i<NB;i++)for(let si=0;si<2;si++){const k=i*BSTEP,A=BP[si][k%N],B=BP[si][Math.min(k+BSTEP,N)%N],dx=B.x-A.x,dz=B.z-A.z,hl=Math.hypot(dx,dz),
   b={x:(A.x+B.x)/2,y:(A.y+B.y)/2+.55,z:(A.z+B.z)/2,ry:Math.atan2(dx,dz),rx:-Math.atan2(B.y-A.y,hl||1),rz:0,sl:Math.max(.05,hl+.12),vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,gone:false,t:0};
   b.o=[b.x,b.y,b.z,b.rx,b.ry];bars.push(b);setBar(c,b);bl.setColorAt(c,cc.setHex(i%2?0xfff7e9:0xe54b48).convertSRGBToLinear());c++}
 bl.castShadow=bl.receiveShadow=true;bl.frustumCulled=false;scene.add(bl)}
function setBar(c,b){bd.position.set(b.x,b.y,b.z);bd.rotation.set(b.rx,b.ry,b.rz);bd.scale.set(1,1,b.sl);bd.updateMatrix();bl.setMatrixAt(c,bd.matrix)}
function breakBars(bi,vx,vz,vn){for(let d=-1;d<=1;d++){const j=(((Math.floor(bi/2)+d)%NB)+NB)%NB*2+(bi&1),b=bars[j];if(b.gone)continue;b.gone=true;b.t=0;const k=.5+Math.random()*.3;
  b.vx=vx*k+(Math.random()-.5)*4;b.vz=vz*k+(Math.random()-.5)*4;b.vy=4+Math.random()*5+vn*.2;b.wx=(Math.random()-.5)*12;b.wy=(Math.random()-.5)*8;b.wz=(Math.random()-.5)*12;flying.push(j)}}
function flyBars(dt){for(let q=flying.length-1;q>=0;q--){const j=flying[q],b=bars[j];b.t+=dt;b.vy-=24*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.rx+=b.wx*dt;b.ry+=b.wy*dt;b.rz+=b.wz*dt;
  const fl=b.o[1]-.25;if(b.y<fl&&b.vy<0){b.y=fl;b.vy*=-.35;b.vx*=.7;b.vz*=.7;b.wx*=.6;b.wy*=.6;b.wz*=.6;if(Math.abs(b.vy)<1)b.vy=0}
  if(b.t>3.5){[b.x,b.y,b.z,b.rx,b.ry]=b.o;b.rz=0;b.gone=false;flying.splice(q,1)}setBar(j,b)}bl.instanceMatrix.needsUpdate=true}
// Kreis (cx,cz,r) gegen die Planken nahe Streckenpunkt ni: liefert die tiefste Eindringung und die Normale zur Strecke hin
function wallHit(cx,cz,ni,r,out){let best=0;const nearY=roadY(cx,cz,ni),candidate={};
  for(let si=0;si<2;si++)for(let d=-Math.ceil(7/seg);d<=Math.ceil(7/seg);d++){
    const k=(ni+d+N)%N,A=BP[si][k],B=BP[si][(k+1)%N];
    if(Math.abs((A.y+B.y)/2-nearY)>2.2)continue;
    const pen=KartTrackPhysics.segmentHit(cx,cz,r+.3,A,B,P[k],candidate);
    if(pen>best){best=pen;out.nx=candidate.nx;out.nz=candidate.nz;out.si=si;out.k=k}
  }return best}

await checkpoint();
const colors=[0x4f7d96,0xa8402f,0xc89a2a,0x4f8a55,0x8a5fb0,0xd0712c,0x3a9aa8,0xb04f7a];
KartStyle.environment(scene);
window.kartRaceScene=scene;
const playerMesh=makeKart(paintColor(),WSTYLE,scene,NET?NET.driverClass:CATEGORY,NET?SAVE.car:(RACE.car||SAVE.car),NET?SAVE.kartSkin:(RACE.kartSkin||SAVE.kartSkin),NET?SAVE.kartModel:(RACE.kartModel||SAVE.kartModel));const cockpit=(NET?NET.driverClass==='gt3':GT3)?KartCockpit.create(playerMesh,WSTYLE):null;
// ===== Reifen-Effekte: Bremsspuren, Reifenrauch, Drift-Funken =====
const SKQ=1400,skPos=new Float32Array(SKQ*12),skG=new THREE.BufferGeometry();
{const ix=[];for(let q=0;q<SKQ;q++){const j=q*4;ix.push(j,j+1,j+2,j+1,j+3,j+2)}skG.setIndex(ix);skG.setAttribute('position',new THREE.BufferAttribute(skPos,3))}
const skMesh=new THREE.Mesh(skG,new THREE.MeshBasicMaterial({color:MP.snow?0x8796a4:0x0c0c0c,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide}));
skMesh.frustumCulled=false;skMesh.renderOrder=1;scene.add(skMesh);
let skI=0;const skPrev=[null,null];
function skid(w,p,rx,rz,on){if(!on){skPrev[w]=null;return}
  const hw=.15,a={lx:p.x-rx*hw,lz:p.z-rz*hw,rx:p.x+rx*hw,rz:p.z+rz*hw,y:p.y+.09},b=skPrev[w];
  if(b&&Math.hypot(a.lx-b.lx,a.lz-b.lz)<.35)return;skPrev[w]=a;if(!b)return;
  skPos.set([b.lx,b.y,b.lz,b.rx,b.y,b.rz,a.lx,a.y,a.lz,a.rx,a.y,a.rz],skI*12);skI=(skI+1)%SKQ;skG.attributes.position.needsUpdate=true}
const softT=(c0,c1)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,c0);gr.addColorStop(1,c1);g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t};
const smokeT=softT('rgba(255,255,255,.9)','rgba(255,255,255,0)'),sparkT=softT('rgba(255,255,255,1)','rgba(255,255,255,0)');
const mkPool=(n,map,add)=>Array.from({length:n},()=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:0,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));m.visible=false;scene.add(m);return{m,t:0,life:0,vx:0,vy:0,vz:0,s0:1,s1:1,a:1}});
const puffs=mkPool(80,smokeT,false),sparks=mkPool(50,sparkT,true);let puffI=0,sparkI=0;
function emit(pool,i,p,v,life,s0,s1,a,col){const q=pool[i];q.t=0;q.life=life;q.m.position.copy(p);q.vx=v[0];q.vy=v[1];q.vz=v[2];q.s0=s0;q.s1=s1;q.a=a;q.m.material.color.setHex(col);q.m.visible=true}
function stepPool(pool,dt){for(const q of pool){if(!q.m.visible)continue;q.t+=dt;if(q.t>=q.life){q.m.visible=false;continue}const f=q.t/q.life;
  q.m.position.x+=q.vx*dt;q.m.position.y+=q.vy*dt;q.m.position.z+=q.vz*dt;q.vx*=1-1.5*dt;q.vz*=1-1.5*dt;q.m.scale.setScalar(q.s0+(q.s1-q.s0)*f);q.m.material.opacity=q.a*(1-f)}}
const wv=new THREE.Vector3();let smA=0,spA=0;
function tireFx(dt,brake){const ud=playerMesh.userData,sp=Math.hypot(pl.vx,pl.vz),onRoad=Math.abs(pl.lat||0)<W/2+K+.5,
  locked=brake&&pl.vF>4&&!(pl.spin>0),slideL=Math.abs(pl.vL),
  // Rutsch-Intensität 0..1: Drift, blockierende Hinterräder, seitliches Rutschen oder Dreher
  slide=sp<4?0:Math.min(1,pl.drift?.55+slideL*.03:locked?.45+pl.vF*.01:pl.spin>0?.8:Math.max(0,(slideL-2.5)*.12));
  pl.slide=slide;
  // Räder: vorne rollen, hinten blockieren beim Bremsen (Kart = nur Hinterradbremse) bzw. drehen beim Driften durch
  ud.wheels.forEach((w,i)=>{const r=i<2?pl.vF:locked?0:pl.drift?pl.vF*1.45:pl.vF;w.rotation.x+=r*dt/.3});
  const rx=-Math.cos(pl.h),rz=Math.sin(pl.h);playerMesh.updateMatrixWorld(true);
  const pts=[-1,1].map(sx=>playerMesh.localToWorld(new THREE.Vector3(sx*.97,0,-.9)));
  pts.forEach((p,w)=>skid(w,p,rx,rz,slide>.3&&onRoad));
  smA+=dt*slide*45;
  while(smA>1){smA--;const p=pts[puffI&1];wv.copy(p);wv.y+=.25;const k=.4+Math.random()*.6;
    emit(puffs,puffI,wv,[-Math.sin(pl.h)*sp*.15+(Math.random()-.5)*1.5,.8+Math.random()*.9,-Math.cos(pl.h)*sp*.15+(Math.random()-.5)*1.5],.8+Math.random()*.5,.6,2.2+slide*2,(MP.snow?.75:.6)*k*(onRoad?1:.6),onRoad?(MP.snow?0xffffff:0xe2ded6):0x9a8a6a);puffI=(puffI+1)%puffs.length}
  const tier=pl.dc>2.8?3:pl.dc>1.7?2:pl.dc>.8?1:0;spA+=pl.drift&&tier?dt*36:0;
  while(spA>1){spA--;const p=pts[sparkI&1];wv.copy(p);wv.y+=.12;
    emit(sparks,sparkI,wv,[-Math.sin(pl.h)*6+(Math.random()-.5)*4,2+Math.random()*3,-Math.cos(pl.h)*6+(Math.random()-.5)*4],.22+Math.random()*.15,.35,.12,1,[0,0x5ee1ff,0xff9b3d,0xd77bff][tier]);sparkI=(sparkI+1)%sparks.length}
  stepPool(puffs,dt);stepPool(sparks,dt);for(const q of sparks)if(q.m.visible)q.vy-=12*dt;
  if(sg)sg.gain.value+=((state==='race'&&!paused&&!document.hidden?slide*.05*soundLevel():0)-sg.gain.value)*Math.min(1,10*dt)}
// Drei Perspektiven: Verfolger, Motorhaube und Cockpit
let cameraMode=0;$('sp').classList.remove('cockpit-speed');$('camera').classList.remove('cockpit-camera');
// Vier Perspektiven: Verfolger, Motorhaube, Cockpit und naher Verfolger (3. Person, dicht am Kart)
const cameraNames=['VERFOLGER','MOTORHAUBE','COCKPIT','NAH (3. PERSON)'],chaseCam=()=>cameraMode===0||cameraMode===3;
function nextCamera(){if(NET?.spectator)return;cameraMode=(cameraMode+1)%cameraNames.length;$('sp').classList.toggle('cockpit-speed',cameraMode===2);$('camera').classList.toggle('cockpit-camera',cameraMode===2);$('camTxt').textContent='Kamera '+(cameraMode+1)+'/'+cameraNames.length;playerMesh.userData.fpHide.forEach(m=>m.visible=chaseCam());if(cockpit){cockpit.group.visible=cameraMode===2;playerMesh.userData.steerG.visible=cameraMode!==2}}

// Spielzustand
await checkpoint();
const LAPS=NET?NET.laps:RACE.laps,COMP=NET?!!NET.comp:RACE.comp,keys={};
const CAR_ID=playerMesh.userData.car||playerMesh.userData.recordCar,RACE_TUNING=KartTuningStats.prepareRace(CAR_ID,job?.progress||SAVE,{competitive:COMP,online:!!NET,allowed:NET?NET.upgradesAllowed:RACE.upgradesEnabled},NET&&!NET.mixedClasses?NET.category:undefined),UPGRADES=RACE_TUNING.upgrades,TUNED=Object.values(UPGRADES).some(Boolean),RECORD_ELIGIBLE=!TUNED&&!NET?.upgradesAllowed,CAR_STATS=RACE_TUNING.stats;if(TUNED)KartTuningVisuals.attach(playerMesh,CAR_ID,UPGRADES);
const RS={t3:0,boxes:0,draftT:0}; // Fortschritt dieses Rennens (wird beim Zieleinlauf gespeichert)
function trackAt(s){s=((s%N)+N)%N;const i=Math.floor(s),f=s-i,a=P[i],b=P[(i+1)%N],ta=T[i],tb=T[(i+1)%N];
  return{y:a.y+(b.y-a.y)*f,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,tx:ta.x+(tb.x-ta.x)*f,tz:ta.z+(tb.z-ta.z)*f}}
// Weltgeschwindigkeit (vx,vz) statt kartfester Werte: so entsteht echter Schräglauf beim Driften
// Exakte Fahrbahnhöhe unter einem Kart: Höhe an allen vier Radaufstandspunkten -> Höhe + Neigung,
// ohne Nachziehen; kein Rad darf unter der Fahrbahn liegen (auch nicht in steilen Haarnadeln).
const AXLE=GT3?1.23:.9,WHL=[[-.95,AXLE],[.95,AXLE],[-.95,-AXLE],[.95,-AXLE]],GW=Math.max(4,Math.round(6/seg));
function roadY(x,z,idx){let bi=idx,bq=1e12;for(let d=-GW;d<=GW;d++){const i=(idx+d+N)%N,q=(x-P[i].x)**2+(z-P[i].z)**2;if(q<bq){bq=q;bi=i}}
  const t=T[bi],p=P[bi],al=Math.max(-seg,Math.min(seg,(x-p.x)*t.x+(z-p.z)*t.z));return trackAt(bi+al/seg).y+bankY(bi,(x-p.x)*t.z-(z-p.z)*t.x)}
function groundAt(x,z,idx,h){const fx=Math.sin(h),fz=Math.cos(h),ys=WHL.map(([a,b])=>roadY(x+fx*b-fz*a,z+fz*b+fx*a,idx)),
  yF=(ys[0]+ys[1])/2,yR=(ys[2]+ys[3])/2,base=(yF+yR)/2,roll=Math.atan(((ys[1]+ys[3])-(ys[0]+ys[2]))/3.8);let lift=0;
  for(let i=0;i<4;i++)lift=Math.max(lift,ys[i]-(base+(i<2?.5:-.5)*(yF-yR)+(i%2?.95:-.95)*Math.tan(roll)));
  return{y:base+lift,roll:-roll,pitch:Math.atan((yF-yR)/(AXLE*2))}}
const pl={x:0,z:0,h:0,vx:0,vz:0,vF:0,vL:0,steer:0,idx:N-6,total:-6,camH:0,lapT:0,best:0,fin:null,drift:0,dc:0,bT:0,bTier:0,dWin:0,dPrev:false,slope:0,pitch:0,lat:0,slide:0};
const GS=Math.max(4,Math.round(12/seg)); // Startplatz-Abstand ~12 m
{const sl=NET?NET.slot:0,row=Math.floor(sl/2),sd=sl%2?-2.8:2.8,gi=GS+GS*row,t=trackAt(N-gi),sx=t.tz,sz=-t.tx;pl.idx=N-gi;pl.total=-gi;pl.x=t.x+sx*sd;pl.z=t.z+sz*sd;pl.h=Math.atan2(t.tx,t.tz);pl.camH=pl.h;const y=groundAt(pl.x,pl.z,pl.idx,pl.h).y;pl.y=y;pl.completedLaps=0;cam.position.set(pl.x-Math.sin(pl.h)*7,y+3.1,pl.z-Math.cos(pl.h)*7);cam.lookAt(pl.x+Math.sin(pl.h)*5,y+1.1,pl.z+Math.cos(pl.h)*5)}
// Streckenprofil für Bots: Kurvenkrümmung -> Maximaltempo, dann rückwärts Bremspunkte, vorwärts Beschleunigung
// KS = Richtungsänderung auf 20 m (wie vorher), VP = Kurvengrenztempo aus der echten Krümmung
const KS=[],VP=[],LA=Math.max(1,Math.round(16/seg)),LB=Math.max(1,Math.round(24/seg));
for(let i=0;i<N;i++){KS.push(KAP[i]*20);VP.push(Math.min(GT3?66:39,Math.sqrt((GT3?37:27)*MP.grip/Math.max(Math.abs(KAP[i]),1e-4))))}
for(let p=0;p<2;p++){for(let i=N-1;i>=0;i--)VP[i]=Math.min(VP[i],Math.sqrt(VP[(i+1)%N]**2+2*26*seg));for(let i=0;i<N;i++)VP[(i+1)%N]=Math.min(VP[(i+1)%N],Math.sqrt(VP[i]**2+2*9*seg))}
const botConfig=NET?NET.bots:{count:RACE.botCount,items:RACE.botItems,cars:RACE.botCars,difficulties:RACE.botDifficulties};
const BOT_ITEMS=!COMP&&botConfig.items,botProfiles=KartDriving.profiles(KAP,seg,NET?NET.category==='gt3':GT3,MP.grip);
const botTraffic=()=>[...ai.map(a=>({source:a,s:a.s,o:a.o,v:a.v,y:a.y,finished:!!a.ft})),{source:pl,s:pl.total,o:pl.lat||0,v:pl.vF,y:pl.y,finished:!!pl.fin},...[...rem.values()].map(q=>({source:q,s:q.tt,o:q.idx===undefined?0:((q.x-P[q.idx].x)*T[q.idx].z-(q.z-P[q.idx].z)*T[q.idx].x),v:q.v,y:q.y,finished:!!q.fin}))];
function botMaster(){if(NET?.spectator)return false;return !NET||KartBots.authority(NET.room.peers(),NET.order)===NET.me}
const ai=Array.from({length:botConfig.count},(_,i)=>({s:-GS*(1+Math.floor((i+(NET?NET.order.length:1))/2)),o:(i+(NET?NET.order.length:1))%2?-2.8:2.8,level:botConfig.difficulties[i]||'normal',phase:i*1.7,pit:false,pitT:0,pitExit:false,v:0,spin:0,sp:0,kick:0,ov:0,draft:0,brk:false,held:null,itemDelay:0,mesh:makeKart(colors[(i+1)%colors.length],(i+1)%3,scene,NET?NET.category:CATEGORY,botConfig.cars[i])}));
let state=NET?'waiting':'count',t0=performance.now(),raceT=0,time=0;
const readyView=NET&&!NET.spectator?KartRaceReady.mount(NET,leaveOnlineRace):null,rearIndicator=KartRearIndicator.create(),telemetry=KartRaceTelemetry.create(RACE_TUNING);let liveValues={speed:0,maxSpeed:CAR_STATS.topSpeed,acceleration:CAR_STATS.acceleration,handling:CAR_STATS.grip};const debug={get current(){return {...liveValues,car:CAR_ID,reason:RACE_TUNING.reason,stats:{...CAR_STATS},upgrades:{...UPGRADES},stored:{...RACE_TUNING.stored}}}};window.KartRaceDebug=debug;console.info("[Race tuning]",debug.current);let lapGuard=KartRace.progress(N,seg,pl.total,{x:P[0].x,z:P[0].z,tx:T[0].x,tz:T[0].z}),raceProgress=KartRace.raceProgress(N,seg,pl.total,{x:P[0].x,z:P[0].z,tx:T[0].x,tz:T[0].z}),readyRendered=false,resultsShown=false;
const fmt=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(2).padStart(5,'0')};

// Eingabe
let paused=false;
let spectatorFollow='',spectatorSnap=false;const spectatorSelect=document.createElement('select');spectatorSelect.id='spectatorDriver';if(NET?.spectator){spectatorSelect.setAttribute('aria-label',({de:'Fahrer beobachten',en:'Watch driver',fr:'Suivre un pilote'})[document.documentElement.lang]);spectatorSelect.style.cssText='position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:60;max-width:60vw;padding:8px;border-radius:10px;background:var(--navy-2);color:white';document.body.append(spectatorSelect);for(const id of ['tl','tr','camera'])$(id).style.display='none'}
function pauseSound(){const mute=paused||document.hidden;window.kartAudioPaused=mute;if(mute){musicPlayer.pause();if(gn)gn.gain.value=0;if(sg)sg.gain.value=0;if(ac?.state==='running')ac.suspend().catch(()=>{})}else{if(ac?.state==='suspended')ac.resume().catch(()=>{});applyMusic()}}
addEventListener('visibilitychange',pauseSound,options);
function togglePanel(on){if(on&&settingsSection==='account')window.refreshAccount?.();paused=on;pauseSound();rebind=null;$('panel').classList.toggle('on',on);for(const k in keys)keys[k]=0;if(on){renderBinds();$('close').focus()}}
$('gear').onclick=()=>togglePanel(!paused);$('camera').onclick=nextCamera;$('close').onclick=()=>togglePanel(false);$('tomenu').onclick=$('home').onclick=toMenu;
function restartRace(){if(NET){if(NET.host)NET.room.restart(NET.round);return}const setup={...RACE};stopRace?.();boot(MAPID,setup)}
$('reset').disabled=!!NET&&!NET.host;$('reset').onclick=restartRace;
const exitDialog=document.createElement('dialog');exitDialog.className='kr-dialog';exitDialog.id='raceExitConfirm';exitDialog.dataset.noTranslate='';exitDialog.innerHTML='<div class="kr-body"><h2></h2><div class="btn-row" style="margin-top:22px"><button type="button" data-stay></button><button type="button" class="kr-primary" data-leave></button></div></div>';document.body.append(exitDialog);let exitPaused=false;
function askExit(){if(exitDialog.open)return;exitPaused=paused;paused=true;pauseSound();for(const k in keys)keys[k]=0;const text=({de:['Rennen wirklich verlassen?','Bleiben','Verlassen'],en:['Really leave the race?','Stay','Leave'],fr:['Vraiment quitter la course ?','Rester','Quitter']})[document.documentElement.lang];exitDialog.querySelector('h2').textContent=text[0];exitDialog.querySelector('[data-stay]').textContent=text[1];exitDialog.querySelector('[data-leave]').textContent=text[2];exitDialog.showModal();exitDialog.querySelector('[data-stay]').focus()}
exitDialog.querySelector('[data-stay]').onclick=()=>exitDialog.close();exitDialog.querySelector('[data-leave]').onclick=toMenu;exitDialog.addEventListener('close',()=>{paused=exitPaused;pauseSound();(paused?document.getElementById('close'):document.getElementById('gear')).focus()});exitDialog.addEventListener('keydown',e=>e.stopPropagation());
addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(e.code==='Backspace'){e.preventDefault();if(!e.repeat)askExit();return}
  if(e.code==='Escape'){togglePanel(!paused);return}
  const bound=actOf(e.code);
  if(e.code==='KeyM'&&!bound){toMenu();return}
  if(e.code==='KeyC'&&!bound){if(!e.repeat)nextCamera();return}
  if(paused)return;
  if(qte){const qn={Digit1:1,Digit2:2,Digit3:3,Digit4:4,Numpad1:1,Numpad2:2,Numpad3:3,Numpad4:4}[e.code];if(qn){qteKey(qn);e.preventDefault();return}}
  const a=actOf(e.code);if(!a)return;e.preventDefault();
  if(a==='restart'){if(!e.repeat)restartRace();return}
  keys[a]=1;startAudio()},options);
addEventListener('keyup',e=>{const a=actOf(e.code);if(a&&a!=='restart')keys[a]=0},options);
document.querySelectorAll('#touch button').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{keys[k]=1;startAudio();e.preventDefault()},options);
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=0,options))});

// Sound
let ac,osc,gn,sg=null;
function startAudio(){if(ac)return;try{ac=new(window.AudioContext||window.webkitAudioContext)();osc=ac.createOscillator();osc.type='sawtooth';
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=700;gn=ac.createGain();gn.gain.value=.03*soundLevel();osc.connect(f);f.connect(gn);gn.connect(ac.destination);osc.start();
  const nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1500;bp.Q.value=3;sg=ac.createGain();sg.gain.value=0;ns.connect(bp);bp.connect(sg);sg.connect(ac.destination);ns.start()}catch(e){}}

const NW=Math.max(25,Math.round(50/seg));
function nearest(x,z,prev,window=NW,y=pl.y){return KartRace.nearest(P,x,y,z,prev,window)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Windschatten: hinter einem Kart (2,5-30 m, fast mittig) weniger Luftwiderstand
function draft(x,z,h,self){let best=0;const fx=Math.sin(h),fz=Math.cos(h);
  for(const k of[pl,...ai,...rem.values()]){if(k===self||k.x===undefined)continue;const dx=k.x-x,dz=k.z-z,a=dx*fx+dz*fz,sd=-dx*fz+dz*fx*-1*-1;
    const side=dx*-Math.cos(h)+dz*Math.sin(h);if(a>2.5&&a<30&&Math.abs(side)<2.2)best=Math.max(best,(1-a/30)*(1-Math.abs(side)/2.2*.5))}
  return best}
// ===== Item-Boxen, Power-ups, Motorschaden (Tastenfolge), Boxenstopp =====
const boxes=[],boxT=cvs(128,128,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#ffe27a');gr.addColorStop(1,'#e08a12');g.fillStyle=gr;g.fillRect(0,0,w,h);g.strokeStyle='#fff6c8';g.lineWidth=8;g.strokeRect(4,4,w-8,h-8);g.fillStyle='#3a2200';g.font='bold 92px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('?',w/2,h/2+6)}),
  boxM=new THREE.MeshStandardMaterial({map:boxT,emissive:0x6a4200,emissiveIntensity:.9,roughness:.4,metalness:.2}),boxG=new THREE.BoxGeometry(1.3,1.3,1.3);
function placeBox(b){const R=NET?mul(NET.seed+b.id*977+b.gen*131):Math.random;let ok,tries=0,idx;if(NET)idx=60+Math.floor((b.id+R()*.8)*(N-130)/8);else do{idx=60+Math.floor(R()*(N-130));ok=boxes.every(o=>o===b||!o.on||Math.abs(o.idx-idx)>45);tries++}while(!ok&&tries<30);
  const off=(R()-.5)*(W-4),p=P[idx],t=T[idx];b.idx=idx;b.x=p.x+t.z*off;b.z=p.z-t.x*off;b.y=p.y+1.25;b.on=true;b.mesh.visible=true;b.mesh.position.set(b.x,b.y,b.z)}
for(let i=0;i<(COMP?0:8);i++){const m=new THREE.Mesh(boxG,boxM);m.castShadow=true;scene.add(m);const b={mesh:m,on:false,idx:0,wait:0,x:0,y:0,z:0,id:i,gen:0};boxes.push(b);placeBox(b)}
// Track-specific service lane, shared by every graphics tier.
pitBay.winter=!!MP.winter;
const pitMat=KartPits.build(scene,pitBay,P,T,co);
let qte=null,toastT=0;
const KN={grip:'MEHR GRIP',acc:'MEHR BESCHLEUNIGUNG',top:'MEHR TOPSPEED'};
function toast(txt,c){const e=$('toast');e.textContent=txt;e.style.color=c||'#fff';e.classList.add('on');toastT=2.4}
function giveBuff(k){pl.buff={k,t:8};toast('POWER-UP: '+KN[k],'#6ee58b')}
function giveDebuff(k){if(k==='pit'){if(COMP)return;pl.pit=true;pl.pitT=0;toast(KartPits.label('damage'),'#ff6b6b')}else{pl.debuff={k,t:9};toast(k==='grip'?'DEFEKT: WENIGER GRIP':'DEFEKT: WENIGER SPEED','#ff6b6b')}}
function drawQte(){$('qs').innerHTML=qte.seq.map((n,j)=>`<b class='${j<qte.i?'ok':j===qte.i?'cur':''}'>${n}</b>`).join('');$('qt').textContent='MOTORSCHADEN – Tasten in Reihenfolge drücken!'}
function startMalf(src){if(COMP||qte||pl.pit||pl.fin||state!=='race')return;qte={src,seq:Array.from({length:4},()=>1+Math.floor(Math.random()*4)),i:0,t:5,max:5};$('redtint').classList.add('on');$('qte').classList.add('on');drawQte();toast('MOTORSCHADEN!','#ff6b6b')}
function endQte(){qte=null;$('redtint').classList.remove('on');$('qte').classList.remove('on')}
function qteKey(n){if(!qte)return;if(n===qte.seq[qte.i]){qte.i++;if(qte.i>=qte.seq.length){const cube=qte.src==='cube';endQte();toast(cube?'REPARIERT! Gegner drehen sich!':'REPARIERT!','#6ee58b');if(cube)spinOthers();return}}else qte.i=0;drawQte()}
document.querySelectorAll('#qk button').forEach(b=>b.addEventListener('pointerdown',e=>{qteKey(+b.dataset.q);e.preventDefault()},options));
$('wstyle').textContent=WSTYLES[WSTYLE]+' ▸';
$('wstyle').onclick=()=>{WSTYLE=(WSTYLE+1)%3;try{KartStorage.setItem('kart-wheel',WSTYLE)}catch(e){}$('wstyle').textContent=WSTYLES[WSTYLE]+' ▸';const sg=playerMesh.userData.steerG;while(sg.children.length)sg.remove(sg.children[0]);sg.add(makeWheel(WSTYLE));cockpit?.setWheel(WSTYLE)};
// ===== Online-Gegner, Spin-Angriff, Item-Sync =====
const rem=new Map(),r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;let netT=0;
function nameTag(txt){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.font='bold 34px Arial';g.textAlign='center';g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,8,256,48);g.fillStyle='#fff';g.fillText(txt.slice(0,20),128,44);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(3.2,.8,1);s.renderOrder=5;return s}
function netTake(b){if(!NET)return;NET.tk.push([b.id,b.gen]);if(NET.tk.length>8)NET.tk.shift()}
function spinSelf(t){if(pl.spin>0||pl.fin)return;pl.spin=pl.spinT0=t;pl.spinDir=Math.sign(pl.steer||1);pl.dc=0;pl.drift=0;toast('GETROFFEN – DREHER!','#ffd24a')}
function spinOthers(){for(const a of ai)if(a.spin<=0)a.spin=1.8;if(NET){NET.spinCnt++;NET.room.presence({sp:NET.spinCnt}).catch(()=>{})}}
// ===== Interaktive Items: Ölpfütze und Rakete, Ergebnistafel =====
const oils=[],oilSeen=new Set(),oilGeo=new THREE.CylinderGeometry(2.1,2.1,.04,24),oilMat=new THREE.MeshStandardMaterial({color:0x0b0b0c,roughness:.15,metalness:.6,transparent:true,opacity:.9});
function dropOil(x,z,y,mine){const m=new THREE.Mesh(oilGeo,oilMat);m.position.set(x,y+.13,z);m.receiveShadow=true;scene.add(m);oils.push({x,z,y,t:30,arm:mine?1.2:0,mesh:m});
  if(mine&&NET){NET.oil.push([r1(x),r1(z),r1(y),NET.oilN++]);if(NET.oil.length>4)NET.oil.shift()}}
function giveItem(k){pl.held=k;toast('ITEM: '+(k==='oil'?'ÖLPFÜTZE':'RAKETE')+' – Item-Taste drücken','#9fd4ff')}
function useItem(){if(!pl.held||state!=='race'||pl.fin||pl.spin>0)return;const k=pl.held;pl.held=null;
  if(k==='oil'){dropOil(pl.x-Math.sin(pl.h)*2.6,pl.z-Math.cos(pl.h)*2.6,pl.y||0,true);toast('ÖLPFÜTZE GELEGT','#9fd4ff')}else fireRocket()}
function fireRocket(){let best=null,bd=1e9;const cand=[];for(const a of ai)cand.push({p:a.s,a});for(const [id,q] of rem)cand.push({p:q.tt,id,q});
  for(const c of cand){const d=c.p-pl.total,s=d>0?d:1e6-d;if(s<bd){bd=s;best=c}}
  if(!best){toast('Kein Ziel!','#ff6b6b');return}
  if(best.a){if(botMaster()){if(best.a.spin<=0)best.a.spin=1.8;}else{NET.bhit={i:ai.indexOf(best.a),n:++NET.bhitN}};toast('RAKETE TRIFFT!','#ffd24a')}
  else{NET.hitN++;NET.hit={to:best.id,n:NET.hitN};toast('RAKETE → '+best.q.nm,'#ffd24a')}}
function board(){
  const rows=[{n:NET.name,ft:pl.ft||0,f:pl.fin||0}];
  for(const p of NET.room.peers()){
    if(p.isMe)continue;
    const d=p.presence;
    rows.push({n:d.nm||'Fahrer',ft:d.ft||0,f:d.fin||0,back:d.racing===false});
  }
  for(let i=0;i<ai.length;i++)rows.push({n:'Bot '+(i+1),ft:ai[i].ft||0,f:ai[i].ft?1:0});
  const fin=rows.filter(r=>r.f).sort((a,b)=>a.ft-b.ft),rest=rows.filter(r=>!r.f);
  return fin.map((r,i)=>(i+1)+'. '+r.n+'  '+fmt(r.ft))
    .concat(rest.map(r=>'– '+r.n+(r.back?'  in der Lobby':'  fährt…'))).join('\n');
}
function netTick(dt){
  if(!NET)return;
  netT+=dt;
  if(netT>=.06&&!NET.spectator){netT=0;NET.room.presence({...botMaster()?{botState:KartBots.packet(ai)}:{},bhit:NET.bhit,visualCategory:NET.driverClass,pc:paintColor(),skin:KartSeason.skin(SAVE.kartSkin),kartModel:SAVE.kartModel,car:SAVE.car,x:r2(pl.x),z:r2(pl.z),y:r2(pl.y||0),pitch:r2(pl.pitch||0),roll:r2(pl.roll||0),h:r2(pl.h),v:r1(pl.vF),st:r2(pl.steer),br:keys.down?1:0,tt:Math.round(pl.total),fin:pl.fin||0,ft:r2(pl.ft||0),oil:NET.oil,hit:NET.hit,sp:NET.spinCnt,tk:NET.tk,ws:WSTYLE,nm:NET.name}).catch(()=>{})}
  const seen=new Set();
  for(const p of NET.room.peers()){
    if(!p.isMe&&p.peer===KartBots.authority(NET.room.peers(),NET.order)&&!botMaster())KartBots.apply(ai,p.presence.botState);
    if(p.isMe||p.kind!=='viewer'||!p.presence||!['x','y','z','h'].every(k=>Number.isFinite(p.presence[k]))||p.presence.racing===false)continue;
    seen.add(p.peer);const d=p.presence;let q=rem.get(p.peer);
    if(!q){const ci=Math.max(0,NET.order.indexOf(p.peer));q={mesh:makeKart(Number.isInteger(d.pc)&&d.pc>=0&&d.pc<=0xffffff?d.pc:colors[ci%8],(d.ws|0)%3,scene,d.visualCategory==='kart'?'kart':d.visualCategory==='gt3'?'gt3':CATEGORY,d.car,d.skin,d.kartModel),sp:d.sp|0,x:d.x,z:d.z,y:d.y,h:d.h,v:0,tt:0,fin:0,ci,tag:nameTag(String(d.nm||'Fahrer'))};if(KartTuningStats.active({competitive:COMP,online:true,allowed:NET.upgradesAllowed})){const id=KartTuning.id(d.visualCategory||CATEGORY,d.car,d.kartModel||'original');KartTuningVisuals.attach(q.mesh,id,KartTuningStats.clean(d.tuning,KartTuning.all().map(c=>c.id))[id]||{})}q.tag.position.set(0,2.4,0);q.mesh.add(q.tag);rem.set(p.peer,q)}
    if(q.mesh.userData.paints&&q.mesh.userData.skin!==d.skin)KartModels.setSkin(q.mesh,d.skin);
    const pose=KartRace.remotePose(q,d,dt);if(!pose)continue;Object.assign(q,pose);
    q.v=d.v||0;q.tt=d.tt||0;q.fin=d.fin||0;q.ft=d.ft||0;q.nm=String(d.nm||'Fahrer').slice(0,20);q.mesh.position.set(q.x,q.y,q.z);q.mesh.rotation.y=q.h;
    if(q.idx===undefined){let bi=0,bq=1e12;for(let i=0;i<N;i++){const ex=q.x-P[i].x,ez=q.z-P[i].z,qq=ex*ex+ez*ez+4*((q.y||0)-P[i].y)**2;if(qq<bq){bq=qq;bi=i}}q.idx=bi}else q.idx=nearest(q.x,q.z,q.idx,NW,q.y);
    {q.mesh.rotation.x=-q.pitch;q.mesh.rotation.z=q.roll;}
    const u=q.mesh.userData,st=d.st||0;u.wheels.forEach(w=>w.rotation.x+=q.v*dt/.3);u.steerG.rotation.z=-st*1.6;u.pivots.forEach(pp=>pp.rotation.y=st*.45);u.tl.emissive.setHex(d.br?0xff1010:0);
    if((d.sp|0)>q.sp){q.sp=d.sp|0;spinSelf(1.8);if(botMaster())for(const a of ai)if(a.spin<=0)a.spin=1.8}
    if(d.bhit&&(d.bhit.n|0)>(q.bhn|0)){q.bhn=d.bhit.n|0;if(botMaster()&&ai[d.bhit.i])ai[d.bhit.i].spin=1.8}
    if(d.hit&&d.hit.to===NET.me&&(d.hit.n|0)>(q.hn|0)){q.hn=d.hit.n|0;spinSelf(1.8);toast('Getroffen von '+q.nm,'#ff6b6b')}
    for(const e of d.oil||[]){const key=p.peer+':'+e[3];if(!oilSeen.has(key)){oilSeen.add(key);dropOil(e[0],e[1],e[2],false)}}
    for(const t of d.tk||[]){const b=boxes[t[0]];if(b&&t[1]>b.gen){b.gen=t[1];b.on=false;b.mesh.visible=false;b.wait=5+Math.random()*4}}
  }
  for(const [id,q] of rem)if(!seen.has(id)){scene.remove(q.mesh);rem.delete(id)}
  if(NET.spectator)return;
  // Kollision mit echten Mitspielern: Impuls auf das eigene Kart
  for(const q of rem.values()){const dx=pl.x-q.x,dz=pl.z-q.z,dd=Math.hypot(dx,dz);
    if(dd<2.2&&dd>.01&&Math.abs((pl.y||0)-q.y)<2.5){const nx=dx/dd,nz=dz/dd,fx=Math.sin(pl.h),fz=Math.cos(pl.h),bvx=Math.sin(q.h)*q.v,bvz=Math.cos(q.h)*q.v,vr=(pl.vx-bvx)*nx+(pl.vz-bvz)*nz;
      pl.x+=nx*(2.2-dd)*.6;pl.z+=nz*(2.2-dd)*.6;
      if(vr<0){const j=.65*-vr;pl.vx+=j*nx;pl.vz+=j*nz;pl.h+=(nx*fz-nz*fx)*j*.01}}}
}
function botItems(dt){
 if(!BOT_ITEMS||!botMaster()||!['race','done'].includes(state))return;
 for(const a of ai){if(!a.held||a.spin>0||a.s>=LAPS*N)continue;a.itemDelay-=dt;if(a.itemDelay>0)continue;
  const item=a.held;if(!KartDriving.useful(a,item,botTraffic(),seg,KAP[((Math.floor(a.s)%N)+N)%N]))continue;a.held=null;
  if(item==='oil'){dropOil(a.x-Math.sin(a.h)*3.5,a.z-Math.cos(a.h)*3.5,a.y||0,!!NET);const o=oils[oils.length-1];o.arm=1.2;o.owner=a}
  else if(item==='rocket'){
   let target=null,dist=Infinity;
   for(const b of [pl,...ai,...rem.values()]){if(b===a||b.spin>0||b.fin||b.ft)continue;const ds=((b===pl?pl.total:b.s??b.tt)-a.s)*seg;
    if(ds>0&&ds<65&&ds<dist&&Math.hypot(b.x-a.x,b.z-a.z)<65&&Math.abs((b.y||0)-(a.y||0))<3){target=b;dist=ds}}
   if(target===pl){spinSelf(1.5);toast('RAKETE TRIFFT!','#ff6b6b')}else if(target&&ai.includes(target))target.spin=1.5;else if(target&&NET){const entry=[...rem].find(([,q])=>q===target);if(entry)NET.hit={to:entry[0],n:++NET.hitN}}
  }else{a.fxK=true;a.fxT=5}
 }
}
function items(dt){
  botItems(dt);
  const go=state==='race'&&!NET?.spectator;
if(keys.item){keys.item=0;useItem()}
  for(let i=oils.length-1;i>=0;i--){const o=oils[i];o.t-=dt;o.arm-=dt;let hit=false;
    if(o.arm<=0&&state==='race'&&!(pl.spin>0)&&!pl.fin&&Math.hypot(pl.x-o.x,pl.z-o.z)<2.3&&Math.abs((pl.y||0)-o.y)<2){spinSelf(1.4);pl.vx*=.7;pl.vz*=.7;toast('ÖLPFÜTZE!','#9fd4ff');hit=true}
    else if(botMaster())for(const a of ai)if(o.arm<=0&&a!==o.owner&&a.spin<=0&&a.x!==undefined&&Math.abs((a.y||0)-o.y)<2&&Math.hypot(a.x-o.x,a.z-o.z)<2.3){a.spin=1.2;hit=true;break}
    if(hit)o.t=Math.min(o.t,.4);if(o.t<=0){scene.remove(o.mesh);oils.splice(i,1)}}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').classList.remove('on')}
  boxes.forEach((b,i)=>{
    if(b.on){b.mesh.rotation.y+=dt*1.6;b.mesh.rotation.x=.35;b.mesh.position.y=b.y+Math.sin(raceT*2.2+i)*.15;
      if(go&&!pl.fin&&Math.hypot(pl.x-b.x,pl.z-b.z)<2.1&&Math.abs((pl.y||0)+.8-b.y)<2.4){b.on=false;b.mesh.visible=false;b.wait=5+Math.random()*4;b.gen++;netTake(b);RS.boxes++;
        const r=Math.random();if(r<.35)giveBuff(['grip','acc','top'][Math.floor(Math.random()*3)]);else if(r<.65)giveItem(Math.random()<.5?'oil':'rocket');else startMalf('cube')}
      else if(go&&BOT_ITEMS&&botMaster()){for(const a of ai){if(!a.held&&Math.hypot(a.x-b.x,a.z-b.z)<2.1&&Math.abs((a.y||0)+.8-b.y)<2.4){b.on=false;b.mesh.visible=false;b.wait=5+Math.random()*4;b.gen++;netTake(b);if(!a.pit&&Math.random()<.16){a.pit=true;a.pitT=0}else a.held=['boost','oil','rocket'][Math.floor(Math.random()*3)];a.itemDelay=1.5+Math.random()*2;break}}}
    }else{b.wait-=dt;if(b.wait<=0)placeBox(b)}});
  if(pl.buff){pl.buff.t-=dt;if(pl.buff.t<=0)pl.buff=null}
  if(pl.debuff){pl.debuff.t-=dt;if(pl.debuff.t<=0)pl.debuff=null}
  if(qte){qte.t-=dt;$('qbar').style.width=Math.max(0,qte.t/qte.max*100)+'%';if(qte.t<=0){endQte();giveDebuff('pit')}}
  if(KartPits.step(pl,pitBay,dt,go&&!pl.fin)){toast(KartPits.label('fixed'),'#6ee58b')}
  pitMat.opacity=pl.pit?.35+.25*Math.sin(raceT*8):.18;
  const L=['<span data-no-translate style=\'color:#9fd4ff\'>'+(COMP?({de:'KOMPETITIV',en:'COMPETITIVE',fr:'COMPÉTITIF'}[document.documentElement.lang]||'KOMPETITIV'):'LUCKYBLOCK')+'</span>'];
  if(pl.held)L.push(`<span style='color:#9fd4ff'>★ ITEM: ${pl.held==='oil'?'ÖLPFÜTZE':'RAKETE'} (Item-Taste)</span>`);
  if(pl.buff)L.push(`<span style='color:#6ee58b'>▲ ${KN[pl.buff.k]} ${pl.buff.t.toFixed(1)}s</span>`);
  if(pl.debuff)L.push(`<span style='color:#ff7b72'>▼ ${pl.debuff.k==='grip'?'WENIGER GRIP':'WENIGER SPEED'} ${pl.debuff.t.toFixed(1)}s</span>`);
  if(pl.pit)L.push(`<span data-no-translate style='color:#ffd24a'>${KartPits.label('pit')} · ${pl.pitT>0?(5-pl.pitT).toFixed(1)+' s':KartPits.label('stop')}</span>`);
  $('fx').innerHTML=L.join('<br>')}
function crash(t){if(pl.spin>0)return;pl.spin=pl.spinT0=t;pl.dc=0;pl.drift=0;pl.spinDir=Math.sign(pl.steer||pl.vL||1);if(state==='race')$('msg').textContent='CRASH!';startMalf('crash')}
const KR=GT3?1.04:1.1,KO=GT3?1.05:.8,hitO={nx:0,nz:0,si:0,k:0};
// Aufprall an der Planke: Normalanteil mit wenig Rückprall, Reibung entlang der Wand,
// bei streifendem Kontakt dreht das Kart parallel zur Wand statt an ihr kleben zu bleiben.
function wallResp(o){const nx=o.nx,nz=o.nz,vn=pl.vx*nx+pl.vz*nz;if(vn>=0)return;
  const imp=-vn,tx=-nz,tz=nx;let vt=pl.vx*tx+pl.vz*tz;
  vt-=Math.sign(vt)*Math.min(Math.abs(vt),.2*imp);const e=imp>8?.3:.1;
  pl.vx=tx*vt+nx*imp*e;pl.vz=tz*vt+nz*imp*e;
  const fx=Math.sin(pl.h),fz=Math.cos(pl.h),sd=Math.sign(fx*tx+fz*tz)||1,ux=tx*sd,uz=tz*sd,da=Math.atan2(fz*ux-fx*uz,fx*ux+fz*uz);
  if(Math.abs(da)<1.25)pl.h+=da*Math.min(.6,imp*.05+.05); // auch beim Entlangschrammen langsam parallel drehen
  if(imp>6){pl.drift=0;pl.dc=0}
  if(state!=='race')return;
  if(imp>11&&!MP.indoor&&!COMP){breakBars(Math.floor(o.k/BSTEP)%NB*2+o.si,pl.vx,pl.vz,imp);pl.vx*=.85;pl.vz*=.85}
  if(imp*CAR_STATS.damage>16)crash((1.2+imp*.02)*CAR_STATS.damage)}
function update(dt){
  const go=(state==='race'||state==='done')&&!NET?.spectator;
  // Spieler
  const ctl=go&&!pl.fin&&!(pl.spin>0);
  const throttle=ctl?keys.up:0,brake=ctl?keys.down:0,dKey=!!(ctl&&keys.drift);
  const tgt=((keys.left?1:0)-(keys.right?1:0))*(ctl?1:0);
  pl.steer+=(tgt-pl.steer)*Math.min(1,CAR_STATS.steering*dt);
  const off=Math.abs(pl.lat||0)>W/2+K&&!pitBay.contains(pl.idx,pl.lat||0);
  pl.draft=draft(pl.x,pl.z,pl.h,pl);if(state==='race'&&pl.draft>.15)RS.draftT+=dt;
  const gb=pl.buff&&pl.buff.k,db=pl.debuff&&pl.debuff.k,gripM=(gb==='grip'?1.3:1)*(db==='grip'?.7:1),accM=(gb==='acc'?1.9:1)*(db==='speed'?.7:1)*(pl.pit?.45:1),topA=gb==='top'?8:0,topM=(db==='speed'?.78:1)*(pl.pit?.55:1);
  let sp=Math.hypot(pl.vx,pl.vz);
  const servicing=pl.pit&&pitBay.contains(pl.idx,pl.lat||0,true)&&sp<.6&&!throttle&&!brake;
  // Drift: Taste drücken, Richtung = Lenkrichtung (kurz danach noch wählbar), Heck rutscht seitlich weg.
  // Halten + Lenken lädt den Mini-Turbo (3 Stufen), Loslassen zündet ihn.
  if(dKey&&!pl.dPrev&&sp>8){pl.dWin=.3;pl.drift=0;pl.dc=0}
  pl.dPrev=dKey;
  if(dKey&&!pl.drift&&pl.dWin>0){pl.dWin-=dt;if(Math.abs(pl.steer)>.3&&pl.vF>8){pl.drift=Math.sign(pl.steer);pl.dc=0}}
  if(pl.drift&&(!dKey||pl.vF<6)){const tier=pl.dc>2.8?3:pl.dc>1.7?2:pl.dc>.8?1:0;
    if(tier&&ctl){pl.bT=[0,.7,1.2,1.9][tier];pl.bTier=tier;if(tier===3&&state==='race')RS.t3++}pl.drift=0;pl.dc=0}
  if(pl.drift&&sp>10)pl.dc+=dt*(.8+.9*Math.max(0,pl.steer*pl.drift));
  if(pl.bT>0)pl.bT-=dt;
  const vmax=((off?CAR_STATS.offSpeed:CAR_STATS.topSpeed)+pl.draft*5+(pl.bT>0?6+2*pl.bTier:0)+topA)*topM;
  // Reifen-Seitenhaftung (m/s²): hoch genug für direkte Lenkung, auf Gras/Schnee weniger
  const latG=CAR_STATS.grip*MP.grip*gripM*(off?MP.off*CAR_STATS.terrainGrip:1+CAR_STATS.downforce*Math.min(1,(sp/CAR_STATS.topSpeed)**2));
  liveValues={speed:pl.vF,maxSpeed:vmax,acceleration:KartTuningStats.acceleration(CAR_STATS,pl.vF)*accM+pl.draft*8,handling:latG};
  if(pl.spin>0){pl.spin-=dt;if(pl.spin<=0&&state==='race')$('msg').textContent=''}
  const nSub=NET?.spectator?0:Math.min(8,Math.max(1,Math.ceil(sp*dt/.35))),h=nSub?dt/nSub:0;
  let lapEvent=0;
  for(let st=0;st<nSub;st++){
    let fx=Math.sin(pl.h),fz=Math.cos(pl.h);
    let vF=pl.vx*fx+pl.vz*fz,vL=pl.vx*-fz+pl.vz*fx;sp=Math.hypot(vF,vL);
    vF=KartRace.speed(vF,h,{throttle,brake,acceleration:KartTuningStats.acceleration(CAR_STATS,vF)*accM+pl.draft*8,vmax,draft:pl.draft,boost:pl.bT>0&&!off?9+4*pl.bTier:0,braking:CAR_STATS.braking,slope:go&&!servicing?pl.slope:0});
    let yaw,latF;
    if(pl.spin>0){yaw=pl.spinDir*(4*Math.PI/pl.spinT0)*clamp(pl.spin/pl.spinT0,.15,1);latF=latG*.3}
    else if(pl.drift){const sl=pl.steer*pl.drift,beta=Math.atan2(vL,Math.max(vF,1));latF=latG*(.8+.35*sl);
      yaw=pl.drift*latF/Math.max(sp,6)+4*(pl.drift*(.48+.2*sl)-beta)}
    else{yaw=pl.steer*Math.min(CAR_STATS.yaw,latG/Math.max(sp,1))*clamp(sp/4,0,1)*(vF<-.5?-1:1);if(brake&&sp>12)yaw*=1.15;latF=latG*1.05*CAR_STATS.stability}
    const wx=fx*vF-fz*vL,wz=fz*vF+fx*vL;
    pl.h+=yaw*h;fx=Math.sin(pl.h);fz=Math.cos(pl.h);
    vF=wx*fx+wz*fz;vL=wx*-fz+wz*fx;
    vL-=Math.sign(vL)*Math.min(Math.abs(vL),latF*h); // Seitenführung richtet die Bahn am Kart aus
    vF-=Math.sign(vF)*Math.min(Math.abs(vF),Math.abs(vL)*(pl.drift?.15:.25)*h); // Rutschen kostet Tempo
    if(pl.spin>0){const k=Math.exp(-1.5*h);vF*=k;vL*=k}
    if(servicing){vF=0;vL=0}
    pl.vx=fx*vF-fz*vL;pl.vz=fz*vF+fx*vL;
    pl.x+=pl.vx*h;pl.z+=pl.vz*h;
    // Streckenposition
    const ni=nearest(pl.x,pl.z,pl.idx,Math.max(3,Math.ceil((sp*h+2)/seg)),pl.y);pl.idx=ni;
    // Planken-Hitbox: zwei Kreise (vorne/hinten) gegen die sichtbare Planken-Linie
    for(let it=0;it<2;it++)for(const sgn of[1,-1]){const cx=pl.x+fx*KO*sgn,cz=pl.z+fz*KO*sgn,pen=wallHit(cx,cz,pl.idx,KR,hitO);
      if(pen>0){pl.x+=hitO.nx*pen;pl.z+=hitO.nz*pen;wallResp(hitO);fx=Math.sin(pl.h);fz=Math.cos(pl.h)}}
    const c=P[pl.idx],t=T[pl.idx];pl.lat=(pl.x-c.x)*t.z+(pl.z-c.z)*-t.x;
    // Sicherheitsnetz: falls das Kart doch hinter der Planke landet, zurück auf die Strecke
    const sg=Math.sign(pl.lat)||1,lim=Math.abs(boundary(pl.idx,sg*BW));
    if(Math.abs(pl.lat)>lim+.5){const ex=Math.abs(pl.lat)-(lim-KR),nx=-t.z*sg,nz=t.x*sg;pl.x+=nx*ex;pl.z+=nz*ex;pl.lat=sg*(lim-KR);lapGuard.invalidate();const vn=pl.vx*nx+pl.vz*nz;if(vn<0){pl.vx-=vn*nx;pl.vz-=vn*nz}}
    if(go&&!pl.fin){const p=P[pl.idx],t=T[pl.idx],fraction=clamp(((pl.x-p.x)*t.x+(pl.z-p.z)*t.z)/seg,-.5,.5),position={x:pl.x,y:roadY(pl.x,pl.z,pl.idx),z:pl.z};const mark=lapGuard.step(pl.idx+fraction,position,h,raceT,Math.abs(pl.lat)<=W/2+K+.6||pitBay.contains(pl.idx,pl.lat),GT3?96:68);const progress=raceProgress.step(pl.idx+fraction,position,h,Math.max(GT3?96:68,vmax+2));pl.total=progress.total;pl.completedLaps=progress.laps;pl.lapT=mark.lapTime;if(mark.completed)lapEvent=mark.completed;}
  }
  {const fx=Math.sin(pl.h),fz=Math.cos(pl.h);pl.vF=pl.vx*fx+pl.vz*fz;pl.vL=pl.vx*-fz+pl.vz*fx;sp=Math.hypot(pl.vx,pl.vz);liveValues.speed=pl.vF;
   const ni=pl.idx,c=P[ni],t=T[ni],gr=groundAt(pl.x,pl.z,ni,pl.h);pl.y=gr.y;pl.pitch=gr.pitch;pl.roll=gr.roll;
   pl.slope=(P[(ni+4)%N].y-c.y)/(4*seg)*(fx*t.x+fz*t.z)}
  if(lapEvent>=KartRace.minLap(MAPID,CATEGORY,COMP?'competitive':'luckyblock')&&(!pl.best||lapEvent<pl.best))pl.best=lapEvent;
  if(RECORD_ELIGIBLE&&lapEvent>=KartRace.minLap(MAPID,CATEGORY,COMP?'competitive':'luckyblock'))window.KartAccount?.queueLap((COMP?'competitive':'luckyblock')+':'+CAR_ID+':'+MAPID,Math.round(lapEvent*1000)/1000,rankingSeason);
  if(go&&!pl.fin&&pl.completedLaps>=LAPS){pl.fin=rank();pl.ft=raceT;state='done';showResults()}
  // KI: Streckenprofil (bremst vor Kurven), Ideallinie, Überholen, Windschatten, seltene Dreher
  const master=botMaster(),grid=[pl,...ai,...[...rem.values()].map(q=>({...q,s:q.tt,o:0}))];
  for(const a of ai){
    const i=((Math.floor(a.s)%N)+N)%N,k=KS[i],cn=Math.abs(KS[(i+LB)%N]),wl=Math.min(4.2,W/2-1.3);
    if(master)a.brk=false;
    if(go&&master&&!a.ft){
      a.draft=a.level==='hard'?draft(a.x||0,a.z||0,a.h||0,a):0;if(a.fxT>0)a.fxT-=dt;
      const plan=KartDriving.plan(a,{N,seg,width:W,K:KAP,profiles:botProfiles,traffic:botTraffic(),time:raceT,gt3:NET?NET.category==='gt3':GT3,bay:pitBay});if(NET){const standard=KartBots.roomStats(NET.category);plan.acceleration=standard.acceleration;plan.brake=standard.braking;plan.speed=Math.min(plan.speed,standard.topSpeed)}const want=plan.offset;
      if(a.spin<=0&&cn>.12&&a.v>20&&Math.random()<plan.mistake*dt)a.spin=1.8;
      if(a.spin>0){a.spin=Math.max(0,a.spin-dt);a.v*=Math.exp(-1.5*dt);a.brk=true}
      else{const dv=clamp(plan.speed-a.v,-plan.brake*dt,plan.acceleration*Math.max(.1,1-a.v/((NET?NET.category==='gt3':GT3)?68:40))*dt);a.v+=dv;a.brk=dv<-4*dt;a.o+=clamp(want-a.o,-plan.lateral*dt,plan.lateral*dt)}
      if(a.pit){const d=pitBay.distance(a.s);if(d<=pitBay.centre&&d+a.v*dt>=pitBay.centre){a.s+=(pitBay.centre-d)/seg;a.v=0}const proxy={pit:true,pitT:a.pitT,idx:((Math.round(a.s)%N)+N)%N,lat:a.o,vx:a.v,vz:0};if(KartPits.step(proxy,pitBay,dt,true)){a.pit=false;a.pitExit=true}a.pitT=proxy.pitT;}
      a.s+=a.v*dt/seg;if(a.s>=LAPS*N&&!a.pit){a.s=LAPS*N;a.ft=Math.max(.001,NET?(NET.now()-NET.startAt)/1000-.6:raceT);a.v=0}}
    if(master){
    a.sp=a.spin>0?(1.8-a.spin)*(4*Math.PI/1.8):0;
    // KI bleibt innerhalb der Planken (auch auf der Innenseite enger Haarnadeln)
    {const j=((Math.floor(a.s)%N)+N)%N,oL=boundary(j,BW)-KR-.1,oR=boundary(j,-BW)+KR+.1;a.o+=a.ov*dt;if(a.o>oL||a.o<oR){a.o=clamp(a.o,oR,oL);a.ov=0}}
    a.ov*=Math.exp(-2.2*dt);a.kick*=Math.exp(-3*dt);}
    const q=trackAt(a.s),x=q.x+q.tz*a.o,z=q.z-q.tx*a.o,ag=groundAt(x,z,((Math.round(a.s)%N)+N)%N,Math.atan2(q.tx,q.tz)),ay=ag.y;
    a.h=Math.atan2(q.tx,q.tz);
    a.y=ay;a.mesh.position.set(x,ay,z);a.mesh.rotation.y=a.h+a.sp+a.kick;a.mesh.rotation.x=-ag.pitch;a.mesh.rotation.z=ag.roll||0;a.x=x;a.z=z;
    const bu=a.mesh.userData;bu.wheels.forEach(w=>w.rotation.x+=a.v*dt/.3);bu.tl.emissive.setHex(a.brk?0xff1010:0);bu.steerG.rotation.z=-clamp(k*6,-1,1)*1.6;
    if(a.ft)continue;
    const dx=pl.x-x,dz=pl.z-z,dd=Math.hypot(dx,dz);
    if(!NET?.spectator&&dd<2.2&&dd>.01&&Math.abs(a.y-pl.y)<2.5){const nx=dx/dd,nz=dz/dd,sx=q.tz,sz=-q.tx,fx=Math.sin(pl.h),fz=Math.cos(pl.h),pvx=pl.vx,pvz=pl.vz,bvx=q.tx*a.v+sx*a.ov,bvz=q.tz*a.v+sz*a.ov,vr=(pvx-bvx)*nx+(pvz-bvz)*nz;
      pl.x+=nx*(2.2-dd)*.6;pl.z+=nz*(2.2-dd)*.6;if(master)a.o-=(nx*sx+nz*sz)*(2.2-dd)*.4;
      if(vr<0){const j=.65*-vr,bvx2=bvx-j*nx,bvz2=bvz-j*nz,tq=nx*fz-nz*fx;
        pl.vx=pvx+j*nx;pl.vz=pvz+j*nz;if(master){a.v=Math.max(0,bvx2*q.tx+bvz2*q.tz);a.ov=bvx2*sx+bvz2*sz;a.kick=clamp(a.kick+tq*j*.03,-.5,.5)}pl.h+=tq*j*.01}
      }
  }
  // KI untereinander: nicht ineinander fahren
  if(master)for(let m=0;m<ai.length;m++)for(let n2=m+1;n2<ai.length;n2++){const A=ai[m],B=ai[n2];let ds=(B.s-A.s)%N;if(ds>N/2)ds-=N;if(ds<-N/2)ds+=N;ds*=seg;
    const dO=B.o-A.o;if(Math.abs(ds)<2.6&&Math.abs(dO)<2){const push=(2-Math.abs(dO))*.5*(dO>=0?1:-1);A.o-=push*.5;B.o+=push*.5;
      if(ds>0&&A.v>B.v)A.v=B.v*.98+A.v*.02;else if(ds<0&&B.v>A.v)B.v=A.v*.98+B.v*.02}}
  // Mesh Spieler
  playerMesh.position.set(pl.x,pl.y||0,pl.z);playerMesh.rotation.y=pl.h;playerMesh.rotation.x=-pl.pitch;playerMesh.rotation.z=pl.roll||0;
  const ud=playerMesh.userData;ud.body.rotation.z=clamp(-pl.vL*.008-pl.steer*sp*.001,-.1,.1);ud.body.rotation.y=0;
  // beim Driften zeigen die Vorderräder leicht gegen (Gegenlenken)
  const wSt=pl.drift?clamp(pl.steer*.3-pl.drift*.35,-1,1):pl.steer;
  ud.tl.emissive.setHex(brake?0xff1010:0);ud.steerG.rotation.z=-wSt*1.6;ud.pivots.forEach(p=>p.rotation.y=wSt*.45);tireFx(dt,brake);
  cockpit?.update(pl.vF,wSt,raceT);
  if(NET?.spectator){const candidates=[...[...rem.entries()].map(([id,q])=>({id,name:q.nm||id,car:q})),...ai.map((a,i)=>({id:'bot:'+i,name:'Bot '+(i+1),car:a}))],selected=candidates.find(c=>c.id===spectatorSelect.value)||candidates[0];if(candidates.map(c=>c.id).join()!==spectatorSelect.dataset.roster){spectatorSelect.replaceChildren(...candidates.map(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;return o}));spectatorSelect.dataset.roster=candidates.map(c=>c.id).join();if(selected)spectatorSelect.value=selected.id}if(selected&&['x','y','z','h','v'].every(k=>Number.isFinite(selected.car[k]))){const q=selected.car;spectatorSnap=spectatorFollow!==selected.id||Math.hypot(pl.x-q.x,pl.z-q.z)>60;spectatorFollow=selected.id;if(spectatorSnap)pl.camH=q.h;pl.vx=Math.sin(q.h)*q.v;pl.vz=Math.cos(q.h)*q.v;pl.vL=0;sp=Math.abs(q.v);pl.x=q.x;pl.z=q.z;pl.y=q.y;pl.h=q.h;pl.vF=q.v;pl.idx=q.idx??((Math.floor(q.s)%N)+N)%N;pl.total=q.tt??q.s;playerMesh.position.set(pl.x,pl.y,pl.z);playerMesh.rotation.y=pl.h}playerMesh.visible=false;}
  // Kamera
  // Kamera schaut zwischen Kart-Richtung und Fahrtrichtung -> Drift-Winkel bleibt sichtbar
  const slip=sp>3&&!(pl.spin>0)?Math.atan2(pl.vL,Math.max(Math.abs(pl.vF),1)):0,camT=pl.h-slip*.6;
  let dh=((camT-pl.camH+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;pl.camH+=dh*(1-Math.exp(-5*dt));
  const cf={x:Math.sin(pl.camH),z:Math.cos(pl.camH)},dist=7+sp*.05;
  let want,look;
  if(cameraMode===0){
    want=new THREE.Vector3(pl.x-cf.x*dist,pl.y+3.1+sp*.012,pl.z-cf.z*dist);
    look=new THREE.Vector3(pl.x+cf.x*5,pl.y+1.1,pl.z+cf.z*5);
  }else if(cameraMode===3){
    const dn=3.6+sp*.02;
    want=new THREE.Vector3(pl.x-cf.x*dn,pl.y+1.75+sp*.006,pl.z-cf.z*dn);
    look=new THREE.Vector3(pl.x+cf.x*6,pl.y+.9,pl.z+cf.z*6);
  }else if(cameraMode===1){
    playerMesh.updateMatrixWorld(true);want=playerMesh.localToWorld(new THREE.Vector3(0,GT3?1.02:1.12,GT3?1.65:.55));
    look=playerMesh.localToWorld(new THREE.Vector3(0,.2,18));
  }else{
    playerMesh.updateMatrixWorld(true);want=playerMesh.localToWorld(new THREE.Vector3(GT3?-.34:0,GT3?1.24:1.33,GT3?-.48:-.26));
    look=playerMesh.localToWorld(new THREE.Vector3(GT3?-.34:0,GT3?1.02:-.1,18));
  }
  if(chaseCam()){if(spectatorSnap){cam.position.copy(want);spectatorSnap=false}cam.position.lerp(want,1-Math.exp(-(cameraMode===3?14:9)*dt));
    // Kamera-Schutz: nicht unter die Fahrbahn, in der Halle nicht durch Wände oder Decke
    const ci=nearest(cam.position.x,cam.position.z,pl.idx,NW,pl.y),cp=P[ci],ct=T[ci];cam.position.y=Math.max(cam.position.y,cp.y+1.1,pl.y+(cameraMode===3?1.2:1.6));
    if(MP.indoor){const lat=(cam.position.x-cp.x)*ct.z+(cam.position.z-cp.z)*-ct.x,sg=Math.sign(lat)||1,lim=Math.abs(boundary(ci,sg*BW))-.3;
      if(Math.abs(lat)>lim){const ex=Math.abs(lat)-lim;cam.position.x-=ct.z*sg*ex;cam.position.z+=ct.x*sg*ex}
      cam.position.y=Math.min(cam.position.y,cp.y+4.6-.45)}
  }else cam.position.copy(want);cam.near=cameraMode===0?1:cameraMode===3?.3:GT3&&cameraMode===2?.035:.2;
  cam.lookAt(look);
  cam.fov+=((GT3&&cameraMode===2?64+Math.min(6,sp*.08):60+sp*.45+pl.draft*5+(pl.bT>0?8:0))-cam.fov)*Math.min(1,4*dt);cam.updateProjectionMatrix();
  sun.position.set(pl.x+60,pl.y+90,pl.z+40);sun.target.position.set(pl.x,pl.y,pl.z);if(lamp)lamp.position.set(pl.x,pl.y+3.2,pl.z);
  if(gn){osc.frequency.value=55+sp*6+(throttle?20:0);gn.gain.value=(paused||document.hidden?0:state==='done'?.01:.03)*soundLevel()}
}
// Zieleinlauf: echte Werte dieses Rennens, Belohnung wird einmal gutgeschrieben
function showResults(){if(resultsShown)return;resultsShown=true;window.kartActiveTrack=null;window.kartHeartbeat?.();const n=NET?NET.order.length+ai.length:1+ai.length+rem.size,r=finishRace({tuned:!RECORD_ELIGIBLE,map:MAPID,category:CATEGORY,car:GT3?playerMesh.userData.car:playerMesh.userData.recordCar,mode:COMP?'competitive':'luckyblock',place:pl.fin,n,laps:LAPS,best:pl.best,rs:RS});
  if(NET)NET.room.presence({fin:pl.fin,ft:pl.ft}).catch(()=>{});
  $('msg').textContent='';$('sub').textContent='';$('help').style.display='none';
  $('resTitle').textContent=pl.fin===1?'Sieg!':'Zieleinlauf';
  $('resBody').innerHTML='<div class="res-place pop">'+ic(pl.fin<=3?'trophy':'flag')+'<b>P'+pl.fin+'</b><span class="sticker '+(pl.fin===1?'y':'b')+'">von '+n+'</span></div>'
   +'<div class="res-stats"><div><small>Gesamtzeit</small><b>'+fmt(pl.ft)+'</b></div><div><small>Beste Runde</small><b>'+(pl.best?fmt(pl.best):'–')+'</b></div><div><small>Münzen</small><b class="coin-inline">'+ic('coin')+'+'+r.coins+'</b></div><div><small>XP</small><b>+'+r.xp+'</b></div></div>'
   +(r.ev?'<p class="note">Strecke der Woche: doppelte Münzen!</p>':'')+(r.newBest?'<p><span class="sticker y pop">Neue Bestzeit!</span></p>':'')+(r.lv1>r.lv0?'<p><span class="sticker p pop">Level '+r.lv1+' erreicht!</span></p>':'')+(r.ready?'<p class="note">'+r.ready+' Missions-Belohnung(en) im Menü bereit.</p>':'')
   +(NET?'<p class="label">Ergebnis</p><div class="res-board" id="resBoard">'+esc(board())+'</div>':'');
  $('resAgain').hidden=!!NET;$('resAgain').onclick=restartRace;$('resMenu').onclick=toMenu;
  $('resMenu').querySelector('b').textContent=NET?'Zur Lobby':'Menü';
  $('results').hidden=false;
  focusTimer=setTimeout(()=>($('resAgain').hidden?$('resMenu'):$('resAgain')).focus(),50);
  if(NET)resultTimer=setTimeout(toMenu,7000);
}
function rank(){
  let r=1;
  for(const a of ai)if(a.ft||a.s>pl.total)r++;
  if(NET)for(const p of NET.room.peers()){
    if(!p.isMe&&(p.presence.fin||(p.presence.racing!==false&&p.presence.tt>pl.total)))r++;
  }
  return r;
}

$('tl').innerHTML='<span data-hud="lap"></span><span data-hud="time"></span><span data-hud="best"></span>';
const hudFields=Object.fromEntries([...$('tl').children].map(e=>[e.dataset.hud,e]));
const hudWords={de:['Lap','Zeit','Beste'],en:['Lap','Time','Best'],fr:['Tour','Temps','Meilleur']};
function hud(){
  const lap=clamp((pl.completedLaps||0)+1,1,LAPS);
  const labels=hudWords[document.documentElement.lang]||hudWords.de;
  const values={lap:labels[0]+' '+lap+'/'+LAPS,time:labels[1]+' '+fmt(pl.lapT).replace('.',':'),best:labels[2]+' '+(pl.best?fmt(pl.best).replace('.',':'):'…')};
  for(const key in values)if(hudFields[key].textContent!==values[key])hudFields[key].textContent=values[key];
  $('tr').textContent='P'+(pl.fin||rank())+'/'+(NET?NET.order.length+ai.length:1+ai.length+rem.size);
  const tier=pl.dc>2.8?3:pl.dc>1.7?2:pl.dc>.8?1:0,dr=$('dr');
  dr.textContent=pl.bT>0?'MINI-TURBO '+['','I','II','III'][pl.bTier]+'!':pl.drift?'DRIFT '+'▮'.repeat(tier)+'▯'.repeat(3-tier):pl.draft>.15?'WINDSCHATTEN '+'▮'.repeat(Math.ceil(pl.draft*5)):'';
  dr.style.color=pl.bT>0?'#ffd24a':pl.drift?['#cfe9ff','#5ee1ff','#ff9b3d','#d77bff'][tier]:'#5ee1ff';
  if(MP.corners?.length){const f=pl.idx/N;let nm=MP.corners[MP.corners.length-1][1];for(const c of MP.corners)if(f>=c[0])nm=c[1];const y=(P[pl.idx].y-P[0].y);$('sec').textContent=nm+'  ·  '+(y>=0?'+':'')+y.toFixed(0)+' m'}
  $('sp').innerHTML=`${Math.round(Math.abs(pl.vF)*3.6)}<small>km/h</small><span class="speed-debug" data-no-translate>Speed ${pl.vF.toFixed(2)} m/s · Max ${CAR_STATS.topSpeed.toFixed(2)} m/s</span>`;
  rearIndicator.update(pl,[...ai,...rem.values()],!NET?.spectator&&PREF.rearIndicator&&state==='race'&&!paused&&!pl.fin);
  telemetry.update(liveValues,!NET?.spectator&&!paused&&!pl.fin);
  drawMinimap();
}
let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
for(const q of P){minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minZ=Math.min(minZ,q.z);maxZ=Math.max(maxZ,q.z)}
function drawMinimap(){
  const cv=$('minimap'),g=cv.getContext('2d'),w=cv.width,h=cv.height,cx=w/2,cy=h/2,pad=38;
  g.clearRect(0,0,w,h);
  // Rotate the whole circuit with the current camera heading.
  const scale=(Math.min(w,h)-2*pad)/Math.hypot(maxX-minX||1,maxZ-minZ||1),view=cam.getWorldDirection(new THREE.Vector3()),angle=Math.atan2(view.x,view.z)-Math.PI,cs=Math.cos(angle),sn=Math.sin(angle);
  const point=q=>{const x=(q.x-(minX+maxX)/2)*scale,z=(q.z-(minZ+maxZ)/2)*scale;return{x:cx+x*cs-z*sn,y:cy+x*sn+z*cs}};
  g.lineCap='round';g.lineJoin='round';g.beginPath();
  P.forEach((q,i)=>{const a=point(q);if(i===0)g.moveTo(a.x,a.y);else g.lineTo(a.x,a.y)});
  g.closePath();g.strokeStyle='#111820';g.lineWidth=17;g.stroke();
  g.strokeStyle='#d7dce2';g.lineWidth=10;g.stroke();
  g.strokeStyle='#707b88';g.lineWidth=1.5;g.setLineDash([5,7]);g.stroke();
  g.setLineDash([]);
  const start=point(P[0]),st=T[0],mark=Math.atan2(-st.x,st.z)+angle;g.save();g.translate(start.x,start.y);g.rotate(mark);g.fillStyle='#111820';g.fillRect(-14,-6,28,12);for(let x=0;x<6;x++)for(let y=0;y<2;y++){g.fillStyle=(x+y)%2?'#18212d':'#fff';g.fillRect(-12+x*4,-4+y*4,4,4)}g.restore();
  // Gegnerpunkte und Spielerpfeil
  for(let i=0;i<ai.length;i++){const a=point({x:ai[i].x,z:ai[i].z});g.beginPath();g.arc(a.x,a.y,8,0,Math.PI*2);g.fillStyle=['#ff625d','#ffc84a','#6ee58b'][i%3];g.fill();g.strokeStyle='#101820';g.lineWidth=2;g.stroke()}
  for(const b of boxes)if(b.on){const a=point(b);g.fillStyle='#ffd24a';g.fillRect(a.x-4,a.y-4,8,8)}
  for(const q of rem.values()){const a=point(q);g.beginPath();g.arc(a.x,a.y,8,0,6.3);g.fillStyle='#'+new THREE.Color(colors[q.ci%8]).getHexString();g.fill();g.strokeStyle='#101820';g.lineWidth=2;g.stroke()}
  const me=point(pl);g.save();g.translate(me.x,me.y);g.rotate(Math.PI-pl.h+angle);g.beginPath();g.moveTo(0,-13);g.lineTo(9,10);g.lineTo(0,6);g.lineTo(-9,10);g.closePath();g.fillStyle='#53dcff';g.fill();g.strokeStyle='#fff';g.lineWidth=2;g.stroke();g.restore();
  g.fillStyle='#fff';g.font='bold 16px Arial';g.textAlign='center';if(!NET?.spectator)g.fillText(({de:'DU',en:'YOU',fr:'TOI'})[document.documentElement.lang]||'DU',cx,h-12);
}

let last=performance.now();
function loop(now){
  const raw=now-last,dt=Math.max(0,Math.min(raw/1000,.05));last=now;
  if(paused&&!NET){t0+=raw;qualityRender(renderer,scene,cam);raceFrame=requestAnimationFrame(loop);return}
  if(state==='waiting'&&NET.startAt){state='count';readyView?.close()}
  if(state==='count'){const c=NET?(NET.startAt-NET.now())/1000:3-(now-t0)/1000;
    if(c<=-.6){state='race';$('msg').textContent='';$('sub').textContent=''}
    else{$('msg').textContent=c>3?'':c>0?Math.ceil(c):'LOS!'}}
  if(state==='race')raceT+=dt; // gleicher Frame wie die Rundenzeit -> Gesamtzeit = Summe der Runden
  update(dt);netTick(dt);items(dt);hud();if(flying.length)flyBars(dt);if(snowP)fall(dt);if(winterTracks)winterTracks.update(dt,[playerMesh,...ai.map(b=>b.mesh),...[...rem.values()].map(b=>b.mesh)].filter(Boolean));
  if(state==='done'&&NET&&$('resBoard'))$('resBoard').textContent=board();
  qualityRender(renderer,scene,cam);if(readyView&&!readyRendered&&scene.userData.sceneryRequest?.ready&&!scene.userData.sceneryRequest?.grassLoading&&!renderer._experimentalLoading){readyRendered=true;readyView.loaded()}raceFrame=requestAnimationFrame(loop)}
stopRace=()=>{
  stopRace=null;window.kartActiveTrack=null;window.kartHeartbeat?.();
  spectatorSelect.remove();for(const id of ['tl','tr','camera'])$(id).style.display='';exitDialog.remove();$('reset').disabled=false;readyView?.close();rearIndicator.dispose();telemetry.dispose();if(window.KartRaceDebug===debug)delete window.KartRaceDebug;window.kartAudioPaused=false;applyMusic();inputs.abort();cancelAnimationFrame(raceFrame);
  clearTimeout(resultTimer);clearTimeout(focusTimer);
  if(ac)ac.close().catch(()=>{});
  disposeTrackScenery(scene);disposeRaceScene(scene);graphicsRenderers.delete(renderer);disposeQuality(renderer);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  for(const id of ['gear','camera','home','tomenu','resAgain','resMenu','wstyle'])$(id).onclick=null;
  $('results').hidden=true;
  $('panel').classList.remove('on');
  for(const id of ['qte','redtint','toast'])$(id).classList.remove('on');
  for(const id of ['msg','sub','fx'])$(id).textContent='';
  $('help').style.display='';
  rebind=null;
};
if(job)job.dispose=null;window.kartActiveTrack=MAPID;window.kartHeartbeat?.();raceFrame=requestAnimationFrame(loop);}
// ===================== LOBBY / HOMEPAGE =====================
// ---- Icons (eine Quelle für alle Piktogramme; Duotone mit Navy-Kontur, Glanz-Icons für Belohnungen) ----
const NAVY='#171329';
function gearPath(cx,cy,r1,r2,n){let d='';for(let i=0;i<n*2;i++){const a0=i/(n*2)*Math.PI*2,a1=(i+1)/(n*2)*Math.PI*2,r=i%2?r1:r2;d+=(i?'L':'M')+(cx+Math.cos(a0+.08)*r).toFixed(1)+' '+(cy+Math.sin(a0+.08)*r).toFixed(1)+'L'+(cx+Math.cos(a1-.08)*r).toFixed(1)+' '+(cy+Math.sin(a1-.08)*r).toFixed(1)}return d+'Z'}
const ICONS={
 copy:'<rect x="7" y="8" width="25" height="28" rx="4" fill="#c9c2e8"/><rect x="16" y="16" width="25" height="27" rx="4" fill="#fff"/>',
 flag:'<path d="M11 44V5" stroke-width="4"/><path d="M13 7h27l-5 8.5 5 8.5H13z" fill="#fff"/><path d="M13 7h7v8.5h-7zM27 7h7v8.5h-7zM20 15.5h7V24h-7zM34 15.5h1l-1 .8z" fill="'+NAVY+'" stroke="none"/><path d="M13 7h27l-5 8.5 5 8.5H13z"/>',
 helmet:'<path d="M5 31C5 19 13 9 25 9c10 0 18 7 18 16v7a5 5 0 0 1-5 5H11a6 6 0 0 1-6-6z" fill="#FF453A"/><path d="M21 21h20a2 2 0 0 1 2 2v7H24a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2z" fill="'+NAVY+'"/><path d="M24 24h12" stroke="#5ec8ff" stroke-width="3"/><path d="M7 33h30" stroke="#fff" stroke-width="3"/><path d="M13 14c3-2 6-3 9-3" stroke="#fff" stroke-width="3" opacity=".7"/>',
 bolt:'<path d="M28 3 9 27h13l-4 18 21-26H26z" fill="#FFCB05"/>',
 globe:'<circle cx="24" cy="24" r="19" fill="#12A8FF"/><path d="M5 24h38M24 5c7 6 7 32 0 38M24 5c-7 6-7 32 0 38M9 14h30M9 34h30" stroke-width="2.5"/><circle cx="24" cy="24" r="19"/><path d="M15 11c3-2 6-3 9-3" stroke="#fff" stroke-width="3" opacity=".6"/>',
 track:'<rect x="4" y="9" width="40" height="30" rx="15" fill="#2d6b3a"/><path d="M13 31c-6 0-6-14 1-14h7c3 0 4-5 8-5h5c6 0 6 19-2 19z" fill="none" stroke="#fff" stroke-width="4"/><path d="M13 31c-6 0-6-14 1-14h7c3 0 4-5 8-5h5c6 0 6 19-2 19z" fill="none" stroke="'+NAVY+'" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M30 37v-9" stroke-width="2.5"/><path d="M30 28h8l-2 2.5 2 2.5h-8z" fill="#fff"/>',
 wrench:'<path d="M31 5a10 10 0 0 0-9.4 13.4L6.8 33.2a4.5 4.5 0 0 0 6.4 6.4L28 24.8A10 10 0 0 0 42.5 14l-6.2 6.2-5.7-1.5-1.5-5.7L35.3 6.8A10 10 0 0 0 31 5z" fill="#eef1f8"/><circle cx="10" cy="36.5" r="1.8" fill="'+NAVY+'"/>',
 bag:'<path d="M8 17h32l-3 25H11z" fill="#fff"/><path d="M8 17h32l-1 8H9z" fill="#FF453A"/><path d="M17 20v-6a7 7 0 0 1 14 0v6"/><path d="M8 17h32l-3 25H11z"/>',
 list:'<rect x="9" y="7" width="30" height="36" rx="4" fill="#fff"/><rect x="17" y="4" width="14" height="7" rx="2" fill="#FFCB05"/><path d="M15 20l3 3 5-6M15 31l3 3 5-6" stroke="#2fa64a" stroke-width="3.5"/><path d="M27 21h7M27 32h7"/>',
 trophy:'<path d="M15 6h18v12a9 9 0 0 1-18 0z" fill="url(#gGold)"/><path d="M15 9H8c0 7 3 10 8 11M33 9h7c0 7-3 10-8 11" fill="none"/><path d="M20 27h8l1 7h-10z" fill="url(#gGold)"/><rect x="13" y="34" width="22" height="8" rx="2" fill="#8C42F5"/><path d="M19 10c0 4 1 7 3 9" stroke="#fff" stroke-width="2.5" opacity=".8"/>',
 friends:'<circle cx="17" cy="16" r="7" fill="#FFCB05"/><path d="M4 40c0-8 6-13 13-13s13 5 13 13z" fill="#FFCB05"/><circle cx="32" cy="18" r="6" fill="#8BE342"/><path d="M24 40c1-7 4-11 9-11 6 0 11 4 11 11z" fill="#8BE342"/>',
 gift:'<rect x="6" y="18" width="36" height="9" rx="2" fill="url(#gGift)"/><rect x="9" y="27" width="30" height="16" rx="2" fill="url(#gGift)"/><path d="M24 18v25" stroke="#FFCB05" stroke-width="6"/><path d="M24 18v25"/><path d="M24 18c-3-8-13-10-12-3 1 4 8 3 12 3zM24 18c3-8 13-10 12-3-1 4-8 3-12 3z" fill="#FFCB05"/><path d="M11 21h6" stroke="#fff" stroke-width="2.5" opacity=".7"/>',
 star:'<path d="M24 4l5.9 12.6 13.6 1.6-10 9.4 2.6 13.5L24 34.4l-12.1 6.7 2.6-13.5-10-9.4 13.6-1.6z" fill="url(#gGold)"/><path d="M19 15l2-4" stroke="#fff" stroke-width="3" opacity=".8"/>',
 crown:'<path d="M5 15l9 8 10-15 10 15 9-8-4 24H9z" fill="url(#gGold)"/><path d="M9 39h30" stroke-width="3"/><circle cx="24" cy="29" r="3" fill="#FF453A"/><circle cx="14" cy="31" r="2" fill="#12A8FF"/><circle cx="34" cy="31" r="2" fill="#12A8FF"/>',
 gear:'<path d="'+gearPath(24,24,19,14.5,8)+'" fill="#c9cfe0"/><circle cx="24" cy="24" r="6" fill="#332a5c"/>',
 coin:'<circle cx="24" cy="24" r="19" fill="url(#gCoin)"/><circle cx="24" cy="24" r="13" fill="none" stroke="#C98A00" stroke-width="2.5"/><path d="M24 15l2.6 5.6 6 .7-4.5 4.1 1.2 6L24 28.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#FFF4B0" stroke="#C98A00" stroke-width="2"/><circle cx="24" cy="24" r="19"/><path d="M13 16c2-3 5-5 9-6" stroke="#fff" stroke-width="3" opacity=".9"/>',
 plus:'<path d="M24 10v28M10 24h28" stroke="#fff" stroke-width="6"/>',
 close:'<path d="M13 13l22 22M35 13L13 35" stroke="#fff" stroke-width="6"/>',
 back:'<path d="M28 10 14 24l14 14" stroke="#fff" stroke-width="6"/>',
 home:'<path d="M7 23 24 8l17 15" stroke="#fff" stroke-width="5"/><path d="M12 21v18h9v-10h6v10h9V21" fill="#FFCB05"/>',
 lock:'<rect x="10" y="21" width="28" height="21" rx="4" fill="#FFCB05"/><path d="M16 21v-6a8 8 0 0 1 16 0v6" fill="none" stroke-width="4"/><circle cx="24" cy="31" r="3" fill="'+NAVY+'"/>',
 check:'<circle cx="24" cy="24" r="19" fill="#8BE342"/><path d="M15 25l6 6 12-13" stroke="'+NAVY+'" stroke-width="5"/>',
 palette:'<path d="M24 5C13 5 5 13 5 23c0 9 7 15 13 15 3 0 4-2 4-4 0-3 2-4 5-4h5c6 0 11-4 11-10C43 12 35 5 24 5z" fill="#fff"/><circle cx="15" cy="20" r="3.5" fill="#FF453A"/><circle cx="23" cy="13" r="3.5" fill="#FFCB05"/><circle cx="32" cy="15" r="3.5" fill="#12A8FF"/><circle cx="35" cy="24" r="3.5" fill="#8BE342"/>',
 info:'<circle cx="24" cy="24" r="19" fill="#12A8FF"/><path d="M24 22v12" stroke="#fff" stroke-width="5"/><circle cx="24" cy="15" r="3" fill="#fff" stroke="none"/>',
 user:'<circle cx="24" cy="16" r="9" fill="#12A8FF"/><path d="M7 42c0-9 8-15 17-15s17 6 17 15z" fill="#12A8FF"/>',
};
function ic(n,cls){return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="'+NAVY+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+(ICONS[n]||'')+'</svg>'}
function fillIcons(root){(root||document).querySelectorAll('[data-ic]').forEach(e=>{if(!e.firstChild)e.innerHTML=ic(e.dataset.ic)})}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---- Spielstand: Konto-Server; lokale Speicherung nur in eigenständigen file://-Kopien ----
const PAINTS=[{n:'Stahlblau',c:0x4f7d96,p:0},{n:'Rennrot',c:0xc8302a,p:0},{n:'Turbo-Gelb',c:0xe5b30e,p:150},{n:'Limette',c:0x6fbf3a,p:150},{n:'Neon-Lila',c:0x8c42f5,p:250},{n:'Elektroblau',c:0x12a8ff,p:250},{n:'Feuerorange',c:0xe8661c,p:300},{n:'Mitternacht',c:0x2a2f52,p:400,lv:3},{n:'Bonbon-Pink',c:0xe04b8f,p:400,lv:5},{n:'Gold-Edition',c:0xd8a531,p:800,lv:8}];
const TRACKS=['circuit','snow','indoor','spa','monaco','monza','nurburgring','shanghai','switchback','hairpin'];
const TINFO={circuit:{d:'Klassischer Rundkurs bei Sonne, viel Grip',t:'Original'},snow:{d:'Schneepiste mit Hügeln und wenig Grip',t:'Original'},indoor:{d:'Halle mit engen Wänden und zwei Ebenen',t:'Original'},spa:{d:'Eau Rouge, Kemmel, Stavelot – echtes Höhenprofil',t:'F1'},monaco:{d:'Casino, Haarnadel, Tunnel – eng und hügelig',t:'F1'},monza:{d:'Lange Geraden, Schikanen, Parabolica',t:'F1'}};
Object.assign(TINFO,{nurburgring:{d:'',t:'GP'},shanghai:{d:'',t:'GP'},switchback:{d:'',t:'Karting'},hairpin:{d:'',t:'Karting'}});
const XPL=250,lvlOf=xp=>Math.floor(xp/XPL)+1;
const PROFILE_BACKGROUNDS=[{id:'purple',n:'Violett',p:0,c:'#3b305e',end:'#251d40'},{id:'blue',n:'Ozeanblau',p:250,c:'#176bad',end:'#113456'},{id:'teal',n:'Türkis',p:250,c:'#138779',end:'#113c42'},{id:'red',n:'Rennrot',p:250,c:'#af353e',end:'#512035'},{id:'orange',n:'Sonnenuntergang',p:350,c:'#b96020',end:'#583025'},{id:'midnight',n:'Mitternacht',p:350,c:'#414b61',end:'#141b2c'}];
const PROFILE_ICONS=[{id:'helmet',n:'Rennhelm',p:0},{id:'flag',n:'Zielflagge',p:300},{id:'bolt',n:'Blitz',p:300},{id:'star',n:'Stern',p:350},{id:'trophy',n:'Pokal',p:450},{id:'crown',n:'Krone',p:500}];
const DEF_SAVE={upgradesEnabled:true,upgrades:{},...KartGarage.defaults(),coins:0,xp:0,races:0,wins:0,podiums:0,t3:0,boxes:0,draftT:0,f1:{},claimed:{},pass:{},daily:'',owned:[0,1],paint:0,best:{},track:'circuit',laps:3,comp:false,category:'kart',car:'porsche',ownedCars:['porsche'],profileBackground:'purple',profileIcon:'helmet',ownedProfileBackgrounds:['purple'],ownedProfileIcons:['helmet'],botCount:3,botDifficulty:'normal',botDifficulties:Array(6).fill('normal'),mpBotCount:0,mpBotItems:false,mpBotCars:['porsche','amg','ferrari','porsche','amg','ferrari'],mpBotDifficulties:Array(6).fill('normal'),botItems:false,botCars:['porsche','amg','ferrari','porsche','amg','ferrari'],bestGT3:{},records:{},kartSkin:'original',kartModel:'original',ownedKarts:['original','christmas'],ambient:'default',ownedAmbient:['default'],quickPlay:KartQuick.normalize()};
function loadSave(){const s=JSON.parse(JSON.stringify(DEF_SAVE));try{const o=JSON.parse(KartStorage.getItem('kart-save')||'{}');if(o&&typeof o==='object')for(const k in s){if(typeof o[k]===typeof s[k]&&(typeof s[k]!=='number'||Number.isFinite(o[k])))s[k]=o[k]}if(!Array.isArray(o.botDifficulties))s.botDifficulties=Array(6).fill(o.botDifficulty||'normal');if(!('ownedCars' in o)&&o.car in KartGT3.prices)s.ownedCars=[...new Set(['porsche',o.car])]}catch(e){}
  if(!s.records||typeof s.records!=='object'||Array.isArray(s.records))s.records={};
  if(!Array.isArray(s.owned))s.owned=[0,1];s.owned=s.owned.filter(i=>PAINTS[i]);if(!s.owned.includes(0))s.owned.unshift(0);if(!s.owned.includes(s.paint))s.paint=0;
  for(const [key,owned,list,starter] of [['profileBackground','ownedProfileBackgrounds',PROFILE_BACKGROUNDS,'purple'],['profileIcon','ownedProfileIcons',PROFILE_ICONS,'helmet']]){s[owned]=[...new Set([starter,...(Array.isArray(s[owned])?s[owned]:[]).filter(v=>list.some(x=>x.id===v))])];if(!s[owned].includes(s[key]))s[key]=starter}
  if(!Array.isArray(s.ownedCars))s.ownedCars=['porsche'];s.ownedCars=[...new Set(['porsche',...s.ownedCars.filter(c=>c in KartGT3.prices)])];if(!s.ownedCars.includes(s.car))s.car='porsche';if(!Number.isInteger(s.botCount)||s.botCount<0||s.botCount>6)s.botCount=3;if(!['easy','normal','hard'].includes(s.botDifficulty))s.botDifficulty='normal';if(!Array.isArray(s.botCars)||s.botCars.length!==6)s.botCars=[...DEF_SAVE.botCars];s.botCars=s.botCars.map(c=>KartGT3.valid(c));s.botItems=!!s.botItems;if(!Array.isArray(s.botDifficulties)||s.botDifficulties.length!==6)s.botDifficulties=Array(6).fill(s.botDifficulty);s.botDifficulties=s.botDifficulties.map(v=>['easy','normal','hard'].includes(v)?v:'normal');const mb=KartBots.normalize({count:s.mpBotCount,items:s.mpBotItems,cars:s.mpBotCars,difficulties:s.mpBotDifficulties});s.mpBotCount=mb.count;s.mpBotItems=mb.items;s.mpBotCars=mb.cars;s.mpBotDifficulties=mb.difficulties;
  if(!['kart','gt3'].includes(s.category))s.category='kart';s.car=KartGT3.valid(s.car);if(!MAPS[s.track])s.track='circuit';if(![1,3,5].includes(s.laps))s.laps=3;s.quickPlay=KartQuick.normalize(s.quickPlay);if(!['original','christmas'].includes(s.kartSkin))s.kartSkin='original';s.ownedKarts=[...new Set(['original','christmas',...(Array.isArray(s.ownedKarts)?s.ownedKarts:[]).filter(v=>KartModels.valid(v)===v)])];if(!s.ownedKarts.includes(s.kartModel))s.kartModel='original';if(s.kartSkin==='christmas')s.kartModel='christmas';KartAmbient.normalize(s);KartGarage.normalize(s);s.upgrades=KartTuningStats.clean(s.upgrades,KartTuning.all().map(c=>c.id));return s}
let SAVE=loadSave();
const persist=()=>{try{KartStorage.setItem('kart-save',JSON.stringify(SAVE))}catch(e){}};
const paintColor=()=>KartGarage.paintColor();
const MISSIONS=KartProgression.missions;
const misReady=()=>MISSIONS.filter(m=>!SAVE.claimed[m.id]&&m.v(SAVE)>=m.g);
const PASS=KartProgression.pass;
const passReady=()=>PASS.filter(p=>lvlOf(SAVE.xp)>=p.lv&&!SAVE.pass[p.lv]);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const DAILY=50;
function weekInfo(){return KartQuick.week()}
const eventTrack=()=>weekInfo().track;
const dur=ms=>{const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),ss=s%60;return(d?d+' T ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+(d?'':':'+String(ss).padStart(2,'0'))};
// Belohnung pro Rennen – auch im Ergebnis-Bildschirm so angezeigt
function raceReward(place,n,map,laps){const ev=map===eventTrack(),c=Math.round((20+(n-place)*15+laps*5)*(ev?2:1)),x=40+(n-place)*25+laps*10;return{coins:c,xp:x,ev}}
function finishRace(o){const r=raceReward(o.place,o.n,o.map,o.laps),lv0=lvlOf(SAVE.xp);
  SAVE.coins+=r.coins;SAVE.xp+=r.xp;SAVE.races++;if(o.place===1)SAVE.wins++;if(o.place<=3)SAVE.podiums++;
  if(TINFO[o.map]&&['F1','GP','Karting'].includes(TINFO[o.map].t))SAVE.f1[o.map]=1;SAVE.t3+=o.rs.t3;SAVE.boxes+=o.rs.boxes;SAVE.draftT+=o.rs.draftT;
  const best=o.category==='gt3'?SAVE.bestGT3:SAVE.best;const key=(o.mode||'luckyblock')+':'+(o.car||'kart')+':'+o.map;let nb=false;const minimum=KartRace.minLap(o.map,o.category||'kart',o.mode||'luckyblock');if(!o.tuned&&o.best>=minimum){const seconds=+o.best.toFixed(3);if(!best[o.map]||best[o.map]<minimum||seconds<best[o.map])best[o.map]=seconds;if(!SAVE.records[key]||SAVE.records[key]<minimum||seconds<SAVE.records[key]){SAVE.records[key]=seconds;nb=true}}
  persist();return Object.assign(r,{lv0,lv1:lvlOf(SAVE.xp),newBest:nb,ready:misReady().length})}
const fmtT=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(2).padStart(5,'0')};

// ---- Strecken-Skizze für Karten ----
function trackSvg(id){const M=MAPS[id],S=M.S||1,pts=M.ctrl.map(p=>[p[0]*S,p[1]*S]);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const[x,z]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z)}
  const k=Math.min(180/(x1-x0||1),70/(z1-z0||1)),ox=100-(x0+x1)/2*k,oz=42-(z0+z1)/2*k,d='M'+pts.map(([x,z])=>(x*k+ox).toFixed(1)+' '+(z*k+oz).toFixed(1)).join('L')+'Z',s0=pts[0];
  return '<svg class="map" viewBox="0 0 200 84" aria-hidden="true"><path d="'+d+'" fill="none" stroke="#171329" stroke-width="9" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><circle cx="'+(s0[0]*k+ox).toFixed(1)+'" cy="'+(s0[1]*k+oz).toFixed(1)+'" r="5" fill="#FFCB05" stroke="#171329" stroke-width="2"/></svg>'}

// ---- Lobby: current image and selected kart only ----
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const SR={r:null,scene:null,cam:null,kart:null,raf:0,spin:false,a:-.62};
function showroomStart(){const cv=$('showroom');let r;try{r=new THREE.WebGLRenderer({canvas:cv,antialias:true})}catch(e){cv.style.background='radial-gradient(circle at 40% 45%,#5ab4ff,#1c4f8a 60%,#171329)';return}
 SR.r=r;r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;
 graphicsRenderers.add(r);applyGraphics(r);
 const sc=SR.scene=new THREE.Scene();
 sc.background=new THREE.Color(0x243342);
 SR.cam=new THREE.PerspectiveCamera(30,1,.1,400);SR.cam.position.set(0,3.3,12.8);SR.cam.lookAt(0,1.05,0);
 showroomKart();addEventListener('resize',showroomSize);showroomSize();
 const t0=performance.now();const loop=now=>{SR.raf=requestAnimationFrame(loop);if(!document.body.classList.contains('lobby')||document.querySelector('.tw-dialog[open]'))return;const t=(now-t0)/1000,mv=!RM.matches;
  if(SR.kart){SR.kart.scale.setScalar(podiumStage?1.7:1);SR.kart.position.x=podiumStage?podiumPositions[0][0]:0;SR.kart.position.z=podiumStage?podiumPositions[0][1]:0;if(SR.spin&&mv)SR.a+=.5/60;else if(mv)SR.a+=((-.62+Math.sin(t*.35)*.22)-SR.a)*.03;else SR.a=SR.spin?SR.a:-.62;SR.kart.rotation.y=podiumStage?Math.PI+.18:SR.a;SR.kart.position.y=.5+(mv&&!podiumStage?Math.sin(t*2.2)*.025:0);
   const ud=SR.kart.userData;if(ud.steerG)ud.steerG.rotation.z=mv?Math.sin(t*.8)*.4:0;ud.pivots.forEach(p=>p.rotation.y=mv?Math.sin(t*.8)*-.12:0)}
  qualityRender(r,sc,podiumStage?.camera||SR.cam)};SR.raf=requestAnimationFrame(loop)}
function showroomSize(){if(!SR.r)return;if(podiumStage){sizePodiumStage();return}const w=innerWidth,h=innerHeight,c=SR.cam;SR.r.setSize(w,h);c.aspect=w/h;
  // Kart links von der Mitte (Desktop) bzw. im oberen Drittel (Hochformat), nicht hinter den Buttons
  if(w>760){c.setViewOffset(w,h,w*.09,h*.03,w,h);c.fov=w/h<1.45?36:30}else{c.setViewOffset(w,h,0,h*.10,w,h);c.fov=44}c.updateProjectionMatrix()}
function showroomKart(){if(!SR.scene)return;if(SR.kart){SR.scene.remove(SR.kart);disposeRaceScene(SR.kart)}SR.kart=makeKart(paintColor(),WSTYLE,SR.scene,cur?(cur.room.peers().find(p=>p.isMe)?.presence.driverClass||SAVE.category):SAVE.category,SAVE.car,SAVE.kartSkin,SAVE.kartModel);const sid=KartTuning.id(cur?(cur.room.peers().find(p=>p.isMe)?.presence.driverClass||SAVE.category):SAVE.category);if(!cur||hostPlayer(cur.room.peers())?.presence.upgradesAllowed)KartTuningVisuals.attach(SR.kart,sid,KartTuning.levels(sid));SR.kart.position.y=.5;SR.kart.rotation.y=SR.a;SR.kart.traverse(o=>{if(o.isMesh)o.castShadow=true})}
function showroomStop(){if(SR.raf)cancelAnimationFrame(SR.raf);SR.raf=0;removeEventListener('resize',showroomSize);if(SR.r){releaseSurfaceMaterials(SR.scene);graphicsRenderers.delete(SR.r);disposeQuality(SR.r);SR.r.dispose();SR.r=null}$('showroom').style.display='none'}

// ---- Dialog-System (ein Baustein für alle Panels) ----
let sheetOpener=null,sheetOnClose=null;
function openSheet(o){const w=$('sheetWrap');sheetOpener=document.activeElement;sheetOnClose=o.onClose||null;w.classList.toggle('side',!!o.side);
  $('sheetHead').style.setProperty('--hc',o.color||'var(--blue)');$('sheetIc').innerHTML=ic(o.icon||'info');$('sheetTitle').textContent=o.title;
  const b=$('sheetBody');b.innerHTML='';if(typeof o.body==='string')b.innerHTML=o.body;else b.appendChild(o.body);
  const f=$('sheetFoot');f.innerHTML='';f.hidden=!o.foot;if(o.foot){if(typeof o.foot==='string')f.innerHTML=o.foot;else f.appendChild(o.foot)}
  fillIcons(w);w.hidden=false;const first=w.querySelector('.sheet-body button:not(:disabled),.sheet-body input,.sheet-foot button:not(:disabled)')||$('sheetClose');first.focus({preventScroll:true})}
function closeSheet(){const w=$('sheetWrap');if(w.hidden)return;w.hidden=true;const cb=sheetOnClose;sheetOnClose=null;if(cb)cb();renderLobby();if(sheetOpener&&sheetOpener.focus)sheetOpener.focus({preventScroll:true})}
$('sheetClose').onclick=closeSheet;$('sheetWrap').addEventListener('pointerdown',e=>{if(e.target===$('sheetWrap'))closeSheet()});
const el=(h)=>{const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild};
function flash(txt,color){let t=$('ltoast');if(!t){t=document.createElement('div');t.id='ltoast';t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:40;pointer-events:none';document.body.appendChild(t)}
  t.innerHTML='<span class="sticker pop" style="font-size:22px;padding:8px 18px;background:'+(color||'var(--lime)')+';color:var(--navy)">'+esc(txt)+'</span>';clearTimeout(t._h);t._h=setTimeout(()=>t.innerHTML='',2200)}

// ---- Panels ----
function seg(name,opts,val,color){return '<div class="seg" role="group" aria-label="'+esc(name)+'" style="--c:'+(color||'var(--yellow)')+'">'+opts.map(([v,l])=>'<button type="button" data-v="'+v+'" aria-pressed="'+(String(v)===String(val))+'">'+esc(l)+'</button>').join('')+'</div>'}
function bindSeg(root,sel,cb){const g=root.querySelector(sel);g.querySelectorAll('button').forEach(b=>b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cb(b.dataset.v)})}
function openCustom(tab='custom',draft=null){tab=tab==='quick'?'quick':'custom';const C=tab==='quick'?(draft||KartQuick.normalize(SAVE.quickPlay)):SAVE;const body=el('<div class="race-setup"></div>');
 body.innerHTML='<div id="raceTabs">'+seg('Rennen', [['custom','Eigenes Rennen'],['quick','Quick Play Settings']],tab,'var(--blue)')+'</div>'+ (tab==='quick'?'<p class="label">Tagesstrecke verwenden</p><div id="quickDaily">'+seg('Tagesstrecke verwenden',[[0,'Aus'],[1,'An']],C.useDaily?1:0,'var(--lime)')+'</div>':'')+'<p class="label">Fahrzeugklasse</p><div id="cCategory">'+seg('Fahrzeugklasse',[['kart','Kart'],['gt3','GT3']],C.category,'var(--blue)')+'</div>'
 +'<div class="two"><label class="field"><span class="label">Bots</span><select id="botCount">'+Array.from({length:7},(_,i)=>'<option value="'+i+'"'+(C.botCount===i?' selected':'')+'>'+i+'</option>').join('')+'</select></label><label class="field"><span class="label">Schwierigkeit</span><select id="botDifficulty"'+(!C.botCount?' disabled':'')+'>'+[['easy','Leicht'],['normal','Normal'],['hard','Schwer']].map(([v,n])=>'<option value="'+v+'"'+(C.botDifficulty===v?' selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'
 +'<p class="label">Bot-Items</p><div id="botItems">'+seg('Bot-Items',[[0,'Aus'],[1,'An']],(C.botItems&&!C.comp)?1:0,'var(--lime)')+'</div><div id="botCars" class="bot-cars">'+Array.from({length:C.botCount},(_,i)=>'<div class="field"><span class="label">Bot '+(i+1)+'</span><label>Fahrzeug<select data-bot-car="'+i+'"'+(C.category==='gt3'?'':' disabled')+'>'+(C.category==='gt3'?KartGT3.cars.map(([id,n])=>'<option value="'+id+'"'+(C.botCars[i]===id?' selected':'')+'>'+n+'</option>').join(''):'<option>Kart</option>')+'</select></label><label>Schwierigkeit<select aria-label="Schwierigkeit" data-bot-difficulty="'+i+'">'+[['easy','Leicht'],['normal','Normal'],['hard','Schwer']].map(([v,n])=>'<option value="'+v+'"'+(C.botDifficulties[i]===v?' selected':'')+'>'+n+'</option>').join('')+'</select></label></div>').join('')+'</div>'
 +'<p class="label">Modus</p><div id="cMode">'+seg('Modus',[['f','Luckyblock'],['c','Kompetitiv']],C.comp?'c':'f','var(--yellow)')+'</div><p class="label">Runden</p><div id="cLaps">'+seg('Runden',[[1,'1'],[3,'3'],[5,'5']],C.laps,'var(--lime)')+'</div>'
 +'<label class="pref-row">Upgrades erlaubt<input id="cUpgrades" type="checkbox"'+(C.upgradesEnabled!==false?' checked':'')+'></label><p class="label">Strecke</p><div class="grid-cards" id="cTracks">'+TRACKS.map(id=>'<button type="button" class="card-btn" data-t="'+id+'" aria-pressed="'+(C.track===id)+'">'+trackSvg(id)+'<b>'+esc(MAPNAMES[id])+'</b><small>Bestzeit: '+((C.category==='gt3'?SAVE.bestGT3:SAVE.best)[id]?fmtT((C.category==='gt3'?SAVE.bestGT3:SAVE.best)[id]):'–')+'</small></button>').join('')+'</div>';
 KartTuning.entry(body);
 const store=()=>{if(tab!=='quick')persist()};const refresh=()=>{store();openCustom(tab,tab==='quick'?C:null)};
 bindSeg(body,'#raceTabs',v=>openCustom(v));
 if(tab==='quick'){bindSeg(body,'#quickDaily',v=>{C.useDaily=v==='1';refresh()});body.querySelectorAll('[data-t]').forEach(b=>b.disabled=C.useDaily)}
 body.querySelector('#cUpgrades').onchange=e=>{C.upgradesEnabled=e.target.checked;store()};
 bindSeg(body,'#cCategory',v=>{C.category=v;if(tab==='custom')showroomKart();refresh()});
 body.querySelector('#botCount').onchange=e=>{C.botCount=+e.target.value;refresh()};
 body.querySelector('#botDifficulty').onchange=e=>{C.botDifficulty=e.target.value;C.botDifficulties.fill(e.target.value);refresh()};
 body.querySelectorAll('[data-bot-difficulty]').forEach(e=>e.onchange=()=>{C.botDifficulties[+e.dataset.botDifficulty]=e.value;store()});
 body.querySelectorAll('[data-bot-car]').forEach(e=>e.onchange=()=>{C.botCars[+e.dataset.botCar]=e.value;store()});
 bindSeg(body,'#botItems',v=>{C.botItems=v==='1';store()});body.querySelectorAll('#botItems button').forEach(b=>b.disabled=C.comp||!C.botCount);
 bindSeg(body,'#cMode',v=>{C.comp=v==='c';refresh()});bindSeg(body,'#cLaps',v=>{C.laps=+v;store()});
 body.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{C.track=b.dataset.t;store();body.querySelectorAll('[data-t]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
 const foot=el('<button class="btn btn-primary" type="button" style="--h-primary:84px;width:100%"><span class="bt"><b>Los!</b></span>'+ic('flag')+'</button>');if(tab==='quick'){foot.dataset.noTranslate='';foot.querySelector('b').textContent=({de:'Speichern',en:'Save',fr:'Enregistrer'})[document.documentElement.lang]||'Speichern';foot.onclick=async()=>{foot.disabled=true;SAVE.quickPlay=KartQuick.normalize(C);persist();try{await window.KartAccount?.flush();closeSheet()}catch(e){window.accountError?.(e.code||'network');foot.disabled=false}}}else foot.onclick=()=>launch(C.track);
 openSheet({title:'Eigenes Rennen',icon:'track',color:'var(--blue)',body,foot})}
function paintCard(i,mode){const P=PAINTS[i],own=SAVE.owned.includes(i),lv=lvlOf(SAVE.xp),hex='#'+P.c.toString(16).padStart(6,'0');
  if(mode==='garage'){return '<button type="button" class="card-btn" data-p="'+i+'" aria-pressed="'+(SAVE.paintMode!=='custom'&&SAVE.paint===i)+'"'+(own?'':' disabled')+'><span class="swatch" style="background:'+hex+'"></span><b>'+esc(P.n)+'</b><small>'+(own?(SAVE.paintMode!=='custom'&&SAVE.paint===i?'Ausgerüstet':'Ausrüsten'):'🔒 Im Shop freischalten')+'</small></button>'}
  const need=P.lv&&lv<P.lv,poor=SAVE.coins<P.p,dis=own||need||poor;
  return '<button type="button" class="card-btn" data-buy="'+i+'"'+(dis?' disabled':'')+' aria-label="'+esc(P.n)+(own?' – bereits freigeschaltet':' kaufen für '+P.p+' Münzen')+'"><span class="swatch" style="background:'+hex+'"></span><b>'+esc(P.n)+'</b><small>'+(own?'✓ Freigeschaltet':need?'🔒 Ab Level '+P.lv:'<span class="coin-inline">'+ic('coin')+P.p+'</span>'+(poor?' – zu wenig Münzen':''))+'</small></button>'}
function vehicleCard(id,mode){const kart=id==='kart',name=kart?'Kart · Original':KartGT3.cars.find(c=>c[0]===id)[1],own=kart||SAVE.ownedCars.includes(id),selected=kart?SAVE.category==='kart':SAVE.category==='gt3'&&SAVE.car===id,price=KartGT3.prices[id]||0;
 const image=KartTuning.card(id)+'<img class="vehicle-preview" src="assets/vehicles/previews/'+id+'.webp" alt="" loading="lazy" decoding="async" width="320" height="180">';
 if(mode==='garage')return '<button type="button" class="card-btn vehicle-card" data-car="'+id+'" aria-pressed="'+selected+'"'+(own?'':' disabled')+'>'+image+'<b>'+esc(name)+'</b><small>'+(own?(selected?'Ausgerüstet':'Ausrüsten'):'Im Shop freischalten')+'</small></button>';
 return '<button type="button" class="card-btn vehicle-card" data-buy-car="'+id+'"'+(own||SAVE.coins<price?' disabled':'')+'>'+image+'<b>'+esc(name)+'</b><small>'+(own?'Freigeschaltet':'<span class="coin-inline">'+ic('coin')+price+'</span>')+'</small></button>';
}
let vehiclePurchasePending=false;
async function buyVehicle(id){if(vehiclePurchasePending||SAVE.ownedCars.includes(id)||!(id in KartGT3.prices))return;vehiclePurchasePending=true;const oldInert=$('menu').inert;$('menu').inert=true;$('sheetClose').disabled=true;
 try{if(window.KartAccount){await KartAccount.buyCar(id)}else{if(SAVE.coins<KartGT3.prices[id])throw {code:'coins'};SAVE.coins-=KartGT3.prices[id];SAVE.ownedCars.push(id);persist()}renderLobby();flash('Freigeschaltet','var(--lime)')}
 catch(e){flash(e.code==='coins'?'Zu wenig Münzen':e.code==='conflict'?'Bitte lade die Seite neu.':'Kauf fehlgeschlagen. Bitte erneut versuchen.','var(--red)')}
 finally{vehiclePurchasePending=false;$('menu').inert=oldInert;$('sheetClose').disabled=false}
}
function openGarage(){KartGarage.open()}
function profileCard(kind,item){const background=kind==='background',owned=background?SAVE.ownedProfileBackgrounds:SAVE.ownedProfileIcons,selected=(background?SAVE.profileBackground:SAVE.profileIcon)===item.id,own=owned.includes(item.id),bg=background?item:PROFILE_BACKGROUNDS.find(x=>x.id===SAVE.profileBackground),icon=background?SAVE.profileIcon:item.id;
 return '<button type="button" class="card-btn profile-card" data-cosmetic="'+item.id+'" data-kind="'+kind+'" aria-pressed="'+selected+'"'+(!own&&SAVE.coins<item.p?' disabled':'')+'><span class="profile-sample" style="background:linear-gradient(125deg,'+bg.c+','+bg.end+')">'+ic(icon)+'<span class="sample-lines"><i></i><i></i></span></span><b>'+item.n+'</b><small>'+(selected?'Ausgerüstet':own?'Ausrüsten':'<span class="coin-inline">'+ic('coin')+item.p+'</span>')+'</small></button>';
}
async function chooseCosmetic(kind,id){if(vehiclePurchasePending)return;const background=kind==='background',list=background?PROFILE_BACKGROUNDS:PROFILE_ICONS,owned=background?'ownedProfileBackgrounds':'ownedProfileIcons',key=background?'profileBackground':'profileIcon',item=list.find(x=>x.id===id);if(!item)return;
 if(!SAVE[owned].includes(id)){vehiclePurchasePending=true;const inert=$('menu').inert;$('menu').inert=true;$('sheetClose').disabled=true;
  try{if(window.KartAccount)await KartAccount.buyCosmetic(kind,id);else{if(SAVE.coins<item.p)throw {code:'coins'};SAVE.coins-=item.p;SAVE[owned].push(id);persist()}}
  catch(e){flash(e.code==='coins'?'Zu wenig Münzen':e.code==='conflict'?'Bitte lade die Seite neu.':'Kauf fehlgeschlagen. Bitte erneut versuchen.','var(--red)');return}
  finally{vehiclePurchasePending=false;$('menu').inert=inert;$('sheetClose').disabled=false}
 }
 SAVE[key]=id;persist();renderLobby();if(window.KartAccount)try{await KartAccount.flush()}catch{flash('Bitte lade die Seite neu.','var(--red)')}
}
function openShop(){const body=el('<div style="display:flex;flex-direction:column;gap:14px"></div>');let tab='cars';
 const draw=()=>{body.innerHTML='<div class="shop-balance coin-inline">'+ic('coin')+SAVE.coins+'</div><div id="shopTabs">'+seg('Shop',[['cars','Fahrzeuge'],['paint','Lackierung'],['profile','Profil'],['ambient','Ambient']],tab,'var(--blue)')+'</div>'+(tab==='cars'?'<div class="vehicle-grid">'+KartModels.models.filter(m=>!m.seasonal||KartSeason.active()).map(m=>kartDesignCard(m,'shop')).join('')+KartGT3.cars.map(c=>vehicleCard(c[0],'shop')).join('')+'</div>':tab==='paint'?'<div class="grid-cards" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">'+PAINTS.map((_,i)=>paintCard(i,'shop')).join('')+KartGarage.shopCard()+'</div>':tab==='ambient'?KartAmbient.cards(SAVE):'<p class="label">Profil-Hintergründe</p><div class="vehicle-grid">'+PROFILE_BACKGROUNDS.map(x=>profileCard('background',x)).join('')+'</div><p class="label">Profil-Icons</p><div class="vehicle-grid">'+PROFILE_ICONS.map(x=>profileCard('icon',x)).join('')+'</div>');
 bindSeg(body,'#shopTabs',v=>{tab=v;draw()});
 const tool=body.querySelector('[data-buy-tool]');if(tool)tool.onclick=async()=>{body.querySelectorAll('button').forEach(b=>b.disabled=true);await KartGarage.buy();draw()};
 body.querySelectorAll('[data-buy-kart]').forEach(b=>b.onclick=async()=>{body.querySelectorAll('button').forEach(x=>x.disabled=true);await buyKartDesign(b.dataset.buyKart);draw()});
 body.querySelectorAll('[data-ambient]').forEach(b=>b.onclick=async()=>{body.querySelectorAll('button').forEach(x=>x.disabled=true);await KartAmbient.choose(b.dataset.ambient);draw()});
 body.querySelectorAll('[data-buy-car]').forEach(b=>b.onclick=async()=>{body.querySelectorAll('button').forEach(x=>x.disabled=true);await buyVehicle(b.dataset.buyCar);draw()});
 body.querySelectorAll('[data-cosmetic]').forEach(b=>b.onclick=async()=>{body.querySelectorAll('button').forEach(x=>x.disabled=true);await chooseCosmetic(b.dataset.kind,b.dataset.cosmetic);draw()});
 body.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const i=+b.dataset.buy,P=PAINTS[i];if(SAVE.owned.includes(i)||SAVE.coins<P.p||(P.lv&&lvlOf(SAVE.xp)<P.lv))return;SAVE.coins-=P.p;SAVE.owned.push(i);SAVE.paint=i;SAVE.paintMode='preset';persist();showroomKart();renderLobby();flash(P.n+' freigeschaltet!');draw()})};draw();
 const foot=el('<button class="btn btn-small" type="button" style="--c:var(--lime);width:100%"><span class="bt"><b>Garage</b></span>'+ic('wrench')+'</button>');foot.onclick=()=>{if(vehiclePurchasePending)return;closeSheet();openGarage()};openSheet({title:'Shop',icon:'bag',color:'var(--red)',body,foot})}
function openMissions(){let filter='open';const labels=({de:['Offen','Abgeholt','Alle'],en:['Open','Claimed','All'],fr:['À faire','Récupérées','Toutes']})[document.documentElement.lang]||['Offen','Abgeholt','Alle'];const body=el('<div style="display:flex;flex-direction:column;gap:10px"></div>');
  const draw=()=>{body.innerHTML='<div id="missionTabs">'+seg('Missionen',[['open',labels[0]],['done',labels[1]],['all',labels[2]]],filter)+'</div>'+MISSIONS.filter(m=>filter==='all'||(filter==='done'?SAVE.claimed[m.id]:!SAVE.claimed[m.id])).map(m=>{const v=Math.min(m.g,m.v(SAVE)),done=SAVE.claimed[m.id],ready=!done&&v>=m.g;
     return '<div class="rowi'+(done?' done':'')+'">'+ic(m.i)+'<div class="txt"><b>'+esc(m.t)+'</b><small>'+esc(m.d)+' · '+v+' / '+m.g+'</small><div class="prog" role="progressbar" aria-label="'+esc(m.t)+'" aria-valuemin="0" aria-valuemax="'+m.g+'" aria-valuenow="'+v+'"><i style="width:'+(v/m.g*100)+'%"></i></div></div>'
      +(done?'<span class="sticker l">✓ Abgeholt</span>':'<button class="btn btn-small" type="button" data-c="'+m.id+'"'+(ready?'':' disabled')+' style="color:var(--navy)" aria-label="'+esc(m.t)+': '+m.r+' Münzen abholen"><span class="bt"><b>'+(ready?'Abholen':'+')+' '+m.r+'</b></span>'+ic('coin')+'</button>')+'</div>'}).join('');
   bindSeg(body,'#missionTabs',v=>{filter=v;draw()});body.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const m=MISSIONS.find(x=>x.id===b.dataset.c);if(!m||SAVE.claimed[m.id]||m.v(SAVE)<m.g)return;SAVE.claimed[m.id]=1;SAVE.coins+=m.r;persist();renderLobby();flash('+'+m.r+' Münzen!','var(--yellow)');draw()})};draw();
  openSheet({title:'Missionen',icon:'list',color:'var(--yellow)',body})}
function openPass(){let page=Math.min(4,Math.floor((lvlOf(SAVE.xp)-1)/20));const body=el('<div style="display:flex;flex-direction:column;gap:10px"></div>');
  const draw=()=>{const lv=lvlOf(SAVE.xp);body.innerHTML='<div id="passPages">'+seg('Level',Array.from({length:5},(_,i)=>[i,(i*20+1)+'–'+((i+1)*20)]),page)+'</div>'+PASS.filter(p=>p.lv>page*20&&p.lv<=(page+1)*20).map(p=>{const got=SAVE.pass[p.lv],ok=lv>=p.lv,unl=PAINTS.filter(x=>x.lv===p.lv).map(x=>x.n);
     return '<div class="rowi'+(got?' done':'')+'">'+ic(ok?'crown':'lock')+'<div class="txt"><b>Level '+p.lv+'</b><small>'+p.r+' Münzen'+(unl.length?' · Lackierung „'+esc(unl.join(', '))+'“ im Shop':'')+'</small></div>'+(got?'<span class="sticker l">✓</span>':'<button class="btn btn-small" type="button" data-l="'+p.lv+'"'+(ok?'':' disabled')+' style="color:var(--navy)"><span class="bt"><b>'+(ok?'Abholen':'Ab Lv '+p.lv)+'</b></span></button>')+'</div>'}).join('');
   bindSeg(body,'#passPages',v=>{page=+v;draw()});body.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{const p=PASS.find(x=>x.lv===+b.dataset.l);if(!p||SAVE.pass[p.lv]||lvlOf(SAVE.xp)<p.lv)return;SAVE.pass[p.lv]=1;SAVE.coins+=p.r;persist();renderLobby();flash('+'+p.r+' Münzen!','var(--yellow)');draw()})};draw();
  openSheet({title:'Rang-Pfad',icon:'crown',color:'var(--purple)',body})}
function openCoins(){openSheet({title:'Münzen',icon:'coin',color:'var(--yellow)',body:'<p class="note">Münzen kann man nicht kaufen – du verdienst sie beim Fahren:</p>'
  +'<div class="rowi">'+ic('flag')+'<div class="txt"><b>Rennen beenden</b><small>20 + 15 pro geschlagenem Gegner + 5 pro Runde</small></div></div>'
  +'<div class="rowi">'+ic('bolt')+'<div class="txt"><b>Strecke der Woche</b><small>Doppelte Münzen auf '+esc(MAPNAMES[eventTrack()])+'</small></div></div>'
  +'<div class="rowi">'+ic('list')+'<div class="txt"><b>Missionen</b><small>Einmalige Belohnungen für Ziele</small></div></div>'
  +'<div class="rowi">'+ic('star')+'<div class="txt"><b>Tagesbonus</b><small>'+DAILY+' Münzen einmal pro Tag</small></div></div>'
  +'<div class="rowi">'+ic('crown')+'<div class="txt"><b>Rang-Pfad</b><small>Münzen für jedes neue Level</small></div></div>'})}
function openProfile(){if(window.KartAccount){openSettingsLobby();selectSettings('account');return;}const body=el('<div style="display:flex;flex-direction:column;gap:14px"><div class="field"><label class="label" for="pfName">Fahrername</label><input id="pfName" maxlength="14" placeholder="Racer"></div><div class="res-stats"><div><small>Level</small><b>'+lvlOf(SAVE.xp)+'</b></div><div><small>XP</small><b>'+SAVE.xp+'</b></div><div><small>Rennen</small><b>'+SAVE.races+'</b></div><div><small>Siege</small><b>'+SAVE.wins+'</b></div></div><p class="note">Der Name wird online anderen Fahrern angezeigt.</p></div>');
  const inp=body.querySelector('input');inp.value=myName;inp.oninput=()=>{myName=inp.value.trim().slice(0,20);try{KartStorage.setItem('kart-name',myName)}catch(e){}renderLobby()};
  openSheet({title:'Profil',icon:'user',color:'var(--blue)',body})}
function claimDaily(){if(SAVE.daily===today())return;SAVE.daily=today();SAVE.coins+=DAILY;persist();renderLobby();flash('Tagesbonus: +'+DAILY+' Münzen!','var(--yellow)')}
function openSettingsLobby(){if(settingsSection==='account')window.refreshAccount?.();$('tomenu').hidden=true;$('closeLbl').textContent='Schließen';rebind=null;renderBinds();$('wstyle').textContent=WSTYLES[WSTYLE]+' ▸';$('panel').classList.add('on');$('close').focus()}
function closeSettingsLobby(){rebind=null;$('panel').classList.remove('on');$('setBtn').focus()}

// ---- Lobby rendern ----
function renderLobby(){KartAmbient.apply(SAVE);if(document.body.classList.contains('lobby')===false)return;const background=PROFILE_BACKGROUNDS.find(x=>x.id===SAVE.profileBackground)||PROFILE_BACKGROUNDS[0];$('profileBtn').style.setProperty('--profile-start',background.c);$('profileBtn').style.setProperty('--profile-end',background.end);$('profileBtn').querySelector('.avatar').innerHTML=ic(SAVE.profileIcon);const lv=lvlOf(SAVE.xp),inLv=SAVE.xp%XPL;
  $('pName').textContent=myName||'Racer';$('pLvl').textContent='LV '+lv;$('pXp').style.width=(inLv/XPL*100)+'%';$('pXpBar').setAttribute('aria-valuenow',Math.round(inLv/XPL*100));$('pXpT').textContent=inLv+' / '+XPL+' XP';
  $('coinVal').textContent=SAVE.coins;
  const mr=misReady().length,pr=passReady().length;
  $('bMis').hidden=!mr;$('bMis').textContent=mr;$('bMis').setAttribute('aria-label',mr+' Belohnungen bereit');$('bRw').hidden=!mr;$('bRw').textContent=mr;$('rwSub').textContent=mr?mr+' bereit':'Missionen';
  $('bPs').hidden=!pr;$('bPs').textContent=pr;$('psSub').textContent='Level '+lv;
  $('playSub').textContent=(SAVE.category==='gt3'?'GT3 · ':'')+MAPNAMES[SAVE.track]+' · '+SAVE.laps+(SAVE.laps>1?' Runden':' Runde')+(SAVE.comp?' · Kompetitiv':'');
  $('heroKind').textContent=SAVE.category==='gt3'?'GT3':'Kart · '+KartModels.models.find(m=>m.id===SAVE.kartModel).name;$('heroPaint').textContent=SAVE.category==='gt3'?KartGT3.cars.find(c=>c[0]===SAVE.car)[1]:KartSeason.skin(SAVE.kartSkin)==='christmas'?'Christmas':PAINTS[SAVE.paint].n;$('heroMeta').textContent='Lenkrad: '+WSTYLES[WSTYLE];
  tickLobby()}
function tickLobby(){const w=weekInfo(),dy=SAVE.daily===today();
  $('evTitle').textContent='Strecke der Woche: '+MAPNAMES[w.track];$('evSub').textContent='×2 Münzen · endet in '+dur(w.left);
  $('dailyBtn').disabled=dy;$('dyNew').hidden=dy;const nx=new Date();nx.setHours(24,0,0,0);$('dySub').textContent=dy?'Wieder in '+dur(nx-new Date()):'+'+DAILY+' Münzen abholen';
  $('dailyBtn').setAttribute('aria-label',dy?'Tagesbonus bereits abgeholt, wieder in '+dur(nx-new Date()):'Tagesbonus: '+DAILY+' Münzen abholen')}
let lobbyIv=0;
function launch(map,setup=null){sessionStorage.removeItem('kart-autostart');boot(map,setup)}
function quickPlay(){const setup=KartQuick.settings(SAVE.quickPlay);launch(setup.track,setup)}
function leaveLobbyUI(){document.body.classList.remove('lobby');$('menu').style.display='none';$('sheetWrap').hidden=true;$('panel').classList.remove('on');clearInterval(lobbyIv);$('showroom').style.display='none';$('tomenu').hidden=false;$('tomenu').querySelector('b').textContent=NET?'Zur Lobby':'Zum Menü';$('closeLbl').textContent='Weiter fahren'}

// ---- Verdrahtung ----
fillIcons();
$('playBtn').onclick=quickPlay;
$('customBtn').onclick=openCustom;$('garageBtn').onclick=openGarage;
$('mpBtn').onclick=()=>openLobby();
$('eventBtn').onclick=()=>{const settings={...weekInfo().settings,upgradesEnabled:SAVE.upgradesEnabled};launch(settings.track,settings)};
drawPreferences();selectSettings('controls');
document.querySelectorAll('#settingsTabs button').forEach(b=>b.onclick=()=>selectSettings(b.dataset.section));
$('reset').addEventListener('click',e=>{if(stopRace||settingsSection==='controls')return;e.stopImmediatePropagation();if(settingsSection==='account')return;if(settingsSection==='language'){window.setGameLanguage('de');return;}for(const k of settingsSection==='graphics'?['quality','shadows','brightness','glass']:['master','effects','musicVolume','music'])PREF[k]=SETTINGS_DEFAULT[k];savePreferences();drawPreferences()},true);
$('dailyBtn').onclick=claimDaily;$('coinInfo').onclick=openCoins;$('profileBtn').onclick=openProfile;$('setBtn').onclick=openSettingsLobby;
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>({shop:openShop,missions:openMissions,pass:openPass,friends:()=>openSheet({title:'Freunde',icon:'friends',color:'var(--purple)',body:'<p class="coming-soon" style="font-size:24px;text-align:center;padding:24px">Kommt bald</p>'})})[b.dataset.open]());
$('close').onclick=closeSettingsLobby;$('wstyle').onclick=cycleLobbyWheel;$('reset').onclick=()=>{binds=JSON.parse(JSON.stringify(DEF));saveBinds();renderBinds()};
function cycleLobbyWheel(){WSTYLE=(WSTYLE+1)%3;try{KartStorage.setItem('kart-wheel',WSTYLE)}catch(e){}$('wstyle').textContent=WSTYLES[WSTYLE]+' ▸';showroomKart();renderLobby()}
$('wstyle').onclick=cycleLobbyWheel;
// Tasten neu belegen: global (Lobby und Rennen), fängt die Taste vor allen anderen Handlern ab
addEventListener('keydown',e=>{if(!rebind)return;e.preventDefault();e.stopImmediatePropagation();
  if(e.code!=='Escape'){for(const a in binds)binds[a]=binds[a].map(c=>c===e.code?'':c);binds[rebind.a][rebind.i]=e.code;saveBinds()}rebind=null;renderBinds()},true);
addEventListener('pagehide',()=>{if(cur)cur.room.leave()});
addEventListener('keydown',e=>{if(!document.body.classList.contains('lobby')||e.code!=='Escape')return;
  if($('rconfirm').open||$('rexit').open)return;
  if(!$('paddock').hidden)$('rleave').click();else if($('panel').classList.contains('on'))closeSettingsLobby();else if(!$('sheetWrap').hidden)closeSheet();else if($('lobby').classList.contains('on'))$('lback').click()});
document.body.classList.add('lobby');
{const auto=sessionStorage.getItem('kart-autostart');if(auto&&MAPS[auto]){launch(auto)}else{showroomStart();renderLobby();lobbyIv=setInterval(tickLobby,1000)}}


;/* localization.js */
// Localisation of UI text; original German strings are retained for live switching.
(()=>{
const translations=[['Shader · Experimental','Shaders · Experimental','Shaders · Expérimental'],['Ambient','Ambient','Ambiance'],['Nächstes großes Update','Next big update','Prochaine mise à jour majeure'],['1. Dezember','December 1','1er décembre'],['Kart-Design','Kart design','Style du kart'],['Kart · Original','Kart · Original','Kart · Original'],['Original','Original','Original'],['Christmas','Christmas','Christmas'],['Quick Play','Quick Play','Partie rapide'],['Quick Play Settings','Quick Play Settings','Réglages partie rapide'],['Tagesstrecke verwenden','Use daily track','Utiliser le circuit du jour'],["Kommt bald","Coming soon","Bientôt disponible"],["Die Sprache wird sofort übernommen und gespeichert.","The language is applied immediately and saved.","La langue est appliquée immédiatement et enregistrée."],["Erstelle ein Spiel für bis zu sieben Fahrer oder tritt mit dem Code deiner Freunde bei.","Create a game for up to seven drivers or join using your friends' code.","Crée une partie pour sept pilotes maximum ou rejoins tes amis avec leur code."],["Auf eine Taste klicken, dann die neue Taste drücken. Esc bricht ab. Jede Aktion hat zwei Slots.","Click a binding, then press the new key. Esc cancels. Each action has two bindings.","Clique sur une touche, puis appuie sur la nouvelle. Échap annule. Chaque action dispose de deux raccourcis."],["Strukturierte Materialien und Texturfilterung sind aktiv. Hohe Qualität erhöht die Bildauflösung.","Textured materials and texture filtering are enabled. High quality increases rendering resolution.","Les matériaux texturés et le filtrage sont activés. La qualité élevée augmente la résolution."],["Noch keine Musik enthalten. Deine Audiodatei wird in Schleife gespielt und bleibt für diese Sitzung geladen.","No music included yet. Your audio file loops and stays loaded for this session.","Aucune musique intégrée pour le moment. Ton fichier audio est lu en boucle pour cette session."],["Weitere Lackierungen gibt es im Shop. Die Auswahl gilt auch online.","More paints are available in the shop. Your selection also applies online.","D'autres peintures sont disponibles dans la boutique. Ton choix s'applique aussi en ligne."],["Deine schnellsten Runden – lokal auf diesem Gerät gespeichert (keine Online-Rangliste).","Your fastest laps, saved locally on this device (no online leaderboard).","Tes meilleurs tours, enregistrés sur cet appareil (sans classement en ligne)."],["Gib den sechsstelligen Code des Hosts ein.","Enter the host's six-digit code.","Saisis le code à six chiffres de l'hôte."],["Einstellungen: Tastenbelegung und Lenkrad","Settings: controls and steering wheel","Paramètres : commandes et volant"],["Einstellungen und Pause","Settings and pause","Paramètres et pause"],["Einstellungsbereich","Settings section","Rubrique des paramètres"],["Eigene Hintergrundmusik","Custom background music","Musique de fond personnalisée"],["Motor & Reifengeräusche","Engine & tire sounds","Bruits du moteur et des pneus"],["Gesamtlautstärke","Master volume","Volume général"],["Musiklautstärke","Music volume","Volume de la musique"],["Musik abspielen","Play music","Activer la musique"],["Renderqualität","Render quality","Qualité graphique"],["Niedrig · sparsam","Low · power saving","Faible · économique"],["Hoch · scharf","High · sharp","Élevée · nette"],["Tastenbelegung","Key bindings","Affectation des touches"],["Weiter fahren","Resume driving","Reprendre la course"],["Zum Menü","Main menu","Menu principal"],["Zurücksetzen","Reset","Réinitialiser"],["Einstellungen","Settings","Paramètres"],["Steuerung","Controls","Commandes"],["Grafik","Graphics","Graphismes"],["Sprache","Language","Langue"],["Sound","Sound","Son"],["Schatten","Shadows","Ombres"],["Helligkeit","Brightness","Luminosité"],["Mittel","Medium","Moyenne"],["Schließen","Close","Fermer"],["Zurück","Back","Retour"],["Freunde","Friends","Amis"],["Spielen","Play","Jouer"],["Jetzt rasen!","Let's race!","C'est parti !"],["Mehrspieler","Multiplayer","Multijoueur"],["Online mit Freunden","Online with friends","En ligne avec tes amis"],["Eigenes Rennen","Custom race","Course personnalisée"],["Strecke, Modus, Runden","Track, mode, laps","Circuit, mode, tours"],["Lackierung & Lenkrad","Paint & steering wheel","Peinture et volant"],["Dein Kart","Your kart","Ton kart"],["Spielmodi","Game modes","Modes de jeu"],["Bereiche","Sections","Rubriques"],["Shop","Shop","Boutique"],["Missionen","Missions","Missions"],["Bestzeiten","Best times","Meilleurs temps"],["Bestzeit","Best time","Meilleur temps"],["Belohnungen","Rewards","Récompenses"],["Tagesbonus","Daily bonus","Bonus quotidien"],["Neu!","New!","Nouveau !"],["Rang-Pfad","Rank progression","Progression de rang"],["Strecke der Woche","Track of the week","Circuit de la semaine"],["Münzen abholen","Claim coins","Récupérer les pièces"],["Münzen","Coins","Pièces"],["endet in","ends in","se termine dans"],["Wieder in","Available in","Disponible dans"],["bereit","ready","prêt"],["Spiel erstellen","Create game","Créer une partie"],["Mit Code beitreten","Join with code","Rejoindre avec un code"],["Spielcode kopieren","Copy game code","Copier le code"],["Spielcode","Game code","Code de partie"],["Beitreten","Join","Rejoindre"],["Lobby verlassen","Leave lobby","Quitter le salon"],["Kart-Lobby","Kart lobby","Salon de karts"],["Sieben Kart-Stellplätze","Seven kart parking spaces","Sept emplacements de kart"],["Rennmodus ändern","Change race mode","Changer le mode de course"],["Starten","Start","Démarrer"],["Auf die Strecke in","Race starts in","Départ dans"],["Kompetitiv","Competitive","Compétitif"],["Rennstrecke","Race circuit","Circuit de course"],["Strecke","Track","Circuit"],["Runden","Laps","Tours"],["Runde","Lap","Tour"],["Modus","Mode","Mode"],["Frei","Free","Libre"],["Los!","Go!","C'est parti !"],["Rennen starten","Start race","Démarrer la course"],["Lackierung","Paint","Peinture"],["Lenkrad","Steering wheel","Volant"],["Rennlenkrad","Racing wheel","Volant de course"],["Klassisch","Classic","Classique"],["Rund","Round","Rond"],["Stahlblau","Steel blue","Bleu acier"],["Rennrot","Racing red","Rouge course"],["Turbo-Gelb","Turbo yellow","Jaune turbo"],["Limette","Lime","Vert citron"],["Neon-Lila","Neon purple","Violet néon"],["Elektroblau","Electric blue","Bleu électrique"],["Feuerorange","Fire orange","Orange feu"],["Mitternacht","Midnight","Bleu nuit"],["Bonbon-Pink","Candy pink","Rose bonbon"],["Gold-Edition","Gold edition","Édition or"],["Ausgerüstet","Equipped","Équipé"],["Ausrüsten","Equip","Équiper"],["Im Shop freischalten","Unlock in the shop","Débloquer dans la boutique"],["Freigeschaltet","Unlocked","Débloqué"],["freigeschaltet!","unlocked!","débloqué !"],["Ab Level","From level","À partir du niveau"],["zu wenig Münzen","not enough coins","pas assez de pièces"],["Zum Shop","Go to shop","Aller à la boutique"],["Profil","Profile","Profil"],["Fahrername","Driver name","Nom du pilote"],["Zieleinlauf","Race results","Résultats de course"],["Nochmal","Race again","Rejouer"],["Menü","Menu","Menu"],["Rennen","Races","Courses"],["Siege","Wins","Victoires"],["Podien","Podiums","Podiums"],["Stufe-III-Turbos","Tier III boosts","Turbos de niveau III"],["Beschleunigen","Accelerate","Accélérer"],["Gas","Accelerate","Accélérer"],["Bremsen","Brake","Freiner"],["Bremse / Rückwärts","Brake / Reverse","Freiner / Reculer"],["Links","Left","Gauche"],["Rechts","Right","Droite"],["Lenken links","Steer left","Tourner à gauche"],["Lenken rechts","Steer right","Tourner à droite"],["Kamera","Camera","Caméra"],["Leertaste","Space","Espace"],["Drift / Handbremse","Drift / Handbrake","Dérapage / Frein à main"],["Pause","Pause","Pause"],["Abbrechen","Cancel","Annuler"],["Fahrer","Drivers","Pilotes"],["Verbindung wird aufgebaut…","Connecting…","Connexion en cours…"],["Spiel wird erstellt…","Creating game…","Création de la partie…"],["Das Spiel ist voll.","The game is full.","La partie est complète."],["Das Rennen läuft bereits.","The race is already in progress.","La course a déjà commencé."],["Der Spielcode besteht aus sechs Ziffern.","The game code has six digits.","Le code de partie comporte six chiffres."],["Verbindung getrennt","Disconnected","Connexion interrompue"]];
let language='de';try{language=KartStorage.getItem('kart-language')||'de'}catch(e){}
if(!['de','en','fr'].includes(language))language='de';
translations.push(['Profil-Hintergründe','Profile backgrounds','Fonds de profil'],['Profil-Icons','Profile icons','Icônes de profil'],['Violett','Purple','Violet'],['Ozeanblau','Ocean blue','Bleu océan'],['Türkis','Teal','Turquoise'],['Sonnenuntergang','Sunset','Coucher de soleil'],['Rennhelm','Racing helmet','Casque de course'],['Zielflagge','Finish flag','Drapeau à damier'],['Blitz','Lightning','Éclair'],['Stern','Star','Étoile'],['Pokal','Trophy','Trophée'],['Krone','Crown','Couronne']);
translations.push(['Fahrzeuge','Cars','Voitures'],['Bots','Bots','Bots'],['Schwierigkeit','Difficulty','Difficulté'],['Leicht','Easy','Facile'],['Normal','Normal','Normal'],['Schwer','Hard','Difficile'],['Bot-Items','Bot items','Objets des bots'],['Zu wenig Münzen','Not enough coins','Pièces insuffisantes'],['Kauf fehlgeschlagen. Bitte erneut versuchen.','Purchase failed. Please try again.','Échec de l’achat. Réessaie.'],['Bitte lade die Seite neu.','Please reload the page.','Recharge la page.']);
translations.push(['Fahrzeugklasse','Vehicle class','Catégorie'],['Fahrzeug','Car','Voiture']);
translations.push(...[["Links lenken","Steer left","Tourner à gauche"],["Rechts lenken","Steer right","Tourner à droite"],["Item benutzen","Use item","Utiliser un objet"],["Neustart (zum Menü)","Restart (main menu)","Redémarrer (menu principal)"],["Bremse","Brake","Frein"],["Zur Lobby","Back to lobby","Retour au salon"],["Sieg!","Victory!","Victoire !"],["LOS!","GO!","PARTEZ !"],["WINDSCHATTEN","SLIPSTREAM","ASPIRATION"],["Schneepiste","Snow track","Piste enneigée"],["Indoor","Indoor","En salle"],["Abgeholt","Claimed","Récupéré"],["Abholen","Claim","Récupérer"],["Ab Lv","From level","Dès le niveau"],["Erstes Rennen","First race","Première course"],["Beende ein Rennen unter den ersten 3","Finish a race in the top 3","Termine une course parmi les 3 premiers"],["Beende ein Rennen","Finish a race","Termine une course"],["Aufs Treppchen","On the podium","Sur le podium"],["Sieger","Winner","Vainqueur"],["Gewinne ein Rennen","Win a race","Remporte une course"],["Drift-König","Drift king","Roi du dérapage"],["Zünde 10 Mini-Turbos der Stufe III","Trigger 10 tier III mini-turbos","Déclenche 10 mini-turbos de niveau III"],["Glückspilz","Lucky racer","Pilote chanceux"],["Sammle 15 Lucky Blocks im Modus Luckyblock","Collect 15 Lucky Blocks in Luckyblock mode","Ramasse 15 Lucky Blocks en mode Luckyblock"],["Windschattenjäger","Slipstream hunter","Chasseur d'aspiration"],["Fahre insgesamt 60 s im Windschatten","Spend 60 seconds slipstreaming","Roule 60 secondes dans l'aspiration"],["F1-Tour","F1 tour","Tournée F1"],["Beende je ein Rennen in Spa, Monaco und Monza","Finish one race each at Spa, Monaco and Monza","Termine une course à Spa, Monaco et Monza"],["Dauerbrenner","Regular racer","Pilote assidu"],["Beende 10 Rennen","Finish 10 races","Termine 10 courses"],["Klassischer Rundkurs bei Sonne, viel Grip","Sunny classic circuit, plenty of grip","Circuit classique ensoleillé, bonne adhérence"],["Schneepiste mit Hügeln und wenig Grip","Hilly snow track with low grip","Piste enneigée vallonnée, faible adhérence"],["Halle mit engen Wänden und zwei Ebenen","Indoor track with tight walls and two levels","Circuit intérieur étroit sur deux niveaux"],["Eau Rouge, Kemmel, Stavelot – echtes Höhenprofil","Eau Rouge, Kemmel, Stavelot – real elevation profile","Eau Rouge, Kemmel, Stavelot – dénivelé réel"],["Casino, Haarnadel, Tunnel – eng und hügelig","Casino, hairpin, tunnel – narrow and hilly","Casino, épingle, tunnel – étroit et vallonné"],["Lange Geraden, Schikanen, Parabolica","Long straights, chicanes, Parabolica","Longues lignes droites, chicanes, Parabolica"],["Rennen beenden","Finish a race","Terminer une course"],["20 + 15 pro geschlagenem Gegner + 5 pro Runde","20 + 15 per opponent beaten + 5 per lap","20 + 15 par adversaire battu + 5 par tour"],["Doppelte Münzen auf","Double coins on","Pièces doublées sur"],["Einmalige Belohnungen für Ziele","One-time goal rewards","Récompenses uniques par objectif"],["Münzen einmal pro Tag","coins once a day","pièces une fois par jour"],["Münzen für jedes neue Level","Coins for every new level","Pièces pour chaque nouveau niveau"],["GETROFFEN – DREHER!","HIT – SPINOUT!","TOUCHÉ – TÊTE-À-QUEUE !"],["ÖLPFÜTZE GELEGT","OIL SLICK DROPPED","FLAQUE D'HUILE DÉPOSÉE"],["ÖLPFÜTZE","OIL SLICK","FLAQUE D'HUILE"],["RAKETE TRIFFT!","ROCKET HIT!","ROQUETTE AU BUT !"],["RAKETE","ROCKET","ROQUETTE"],["Kein Ziel!","No target!","Aucune cible !"],["Item-Taste drücken","Press the item key","Appuie sur la touche objet"],["Getroffen von","Hit by","Touché par"],["BOXENSTOPP ERLEDIGT – REPARIERT!","PIT STOP COMPLETE – REPAIRED!","ARRÊT TERMINÉ – RÉPARÉ !"],["BOXENSTOPP VERPASST – WENIGER SPEED","PIT STOP MISSED – LESS SPEED","ARRÊT MANQUÉ – VITESSE RÉDUITE"],["im Shop","in the shop","dans la boutique"]]);
translations.push(["Sehr hoch","Ultra","Ultra"]);
translations.push(["Account","Account","Compte"]);
translations.push(["Rennen neu starten","Restart race","Recommencer la course"]);
translations.push(["Fahrer-Abstände","Driver distances","Distances des pilotes"]);
translations.push(...[["Lokal","Local","Local"],["Verbindung","Connection","Connexion"],["Der Web-Spielcode besteht aus acht Buchstaben und Zahlen.","The web game code has eight letters and digits.","Le code Web comporte huit lettres et chiffres."],["Bitte melde dich erneut an.","Please log in again.","Reconnecte-toi."],["Bitte verlasse zuerst deine andere Web-Lobby.","Please leave your other web lobby first.","Quitte d’abord ton autre salon Web."],["Zu viele Anfragen. Bitte versuche es gleich erneut.","Too many requests. Please try again shortly.","Trop de requêtes. Réessaie dans un instant."],["Der Webdienst ist nicht erreichbar. Versuche es erneut.","The web service is unavailable. Please try again.","Le service Web est indisponible. Réessaie."],["Web-Mehrspieler benötigt einen aktuellen Browser und die Spielwebseite.","Web multiplayer requires a current browser and the game website.","Le multijoueur Web nécessite un navigateur récent et le site du jeu."],["Keine direkte Verbindung möglich. Prüft eure Netzwerke.","A direct connection could not be established. Check your networks.","Connexion directe impossible. Vérifiez vos réseaux."],["Spiel nicht gefunden. Prüfe den Code und ob der Host noch wartet.","Game not found. Check the code and whether the host is still waiting.","Partie introuvable. Vérifie le code et si l’hôte attend encore."]]);
translations.push(['Upgrades erlaubt','Upgrades allowed','Améliorations autorisées']);
translations.push(['Gemischt','Mixed','Mixte'],['Deine Fahrzeugklasse','Your vehicle class','Ta classe de véhicule'],['Diese Lobby erlaubt nur Karts.','This lobby only allows karts.','Ce salon accepte uniquement les karts.'],['Diese Lobby erlaubt nur GT3.','This lobby only allows GT3.','Ce salon accepte uniquement les GT3.']);
const sources=new WeakMap();
const entries=translations.sort((a,b)=>b[0].length-a[0].length);
const escape=s=>Array.from(s,c=>".*+?^${}()|[]\\".includes(c)?"\\"+c:c).join("");
const table=new Map(entries.map(row=>[row[0],row]));
const pattern=new RegExp('(?<![\\p{L}])('+entries.map(row=>escape(row[0])).join('|')+')(?![\\p{L}])','gu');
function translate(text){return language==='de'?text:text.replace(pattern,key=>table.get(key)[language==='en'?1:2])}
function excluded(el){return !el||el.closest('script,style,svg,canvas,textarea,#pName,#rcode,.parking-slot.occupied,#languageSelect,[data-no-translate]')}
function update(node,key,current,set){let records=sources.get(node);if(!records){records={};sources.set(node,records)}let record=records[key];if(!record||current!==record.rendered)record=records[key]={source:current,rendered:current};const result=translate(record.source);record.rendered=result;if(result!==current)set(result)}
function localize(root){
 if(root.nodeType===3){if(!excluded(root.parentElement))update(root,'text',root.nodeValue,v=>root.nodeValue=v);return}
 if(root.nodeType!==1||excluded(root))return;
 for(const name of ['title','aria-label','placeholder'])if(root.hasAttribute(name))update(root,name,root.getAttribute(name),v=>root.setAttribute(name,v));
 // Preserve implicit option values, which must never depend on the displayed language.
 if(root.tagName==='OPTION'&&!root.hasAttribute('value'))root.value=root.textContent;
 for(const child of root.childNodes)localize(child);
}
const observer=new MutationObserver(records=>{observer.disconnect();for(const r of records){if(r.type==='childList')for(const node of r.addedNodes)localize(node);else localize(r.target)}observe()});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']})}
window.setGameLanguage=next=>{if(!['de','en','fr'].includes(next))return;language=next;try{KartStorage.setItem('kart-language',language)}catch(e){}observer.disconnect();document.documentElement.lang=language;document.getElementById('languageSelect').value=language;localize(document.body);observe()};
document.getElementById('languageSelect').onchange=e=>window.setGameLanguage(e.target.value);
window.setGameLanguage(language);
})();

