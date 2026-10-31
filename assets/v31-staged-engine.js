/* v0.31.0: staged grade-4 exams, textbook adjacent two-character compounds, allowance ledger.
   All amounts are a LOCAL allowance record, never a real transfer. */
(function(){
'use strict';
const ROOT=window.__hanjaV31Core={};
const DEFS={
 settings:{termLearn:true,termTest:true,termDisplay:6,termQuizCount:5,termPageMode:'latest',
           passPct:80,counts:{s1:6,s2:8,s3:6},won:{s1:50,s2:300,s3:150,terms:0},
           dailyCap:500}
};
const STAGES={terms:'교재 낱말 읽기',s1:'1단계 · 음 맞히기',s2:'2단계 · 훈·음·한자 쓰기',s3:'3단계 · 부수·획수'};
const copy=o=>JSON.parse(JSON.stringify(o));
const uniq=a=>[...new Set(a)];
const shuffled=xs=>{const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,Number(x)||0));
function ensure(){
 db.hanja31=db.hanja31||{};
 const a=db.hanja31;
 a.settings=a.settings||copy(DEFS.settings);
 const d=DEFS.settings;
 for(const k of Object.keys(d)){
   if(a.settings[k]===undefined)a.settings[k]=copy(d[k]);
 }
 a.settings.counts=Object.assign({},d.counts,a.settings.counts||{});
 a.settings.won=Object.assign({},d.won,a.settings.won||{});
 a.runs=a.runs||[];
 a.ledger=a.ledger||[];
 a.overrides=a.overrides||{};
 a.weakTerms=a.weakTerms||{};
 window.__hanja31ReadingOverrides=a.overrides;
 return a;
}
function scope(){
 const saved=typeof db.exam30Config==='object'&&db.exam30Config||{};
 const fp=db.fiveDayPlan||{};
 const e=clamp(saved.end||fp.set2EndPage||49,29,52);
 const st=clamp(saved.start||29,29,e);
 const w=wordsOn(e);
 const id=saved.lastId&&w.some(x=>x.id===+saved.lastId)?+saved.lastId:(w.length?w[w.length-1].id:null);
 return {start:st,end:e,lastId:id};
}
function wordsOn(p){return uniqWords(ITEMS.filter(x=>x.detailPage===+p))}
function words(p=scope()){
 const a=uniqWords(ITEMS.filter(x=>x.detailPage>=p.start&&x.detailPage<=p.end));
 if(p.lastId){const at=a.findIndex(w=>w.id===+p.lastId);if(at>=0)return a.slice(0,at+1)}
 return a;
}
function key(p=scope()){return [p.start,p.end,p.lastId].join('-')}
function charPool(p=scope()){
 const m=new Map();
 for(const w of words(p))for(const c of charsOf(w))if(c&&!m.has(c.ch))m.set(c.ch,{...c,page:w.detailPage,word:w.word,wordId:w.id});
 return [...m.values()];
}
function termPool(p=scope(),page=null){
 const s=ensure(),found=new Map();
 const referenceChars=page!==null?words(p).filter(w=>w.detailPage===+page).flatMap(w=>charsOf(w).map(c=>({...c,page:w.detailPage,wordId:w.id}))):words(p).flatMap(w=>charsOf(w).map(c=>({...c,page:w.detailPage,wordId:w.id})));
 for(const c of referenceChars){
  if(!c||!c.ch)continue;
  for(const term of (CHAR_INFO[c.ch]?.referenceTerms||[])){
   if(Array.from(term).length!==2||found.has(term))continue;
   const read=window.__hanja31TermData?.sound(term,s.overrides);
   if(!read||Array.from(read).length!==2)continue;
   found.set(term,{term,reading:read,sourceChar:c.ch,page:c.page,wordId:c.wordId});
  }
 }
 return [...found.values()];
}
function options(correct,all){
 let result=[String(correct)];
 for(const x of shuffled(uniq(all.map(String).filter(s=>s&&s!==String(correct))))){
  if(result.length>=4)break;result.push(x);
 }
 return shuffled(result);
}
function termQuestions(p,n){
 const conf=ensure().settings;
 const pool=termPool(p,conf.termPageMode==='latest'?p.end:null);
 const source=pool.length?pool:termPool(p,null);
 // Pick recent textbook terms, then words that students previously missed.
 const weak=ensure().weakTerms||{};
 const order=shuffled(source).sort((a,b)=>(weak[b.term]||0)-(weak[a.term]||0));
 return order.slice(0,Math.min(n,order.length)).map(x=>({type:'termReading',mode:'write',prompt:x.term,expected:x.reading,
   sourceChar:x.sourceChar,page:x.page,wordId:x.wordId,answer:null,grade:null}));
}
function s1Questions(p,n){
 const chars=shuffled(charPool(p));const sounds=uniq([...chars,...Object.values(CHAR_INFO)].map(c=>c.eum).filter(Boolean));
 return chars.slice(0,Math.min(n,chars.length)).map(c=>({type:'soundChoice',mode:'choice',prompt:c.ch,expected:c.eum,
   options:options(c.eum,sounds),sourceChar:c.ch,page:c.page,wordId:c.wordId,answer:null,grade:null}));
}
function s2Questions(p,n){
 const cs=shuffled(charPool(p)),ws=shuffled(words(p));
 const bank={
   word:ws.map(w=>({type:'wordWrite',mode:'write',prompt:w.read,expected:w.word,wordId:w.id,page:w.detailPage,answer:null,grade:null})),
   hun:cs.map(c=>({type:'hunWrite',mode:'write',prompt:c.ch,expected:c.hun.split('/')[0],wordId:c.wordId,sourceChar:c.ch,page:c.page,answer:null,grade:null})),
   eum:cs.map(c=>({type:'eumWrite',mode:'write',prompt:c.ch,expected:c.eum,wordId:c.wordId,sourceChar:c.ch,page:c.page,answer:null,grade:null}))
 };
 const plan=['word','hun','word','eum','word','hun','word','eum'];const out=[],used=new Set();
 let k=0;while(out.length<n&&k<100){
  const x=plan[k%plan.length];k++;
  let next=bank[x].find(it=>!used.has(it.type+it.prompt));
  if(!next){next=Object.values(bank).flat().find(it=>!used.has(it.type+it.prompt))}
  if(!next)break;
  used.add(next.type+next.prompt);out.push(next);
 }
 return out;
}
function s3Questions(p,n){
 const cs=shuffled(charPool(p)),parts=uniq(cs.map(c=>String(c.bu||'').trim()).filter(Boolean));
 const radicals=cs.filter(c=>c.bu).map(c=>({type:'radicalChoice',mode:'choice',prompt:c.ch,expected:c.bu,
   options:options(c.bu,parts.length>=2?parts:uniq(ITEMS.map(x=>x.bu).filter(Boolean))),sourceChar:c.ch,page:c.page,wordId:c.wordId,answer:null,grade:null}));
 const strokes=cs.map(c=>({type:'strokeWrite',mode:'write',prompt:c.ch,expected:String(c.hoek),sourceChar:c.ch,page:c.page,wordId:c.wordId,answer:null,grade:null}));
 const arr=[],max=Math.max(radicals.length,strokes.length);
 for(let i=0;i<max&&arr.length<n;i++){
  if(radicals[i]&&radicals[i].options.length>=2)arr.push(radicals[i]);
  if(arr.length<n&&strokes[i])arr.push(strokes[i]);
 }
 return arr.slice(0,n);
}
function generate(kind,p=scope()){
 const s=ensure().settings,n=kind==='terms'?clamp(s.termQuizCount,1,20):clamp(s.counts[kind],1,30);
 if(kind==='terms')return termQuestions(p,n);
 if(kind==='s1')return s1Questions(p,n);
 if(kind==='s2')return s2Questions(p,n);
 if(kind==='s3')return s3Questions(p,n);
 return [];
}
function getRun(kind,p=scope(),day=today()){
 return ensure().runs.find(r=>r.day===day&&r.scope===key(p)&&r.kind===kind)||null;
}
function getOrCreate(kind,p=scope()){
 let r=getRun(kind,p);if(r)return r;
 const items=generate(kind,p);if(!items.length)return null;
 r={id:Date.now()+Math.floor(Math.random()*10000),day:today(),scope:key(p),range:copy(p),kind,
   items,cursor:0,queue:items.map((_,i)=>i),round:1,status:'active',createdAt:Date.now(),score:null};
 ensure().runs.unshift(r);save();return r;
}
function isAnswered(it){return !!(it.answer&&(it.mode==='choice'?it.answer.selected:it.answer.img))}
function recordChoice(it,v){it.answer={selected:String(v)};it.grade=String(v)===String(it.expected)}
function finishRound(r){
 if(!r.items.length)return;
 const ungraded=r.items.some(it=>it.grade===null);
 if(ungraded){r.status='pending';r.submittedAt=Date.now();save();return 'pending'}
 return finalize(r);
}
function finalize(r){
 if(r.items.some(it=>it.grade===null))return 'pending';
 const correct=r.items.filter(it=>it.grade===true).length;
 const threshold=Math.ceil(r.items.length*clamp(ensure().settings.passPct,50,100)/100);
 r.score=correct;r.threshold=threshold;r.checkedAt=Date.now();
 if(correct>=threshold){
  r.status='passed';credit(r);save();return 'passed';
 }
 r.status='retry_ready';r.retryIndexes=r.items.map((x,i)=>x.grade===false?i:null).filter(x=>x!==null);
 // Feed missed words back to the existing wrong-answer review, once per graded round.
 if(r.lastTrackedRound!==r.round){
  for(const it of r.items)if(it.grade===false){
   if(typeof addWrong==='function'&&it.wordId)addWrong(it.wordId);
   if(it.type==='termReading')ensure().weakTerms[it.prompt]=(ensure().weakTerms[it.prompt]||0)+1;
  }
  r.lastTrackedRound=r.round;
 }
 save();return 'retry_ready';
}
function retry(r){
 if(r.status!=='retry_ready')return false;
 const queue=r.retryIndexes||[];
 if(!queue.length)return false;
 for(const i of queue){r.items[i].grade=null;r.items[i].answer=null}
 r.queue=queue;r.cursor=0;r.round++;r.status='active';save();return true;
}
function ledger(day=null){
 const lines=ensure().ledger.slice();
 return day?lines.filter(x=>x.day===day):lines;
}
function credit(r){
 const s=ensure(),key0=r.day+':'+r.kind;
 if(s.ledger.some(x=>x.key===key0))return false;
 const desired=clamp(s.settings.won[r.kind],0,10000);
 if(!desired)return false;
 const spent=ledger(r.day).reduce((a,x)=>a+x.amount,0);
 const amount=Math.max(0,Math.min(desired,clamp(s.settings.dailyCap,0,100000)-spent));
 if(amount>0)s.ledger.unshift({key:key0,day:r.day,kind:r.kind,name:STAGES[r.kind]||r.kind,amount,paid:false,at:Date.now()});
 return amount;
}
function wallet(){
 const all=ledger();return {total:all.reduce((a,x)=>a+x.amount,0),paid:all.filter(x=>x.paid).reduce((a,x)=>a+x.amount,0),
   unpaid:all.filter(x=>!x.paid).reduce((a,x)=>a+x.amount,0),today:ledger(today()).reduce((a,x)=>a+x.amount,0)};
}
function stageState(kind,p=scope()){
 const r=getRun(kind,p);if(r)return r;
 return {kind,status:'ready',items:[],cursor:0};
}
function canStart(kind,p=scope()){
 if(kind==='terms')return !!ensure().settings.termTest;
 if(kind==='s1')return true;
 if(kind==='s2')return getRun('s1',p)?.status==='passed';
 if(kind==='s3')return getRun('s2',p)?.status==='passed';
 return false;
}
function prune(){
 const s=ensure(),limit=Date.now()-14*86400000;
 // Keep grades and allowance; discard old response images after two weeks in all states.
 for(const r of s.runs){
  if(new Date(r.day+'T12:00:00').getTime()<limit)for(const it of r.items){
   if(it.answer?.img)delete it.answer.img;
   if(it.answer?.raw)delete it.answer.raw;
  }
 }
 s.runs=s.runs.slice(0,110);
}
ROOT.DEFS=DEFS;ROOT.STAGES=STAGES;ROOT.ensure=ensure;ROOT.scope=scope;ROOT.words=words;ROOT.charPool=charPool;
ROOT.termPool=termPool;ROOT.generate=generate;ROOT.getRun=getRun;ROOT.getOrCreate=getOrCreate;
ROOT.isAnswered=isAnswered;ROOT.recordChoice=recordChoice;ROOT.finishRound=finishRound;ROOT.finalize=finalize;
ROOT.retry=retry;ROOT.ledger=ledger;ROOT.wallet=wallet;ROOT.stageState=stageState;ROOT.canStart=canStart;
ROOT.credit=credit;ROOT.prune=prune;ROOT.key=key;ROOT.options=options;
ensure();
})();
