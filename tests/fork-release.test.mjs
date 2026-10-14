import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const upstream=JSON.parse(await readFile('upstream-release.json','utf8'));
const prefix=`https://github.com/LeoGray/Universal/releases/download/v${pkg.version}/`;
test('all fork runtime asset references are version-pinned and exist in the release',async()=>{
 const assets=await readdir('dist');
 for(const name of assets){
  const text=await readFile(`dist/${name}`,'utf8');
  assert(!text.includes('https://github.com/DualSubs/Universal/releases/'),name);
  assert(!text.includes('/Users/'),name);
  for(const match of text.matchAll(/https:\/\/github\.com\/LeoGray\/Universal\/releases\/download\/([^\s"'<>,]+)/g)) {
   const url=`https://github.com/LeoGray/Universal/releases/download/${match[1]}`;
   assert(url.startsWith(prefix),url);assert(assets.includes(url.slice(prefix.length)),url);
  }
  if(name.endsWith('.js'))new vm.Script(text,{filename:name});
 }
});
test('unmodified runtime bundles match checksummed upstream releases',async()=>{
 for(const name of ['Translate.response.bundle.js','Composite.Subtitles.response.bundle.js','External.Lyrics.response.bundle.js']){
  const data=await readFile(`dist/${name}`);assert.equal(createHash('sha256').update(data).digest('hex'),upstream.assets[name]);
 }
});
test('compiled Manifest preserves official Chinese and only adds missing Chinese on Mac and tvOS', {timeout:10000}, async()=>{
 const source=await readFile('dist/Manifest.response.bundle.js','utf8');
 for(const device of ['Macintosh','AppleTV','Apple TV']) for(const chinese of ['', 'zh-Hans', 'zh-Hant']) {
  const english='#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="en",NAME="English",FORCED=NO,STABLE-RENDITION-ID="english",URI="en.m3u8"';
  const official=chinese ? `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="${chinese}",NAME="Chinese",FORCED=NO,URI="zh.m3u8"` : '';
  const body=['#EXTM3U',english,official,'#EXT-X-STREAM-INF:BANDWIDTH=1000000,SUBTITLES="subs"','video.m3u8'].filter(Boolean).join('\n');
  const logs=[];
  const result=await new Promise(resolve=>vm.runInNewContext(source,{
   console:{log(...args){logs.push(args.join(" "));},warn(){},error(){}},
   $environment:{'surge-version':'test'},$script:{startTime:Date.now()/1000},
   $argument:{LogLevel:'OFF',Storage:'Argument',Languages:['EN','ZH'],Types:['Official','Translate']},
   $persistentStore:{read:()=>null,write:()=>true},
   $request:{url:'https://hls.itunes.apple.com/WebObjects/MZPlay.woa/hls/subscription/playlist.m3u8',headers:{'User-Agent':`AppleCoreMedia ${device}`}},
   $response:{status:200,headers:{'Content-Type':'application/vnd.apple.mpegurl'},body},$done:resolve,
  }));
  const diagnostics=logs.filter(x=>x.startsWith('[DualSubs Apple diagnostic] ')).map(x=>JSON.parse(x.slice('[DualSubs Apple diagnostic] '.length)));
  assert.equal(diagnostics[0].stage,'entered');
  assert.equal(diagnostics.at(-1).stage,'master-rewritten');
  assert.equal(diagnostics.at(-1).addedTracks,chinese ? 0 : 1);
  assert(!JSON.stringify(diagnostics).includes('https://'));
  assert(result.body.includes(english));
  if(chinese){assert(result.body.includes(official));assert(!result.body.includes('subtype=Translate'));}
  else {assert.match(result.body,/LANGUAGE="zh-Hans"/);assert.match(result.body,/english-dualsubs-translate/);assert.match(result.body,/subtype=Translate/);}
 }
});
test('only the two Apple translation response scripts get a 30-second budget',async()=>{
 const module=await readFile('dist/DualSubs.Universal.sgmodule','utf8');
 const lines=module.split('\n').filter(l=>l.includes('type=http-response'));
 const apple=lines.filter(l=>/^🍿️ DualSubs\.TV\+?\.Translate\.Subtitles\.response =/.test(l));
 assert.equal(apple.length,2);
 for(const line of apple)assert.match(line,/, timeout=30,/);
 for(const line of lines.filter(l=>!apple.includes(l)))assert.doesNotMatch(line,/, timeout=30,/);
});
