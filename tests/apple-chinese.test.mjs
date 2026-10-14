import assert from 'node:assert/strict';
import test from 'node:test';
import AttrList from '../src/class/AttrList.mjs';
import setOption from '../src/function/setOption.mjs';

const track = (language, group = 'subs-ap', extra = {}) => ({TAG:'#EXT-X-MEDIA',OPTION:{TYPE:'SUBTITLES','GROUP-ID':group,LANGUAGE:language,NAME:language,URI:`${group}/${language}.m3u8`,FORCED:'NO','STABLE-RENDITION-ID':`track-${language}`,...extra}});
function apply(file, device='Macintosh', platform='Apple', target='ZH') {
 const attrs=new AttrList('application/vnd.apple.mpegurl',platform);
 const en=file.filter(x=>x.OPTION.LANGUAGE==='en');
 const chinese=file.filter(x=>x.OPTION.LANGUAGE==='zh-Hans' && x.OPTION.FORCED!=='YES');
 return attrs.set(file,{EN:en,[target]:chinese},['Official','Translate'],['EN',target],true,device);
}
for(const lang of ['zh-Hans','zh-Hant','zh-TW','zh-HK','cmn-Hans','yue-Hant']) {
 for(const device of ['Macintosh','iPhone','AppleTV']) {
  test(`official ${lang} stays unchanged on ${device}`,()=>{
   const file=[track('en'),track(lang)], expected=structuredClone(file);
   assert.deepEqual(apply(file,device),expected);
  });
 }
}
test('English-only Mac playlist gets a distinct selectable Chinese translation without changing original',()=>{
 const original=track('en'),file=[original],expected=structuredClone(original);
 apply(file);
 assert.equal(file.length,2);assert.deepEqual(original,expected);
 const generated=file[1].OPTION;
 assert.equal(generated.LANGUAGE,'zh-Hans');assert.equal(generated['ASSOC-LANGUAGE'],'en');
 assert.equal(generated['STABLE-RENDITION-ID'],'track-en-dualsubs-translate');
 assert.match(generated.URI,/subtype=Translate&lang=EN/);
});
test('forced-only Chinese does not suppress full translation',()=>{
 const file=[track('en'),track('zh-Hans','subs-ap',{FORCED:'YES'})];
 assert.equal(apply(file).length,3);
});
test('CDN pathways keep consistent translated IDs and all original tracks',()=>{
 const originals=['ap','fa','ak'].map(p=>track('en',`subs-${p}`,{'PATHWAY-ID':p}));
 const file=apply([...originals]);assert.equal(file.length,6);
 for(const p of ['ap','fa','ak'])assert.equal(file.filter(x=>x.OPTION['GROUP-ID']===`subs-${p}`).length,2);
 assert.equal(new Set(file.filter(x=>x.OPTION.LANGUAGE==='zh-Hans' && x.OPTION.FORCED!=='YES').map(x=>x.OPTION['STABLE-RENDITION-ID'])).size,1);
});
test('official Chinese on one pathway does not hide translation on a pathway without Chinese',()=>{
 const file=[track('en','subs-ap'),track('zh-Hant','subs-ap'),track('en','subs-fa')];
 const out=apply(file);assert.equal(out.length,4);assert.equal(out.filter(x=>x.OPTION.URI.includes('subtype=')).length,1);
 assert.equal(out.find(x=>x.OPTION.URI.includes('subtype=')).OPTION['GROUP-ID'],'subs-fa');
});
test('mobile track labeling stays upstream-compatible when Chinese is absent',()=>{
 for(const device of ['iPhone','AppleTV'])assert.equal(apply([track('en')],device)[1].OPTION.LANGUAGE,'dualsubs-translate');
});
test('non-Apple official/translation choices remain enabled',()=>assert.equal(apply([track('en'),track('zh-Hans')],'Macintosh','Disney+').length,4));
test('non-Chinese translation is not mislabeled as Chinese',()=>{
 const option=setOption(track('en'),track('es'),'Translate','Apple',true,'Macintosh');
 assert.equal(option.OPTION.LANGUAGE,'en');assert.equal(option.OPTION['STABLE-RENDITION-ID'],'track-en');
});
test('official embedded Chinese CC suppresses translation for its linked subtitle group',()=>{
 const cc=track('zh-Hant','cc',{TYPE:'CLOSED-CAPTIONS','INSTREAM-ID':'CC1'});delete cc.OPTION.URI;
 const file=[track('en'),cc,{TAG:'#EXT-X-STREAM-INF',OPTION:{SUBTITLES:'subs-ap','CLOSED-CAPTIONS':'cc'},URI:'video.m3u8'}];
 assert.deepEqual(apply(structuredClone(file)),file);
});
