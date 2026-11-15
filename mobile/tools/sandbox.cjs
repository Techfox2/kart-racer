// Starts an isolated, integrated copy of the game for manual checks and the mobile tests.
//   node mobile/tools/sandbox.cjs [port]     (default 13990; Ctrl+C stops it)
// The repository itself is never modified: the tree is copied to a temp directory, the mobile
// modules are wired in there, the client is rebuilt there, and server/app.py serves that copy
// with a throwaway account database.
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync,spawn}=require('child_process');
const root=path.resolve(__dirname,'..','..');
function start(port=13990,{quiet=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kart-mobile-')),game=path.join(dir,'game'),data=path.join(dir,'data');
 fs.mkdirSync(data);
 fs.cpSync(root,game,{recursive:true,filter:p=>!/(^|[\\/])(\.git|\.work|node_modules|__pycache__)([\\/]|$)/.test(path.relative(root,p))});
 execFileSync(process.execPath,['mobile/tools/integrate.cjs'],{cwd:game,stdio:quiet?'ignore':'inherit'});
 const origin='http://127.0.0.1:'+port;
 const server=spawn(process.env.PYTHON||'python3',['-B','server/app.py'],{cwd:game,stdio:quiet?'ignore':'inherit',
  env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',ACCOUNT_DATA:data,GAME_ROOT:game,PUBLIC_ORIGIN:origin,PORT:String(port)}});
 const stop=()=>{try{server.kill()}catch{}try{fs.rmSync(dir,{recursive:true,force:true})}catch{}};
 return{origin,dir,game,server,stop};
}
async function ready(origin,timeout=20000){
 const end=Date.now()+timeout;
 while(Date.now()<end){try{if((await fetch(origin+'/login')).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}
 throw new Error('Sandbox server did not start at '+origin);
}
module.exports={start,ready};
if(require.main===module){
 const box=start(Number(process.argv[2])||13990);
 process.on('SIGINT',()=>{box.stop();process.exit(0)});process.on('SIGTERM',()=>{box.stop();process.exit(0)});
 ready(box.origin).then(()=>console.log('\nMobile sandbox ready: '+box.origin+'\n(copy at '+box.game+')'),e=>{console.error(e.message);box.stop();process.exit(1)});
}
