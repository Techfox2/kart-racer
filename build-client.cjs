const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
const manifest=JSON.parse(fs.readFileSync('bundle-manifest.json'));const versions={};
for(const [name,files]of Object.entries(manifest)){const code=files.map(f=>'\n;/* '+f+' */\n'+fs.readFileSync(f,'utf8')).join('\n');new vm.Script(code,{filename:name});fs.mkdirSync('assets/bundles',{recursive:true});fs.writeFileSync('assets/bundles/'+name+'.js',code)}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['.work','.git','Backups','BrokenVersions','server'].includes(item.name))continue;const p=path.posix.join(dir,item.name);if(item.isDirectory())walk(p);else if(p!=='assets/boot.js'&&/\.(js|css)$/.test(p))versions[p]=hash(fs.readFileSync(p))}}walk('.');
const scripts=['vendor/three.min.js','assets/bundles/foundation.js','assets/bundles/game.js','assets/bundles/ui.js'];
let html=fs.readFileSync('game-shell.html','utf8').replace('<html','<html class="booting"');
html=html.replace(/<link\b[^>]*href="https:\/\/fonts[^>]*>/g,''); // Fonts are added after essential startup below.
html=html.replace(/<link([^>]*rel="stylesheet"[^>]*)>/g,(_match,attrs)=>'<link'+attrs.replace('rel="stylesheet"','data-boot-style')+'>');
const recovery=`(()=>{const lang=window.KART_ACCOUNT?.state?.['kart-language'];if(['de','en','fr'].includes(lang))document.documentElement.lang=lang;let attempts=0;function load(){const s=document.createElement('script');s.src='assets/boot.js?v=${hash(fs.readFileSync('assets.js','utf8')+fs.readFileSync('boot.js','utf8'))}';s.onerror=()=>{s.remove();if(++attempts<3)setTimeout(load,350*2**attempts);else{document.getElementById('bootMessage').textContent=({de:'Laden fehlgeschlagen.',en:'Loading failed.',fr:'Échec du chargement.'})[document.documentElement.lang]||'Loading failed.';document.getElementById('bootRetry').hidden=false}};document.head.append(s)}document.getElementById('bootRetry').onclick=()=>location.reload();load()})();`;
fs.writeFileSync('assets/boot.js',fs.readFileSync('assets.js','utf8')+'\n;'+fs.readFileSync('boot.js','utf8'));
html=html.replace('</head>',`<style>.booting body>:not(#bootStatus){visibility:hidden}#bootStatus{position:fixed;inset:0;z-index:99999;display:grid;place-content:center;gap:18px;text-align:center;background:#17202f;color:white;font:18px system-ui}#bootRetry{padding:12px 20px;font:inherit;cursor:pointer}</style>\n</head>`);
const boot=`<div id="bootStatus" role="status"><span id="bootMessage">…</span><button id="bootRetry" hidden>↻</button></div><script>window.KART_BUILD=${JSON.stringify({scripts,versions})};${recovery}</script>`;
html=html.replace('</body>',boot+'</body>');
fs.writeFileSync('kart_racer.html',html);console.log('Built scripts:',scripts.length+1,'HTML bytes:',Buffer.byteLength(html));
