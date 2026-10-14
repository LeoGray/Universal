import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const upstream=JSON.parse(await readFile('upstream-release.json','utf8'));
const prefix=`https://github.com/LeoGray/Universal/releases/download/v${pkg.version}/`;
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const [name,sha256] of Object.entries(upstream.assets)) {
 // Skip the upstream Manifest: build the patched one from source below.
 if(name==='Manifest.response.bundle.js')continue;
 const bytes=process.env.UPSTREAM_ASSET_DIR
  ? await readFile(path.join(process.env.UPSTREAM_ASSET_DIR,name))
  : execFileSync('curl',['--fail','--location','--silent','--show-error','--retry','3',`${upstream.baseURL}/${name}`],{maxBuffer:20*1024*1024});
 if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error(`Upstream checksum mismatch: ${name}`);
 // Keep code/metadata intact, changing only same-project release URLs to this fork.
 let text=bytes.toString('utf8').replaceAll(`${upstream.baseURL}/`,prefix);
 if(name==='DualSubs.Universal.sgmodule')text=text.replace(/^#!name = .*$/m,'#!name = 🍿️ DualSubs: 🔣 Universal · LeoGray').replace(/^#!version = .*$/m,`#!version = ${pkg.version}`).replace(/^#!arguments = (.*)$/m,(_,args)=>`#!arguments = ${args.replace('Storage:"PersistentStore"','Storage:"Argument"')}`);
 if(name==='DualSubs.Universal.sgmodule') {
  let count=0;
  text=text.split('\n').map(line=>{
   if(!/^🍿️ DualSubs\.TV\+?\.Translate\.Subtitles\.response =/.test(line))return line;
   if(!line.includes(', requires-body=1,') || /(?:^|, )timeout=/.test(line))throw new Error('Unexpected Apple translation declaration');
   count++;
   return line.replace(', requires-body=1,',', requires-body=1, timeout=30,');
  }).join('\n');
  if(count!==2)throw new Error(`Expected two Apple translation scripts, found ${count}`);
 }
 await writeFile(`dist/${name}`,text);
}
execFileSync('node',['node_modules/rollup/dist/bin/rollup','-c','rollup.fork.config.mjs'],{stdio:'inherit'});
console.log(`Built fork v${pkg.version}, ${Object.keys(upstream.assets).length} assets`);
