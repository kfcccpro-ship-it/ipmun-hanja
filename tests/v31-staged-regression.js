const assert=require('assert');
const fs=require('fs'),vm=require('vm');
const get=p=>fs.readFileSync(p,'utf8');
const html=get('index.html');
const css=get('assets/v31-staged.css');
const terms=get('assets/v31-term-readings.js');
const engine=get('assets/v31-staged-engine.js');
const ui=get('assets/v31-staged-ui.js');
assert(html.includes('v0.31.0</title>'));
for(const n of ['assets/v31-term-readings.js','assets/v31-staged-engine.js','assets/v31-staged-ui.js','assets/v31-staged.css'])assert(html.includes(n+'?v=0.31.0'));
assert(css.includes('@media(orientation:portrait)'));
assert(css.includes('v31Top'));
assert(ui.includes("bookTop('learn')")&&ui.includes("bookTop('test')"));
assert(ui.includes('termAdmin(v')&&ui.includes('walletPanel(v'));
assert(ui.includes('window.__hanjaActiveWriter=persist'));
assert(html.includes('savedRaster')&&html.includes('if(savedRaster)ctx.drawImage(savedRaster,0,0,W,H)'));
new Function(terms);new Function(engine);new Function(ui);
const pre=['data/meta.js','data/chars.js','data/ref-29-34.js','data/ref-35-40.js','data/ref-41-46.js','data/ref-47-52.js'].map(get).join('\n');
const ctx={window:{},console,Math,Date};
vm.createContext(ctx);
vm.runInContext(pre,ctx);
vm.runInContext([
'const ITEMS=[];let ID=1;',
'for(const w of DATA.words)for(const d of w.characterDetails)ITEMS.push({',
' id:ID++,word:w.hanja,read:w.reading,detailPage:w.detailPage,ch:d.char,hun:d.hunRaw,eum:d.eumRaw,bu:d.radicalRaw,hoek:d.strokeCount',
'});',
'const uniqWords=a=>a.filter((x,i)=>a.findIndex(y=>y.word===x.word)===i);',
'const byId=id=>ITEMS.find(x=>x.id===id);',
'const charsOf=w=>[byId(w.id),byId(w.id+1)];',
"const today=()=> '2026-10-31';const save=()=>{};",
'const db={};const addWrong=id=>{db.wrong=db.wrong||{};db.wrong[id]=(db.wrong[id]||0)+1};'
].join('\n'),ctx);
vm.runInContext(terms,ctx);vm.runInContext(engine,ctx);
const C=ctx.window.__hanjaV31Core,T=ctx.window.__hanja31TermData;
const max={start:29,end:52,lastId:191};
const pool=C.termPool(max);
assert.strictEqual(pool.length,1154);
assert(pool.every(t=>t.reading&&Array.from(t.reading).length===2));
assert.strictEqual(T.sound('加算'),'가산');
assert.strictEqual(T.sound('加入'),'가입');
assert.strictEqual(T.sound('工夫'),'공부');
assert.strictEqual(T.sound('樂園'),'낙원');
assert.strictEqual(C.words(max).length,96);
const small={start:29,end:29,lastId:1};
assert.strictEqual(C.words(small).length,1);
assert(C.termPool(small).length>0);
assert.strictEqual(C.generate('s1',max).length,6);
assert.strictEqual(C.generate('s2',max).length,8);
assert.strictEqual(C.generate('s3',max).length,6);
assert.strictEqual(C.generate('terms',max).length,5);
for(const kind of ['terms','s1','s2','s3']){
 for(const item of C.generate(kind,max)){
  assert(item.expected);
  if(item.mode==='choice'){
   assert(item.options.includes(item.expected));
   assert(item.options.length>=2&&item.options.length<=4);
   assert.strictEqual(new Set(item.options).size,item.options.length);
  }
 }
}
const scope=C.scope();
assert(!C.canStart('s2',scope));
const first=C.getOrCreate('s1',scope);
first.items.forEach(it=>C.recordChoice(it,it.expected));
assert.strictEqual(C.finishRound(first),'passed');
assert(C.canStart('s2',scope));
const second=C.getOrCreate('s2',scope);
second.items.forEach(it=>it.answer={img:'test'});
assert.strictEqual(C.finishRound(second),'pending');
second.items.forEach(it=>it.grade=true);
assert.strictEqual(C.finalize(second),'passed');
const third=C.getOrCreate('s3',scope);
third.items.forEach(it=>{it.answer={img:'test'};it.grade=true});
assert.strictEqual(C.finishRound(third),'passed');
assert.strictEqual(C.wallet().today,500);
C.finalize(third);
assert.strictEqual(C.wallet().today,500);
const quick=C.getOrCreate('terms',scope);
assert(quick.items.every(it=>it.type==='termReading'&&it.mode==='write'));
quick.items.forEach(it=>{it.answer={img:'test'};it.grade=true});
assert.strictEqual(C.finishRound(quick),'pending');
assert.strictEqual(C.finalize(quick),'passed');
assert.strictEqual(C.wallet().today,500);
const other={start:29,end:29,lastId:1};
const failed=C.getOrCreate('s1',other);
failed.items.forEach(it=>C.recordChoice(it,'잘못된답'));
assert.strictEqual(C.finishRound(failed),'retry_ready');
assert(C.retry(failed));
assert(failed.queue.length===failed.items.length);
failed.items.forEach(it=>C.recordChoice(it,it.expected));
assert.strictEqual(C.finishRound(failed),'passed');
assert.strictEqual(C.wallet().today,500);
console.log('v0.31: 1154 reference terms, stages, pen answers, retry, wallet, iPad save guards PASS');
