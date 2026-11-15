// Wires the additive mobile layer into the client build.
//   node mobile/tools/integrate.cjs          add the modules to bundle-manifest.json, then rebuild
//   node mobile/tools/integrate.cjs --check  only report whether the manifest is already wired
// Idempotent. The only source file it edits is bundle-manifest.json; build-client.cjs then
// regenerates assets/bundles/ui.js, assets/boot.js and kart_racer.html as it always does.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..','..'),file=path.join(root,'bundle-manifest.json');
const MODULES=require('../modules.json');
const source=fs.readFileSync(file,'utf8'),manifest=JSON.parse(source.replace(/^﻿/,''));
const missing=MODULES.filter(m=>!manifest.ui.includes(m));
for(const m of MODULES)if(!fs.existsSync(path.join(root,m))){console.error('Missing module file:',m);process.exit(1)}
if(process.argv.includes('--check')){console.log(missing.length?'Not integrated: '+missing.join(', '):'Integrated.');process.exit(missing.length?2:0)}
if(missing.length){
 // Append after the last ui entry as a text edit so the rest of the file keeps its exact formatting.
 const last=manifest.ui[manifest.ui.length-1],needle=JSON.stringify(last),at=source.lastIndexOf(needle);
 if(at<0){console.error('Could not find the end of the "ui" list in bundle-manifest.json');process.exit(1)}
 const indent=(source.slice(0,at).match(/[ \t]*$/)||[''])[0],eol=source.includes('\r\n')?'\r\n':'\n';
 const insert=missing.map(m=>','+eol+indent+JSON.stringify(m)).join('');
 const next=source.slice(0,at+needle.length)+insert+source.slice(at+needle.length);
 JSON.parse(next.replace(/^﻿/,''));fs.writeFileSync(file,next);console.log('bundle-manifest.json: added',missing.join(', '));
}else console.log('bundle-manifest.json already lists the mobile modules.');
execFileSync(process.execPath,['build-client.cjs'],{cwd:root,stdio:'inherit'});
