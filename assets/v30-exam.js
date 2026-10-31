/* v0.30.0 textbook-driven parent test, compatible with existing localStorage */
(function(){
'use strict';
const TYPES=[
 ['write','한글을 보고 한자 쓰기','write'],['read','한자를 보고 읽는 음 쓰기','write'],
 ['hun','한자를 보고 훈(뜻) 쓰기','write'],['eum','한자를 보고 음 쓰기','write'],
 ['reverseHun','훈을 보고 한자 쓰기','write'],['reverseEum','음을 보고 한자 쓰기','write'],
 ['radical','부수 고르기','choice'],['stroke','획수 쓰기','write'],
 ['meaning','한자어 뜻 쓰기','write'],['reverseMeaning','뜻을 보고 한자어 쓰기','write']
];
const labels=Object.fromEntries(TYPES.map(x=>[x[0],x[1]]));
const DEFAULT=['write','read','hun','eum','radical'];
const E=window.__hanjaExam30={};
const allPages=()=>Array.from({length:24},(_,i)=>i+29);
const wordList=()=>uniqWords(ITEMS).filter(w=>w.detailPage>=29&&w.detailPage<=52);
const clean=(s)=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const shuffle30=(xs)=>{const a=xs.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const cfg=()=>db.exam30Config||{start:29,end:49,lastId:null,count:20,types:DEFAULT.slice()};
const tests=()=>{db.exam30Tests=db.exam30Tests||[];return db.exam30Tests};
const byPage=(p)=>wordList().filter(w=>w.detailPage===+p);
function pool(c){
 const st=Math.min(+c.start,+c.end),en=Math.max(+c.start,+c.end);
 const arr=wordList().filter(w=>w.detailPage>=st&&w.detailPage<=en);
 if(c.lastId){const j=arr.findIndex(w=>w.id===+c.lastId);if(j>=0)return arr.slice(0,j+1)}
 return arr;
}
const chars=(words)=>{const m=new Map();for(const w of words)for(const ch of charsOf(w))if(ch&&!m.has(ch.ch))m.set(ch.ch,ch);return [...m.values()]};
function radicalOptions(c,all){
 const right=String(c.bu||'').trim();if(!right)return [];
 // Other textbook radicals are verified distractors; always keep the actual correct radical.
 const other=[...new Set(all.map(x=>String(x.bu||'').trim()).filter(x=>x&&x!==right))];
 const chosen=shuffle30(other).slice(0,3);
 return shuffle30([right,...chosen]);
}
function candidates(c){
 const ws=pool(c),cs=chars(ws),rs=ws.flatMap(w=>charsOf(w).map(ch=>({w,ch})));
 return {ws,cs,rs};
}
function produce(c){
 const {ws,cs,rs}=candidates(c);const selected=c.types.filter(t=>labels[t]);const bag=[];
 for(const type of selected){
  const source=(['write','read','meaning','reverseMeaning'].includes(type)?ws.map(w=>({w,ch:null})):rs);
  const shuffled=shuffle30(source);
  for(const o of shuffled){
   const w=o.w,ch=o.ch;
   if(type==='radical'&&(!ch?.bu||radicalOptions(ch,cs).length<2))continue;
   const answers={
    write:w.word,read:w.read,hun:ch?.hun,eum:ch?.eum,reverseHun:ch?.ch,reverseEum:ch?.ch,
    radical:ch?.bu,stroke:ch?.hoek,meaning:w.mean,reverseMeaning:w.word
   };
   const options=type==='radical'?radicalOptions(ch,cs):null;
   bag.push({type,id:w.id,char:ch?.ch||null,prompt:prompt(type,w,ch),correct:String(answers[type]||''),options,answer:null,grade:null});
  }
 }
 // Round-robin type mixing, maximize variety, avoid exact same word+type pair.
 const buckets=selected.map(t=>({type:t,arr:shuffle30(bag.filter(x=>x.type===t))}));
 const out=[];let cycle=0;const limit=Math.min(+c.count||20,120);
 while(out.length<limit&&buckets.some(b=>b.arr.length)){
  const b=buckets[cycle%buckets.length];cycle++;
  if(b.arr.length)out.push(b.arr.pop());
 }
 return out;
}
function prompt(type,w,ch){
 const x=ch?.ch||'',h=ch?.hun||'',e=ch?.eum||'';
 const m={
 write:w.read,read:w.word,hun:x,eum:x,reverseHun:h,reverseEum:e,
 radical:x,stroke:x,meaning:w.word,reverseMeaning:w.mean
 };
 return m[type]||w.word;
}
function makeTest(c){
 const issues=produce(c);
 if(!issues.length)return toast('출제 가능한 문제가 없습니다. 페이지나 유형을 바꿔 주세요');
 const t={id:Date.now(),created:today(),start:c.start,end:c.end,lastId:c.lastId,
 types:c.types.slice(),cursor:0,items:issues,status:'in_progress',score:null};
 tests().unshift(t);db.exam30Active=t.id;save();return t;
}
function latest(){return tests().find(t=>t.id===db.exam30Active&&t.status==='in_progress')||tests().find(t=>t.status==='in_progress')}
function parentSetup(v){
 const c=cfg(),pending=tests().filter(t=>t.status==='submitted').length;
 v.innerHTML='<div class="exam30Top">'
  +'<div class="card"><h2 class="exam30Step">1. 책에서 시험 범위 정하기</h2><p class="exam30Subtitle">장원한자 교재 인쇄 쪽수 29~52쪽 기준 · 부모님이 먼저 설정합니다.</p>'
  +'<div class="exam30Range"><label>시작 쪽<select id="e30Start"></select></label><label>끝 쪽<select id="e30End"></select></label></div>'
  +'<div id="e30Pages" class="exam30PageGrid"></div>'
  +'<div class="exam30EndWord"><label>마지막 단어 (끝 페이지에서 선택)<select id="e30Last"></select></label></div>'
  +'<div id="e30Preview" class="exam30Preview"></div></div>'
  +'<div class="card"><h2 class="exam30Step">2. 문제 종류 선택</h2><p class="exam30Subtitle">기본은 아이패드 펜으로 직접 쓰고 부모님이 O/X로 채점합니다. 부수만 선택형으로 풀어요.</p>'
  +'<div class="exam30TypeGroup">'+TYPES.slice(0,7).map(x=>typeCheck(x,c)).join('')+'</div>'
  +'<details class="exam30More"><summary>추가 유형 더 보기</summary><div class="exam30TypeGroup">'+TYPES.slice(7).map(x=>typeCheck(x,c)).join('')+'</div></details>'
  +'<div class="exam30Count"><label for="e30Count">총 문제 수</label><select id="e30Count">'+[5,10,15,20,30,40].map(n=>'<option value="'+n+'" '+(n===+c.count?'selected':'')+'>'+n+'문제</option>').join('')+'</select></div>'
  +'<button class="pri exam30Save" id="e30Save">시험 저장하고 만들기</button></div>'
  +(pending?'<div class="card"><h3>채점 대기 '+pending+'건</h3><button class="sun" id="e30Grade">지금 채점하기</button></div>':'')
  +'<details class="exam30Manage"><summary>기존 시험 기록과 추가 설정</summary><div id="e30History"></div></details>'
  +'</div>';
 function fill(sel,chosen){sel.innerHTML=allPages().map(p=>'<option value="'+p+'" '+(p===+chosen?'selected':'')+'>'+p+'쪽</option>').join('')}
 const st=v.querySelector('#e30Start'),en=v.querySelector('#e30End'),last=v.querySelector('#e30Last');
 fill(st,c.start);fill(en,c.end);
 function paint(){
  let a=+st.value,b=+en.value;
  if(a>b){const x=a;a=b;b=x}
  const words=byPage(b);
  last.innerHTML=words.map(w=>'<option value="'+w.id+'">'+clean(w.word)+' ('+clean(w.read)+')</option>').join('');
  if(words.some(w=>w.id===+c.lastId)&&b===+c.end)last.value=String(c.lastId);
  else if(words.length)last.value=String(words[words.length-1].id);
  refresh();
 }
 function refresh(){
  const a=Math.min(+st.value,+en.value),b=Math.max(+st.value,+en.value);
  v.querySelector('#e30Pages').innerHTML=allPages().map(p=>'<button type="button" class="exam30Page '+(p>=a&&p<=b?'inRange ':'')+(p===b?'last':'')+'" data-p="'+p+'">'+p+'</button>').join('');
  const val=pool({start:a,end:b,lastId:+last.value});
  v.querySelector('#e30Preview').innerHTML='<b>'+a+'~'+b+'쪽 · '+val.length+'단어 ('+val.length*2+'글자)</b>'
   +'<div class="exam30WordList">'+val.slice(-12).map(w=>'<span>'+clean(w.word)+'</span>').join('')+'</div>'
   +(val.length>12?'<small>마지막 12단어 표시</small>':'');
  v.querySelectorAll('[data-p]').forEach(btn=>btn.onclick=()=>{en.value=btn.dataset.p;paint()});
 }
 st.onchange=paint;en.onchange=paint;last.onchange=refresh;paint();
 v.querySelector('#e30Save').onclick=()=>{
  const types=[...v.querySelectorAll('input[name=e30type]:checked')].map(x=>x.value);
  if(!types.length)return toast('시험 유형을 하나 이상 선택해 주세요');
  const start=Math.min(+st.value,+en.value),end=Math.max(+st.value,+en.value);
  const next={start,end,lastId:+last.value,count:+v.querySelector('#e30Count').value,types};
  if(latest()&&!confirm('진행 중인 시험이 있습니다. 새 시험을 만들까요? 이전 시험은 기록에 남습니다.'))return;
  db.exam30Config=next;
  const t=makeTest(next);if(!t)return;
  toast('부모님 시험 설정 저장 완료 · '+t.items.length+'문제');
  ptab='exam30';parent();
 };
 const gb=v.querySelector('#e30Grade');if(gb)gb.onclick=()=>{ptab='exam30grade';parent()};
 history(v.querySelector('#e30History'));
}
function typeCheck(x,c){
 return '<label class="exam30Type"><input type="checkbox" name="e30type" value="'+x[0]+'" '+(c.types.includes(x[0])?'checked':'')+'><span>'+clean(x[1])+'</span></label>';
}
function history(host){
 host.innerHTML=tests().slice(0,15).map(t=>'<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">'
 +'<span>'+t.created+' · '+t.start+'~'+t.end+'쪽 · '+t.items.length+'문제 · '+(t.status==='graded'?t.score+'점':t.status==='submitted'?'채점 대기':'진행 중')+'</span>'
 +'<button class="ghost" data-tid="'+t.id+'">'+(t.status==='submitted'?'채점하기':t.status==='graded'?'결과 보기':'계속 풀기')+'</button></div>').join('')||'<p>아직 시험 기록이 없어요.</p>';
 host.querySelectorAll('[data-tid]').forEach(el=>el.onclick=()=>{const t=tests().find(x=>x.id===+el.dataset.tid);if(t.status==='in_progress'){db.exam30Active=t.id;save();run(t.id)}else{db.exam30GradeId=t.id;ptab='exam30grade';parent()}});
}
function run(id){
 const t=tests().find(x=>x.id===+id)||latest();
 if(!t){app.innerHTML='<div class="card exam30Empty"><h2>시험이 없어요</h2><p>부모님이 먼저 책 페이지와 문제 종류를 정해야 해요.</p><button class="pri" id="e30Back">처음으로</button></div>';document.querySelector('#e30Back').onclick=()=>go('home');return}
 if(t.status!=='in_progress'){app.innerHTML='<div class="card exam30Empty"><h2>이미 제출한 시험이에요</h2><button class="pri" onclick="go(&quot;home&quot;)">처음으로</button></div>';return}
 const item=t.items[t.cursor];if(!item)return review(t);
 const w=byId(item.id),ch=item.char?charsOf(w).find(x=>x.ch===item.char):null,choice=item.type==='radical',n=t.items.length;
 let pad=null;
 app.innerHTML='<div class="exam30TestHero"><div class="exam30Summary"><span>'+t.start+'~'+t.end+'쪽</span><b>'+(t.cursor+1)+' / '+n+'문제</b><span>'+clean(labels[item.type])+'</span></div>'
 +'<div class="prog"><div style="width:'+Math.round(t.cursor/n*100)+'%"></div></div>'
 +'<div class="card"><p class="exam30Question">'+clean(question(item.type))+'</p>'
 +'<div class="exam30Prompt '+(item.type==='write'||item.type==='reverseHun'||item.type==='reverseEum'||item.type==='reverseMeaning'?'':'exam30Hanja')+'">'+clean(item.prompt)+'</div>'
 +(choice?'<div id="e30Choices" class="exam30Choices">'+item.options.map((o,i)=>'<button class="exam30Choice '+(item.answer?.selected===o?'selected':'')+'" data-opt="'+i+'">'+clean(o)+'</button>').join('')+'</div><p class="exam30Mini">맞는 부수를 눌러 보세요</p>'
 :'<div class="exam30AnswerArea" id="e30Pad"></div><p class="exam30Mini">Apple Pencil 또는 S Pen으로 직접 써 보세요.</p>'
 +'<div class="row" style="justify-content:center"><button class="ghost" id="e30Undo">한 획 지우기</button><button class="ghost" id="e30Clear">전체 지우기</button></div>')
 +'<div class="exam30Nav"><button class="ghost" id="e30Home">나가기</button><button class="pri" id="e30Next">'+(t.cursor+1<n?'다음 문제':'답안 제출')+'</button></div></div></div>';
 if(choice){
  app.querySelectorAll('[data-opt]').forEach(btn=>btn.onclick=()=>{item.answer={selected:item.options[+btn.dataset.opt]};save();app.querySelectorAll('[data-opt]').forEach(b=>b.classList.toggle('selected',b===btn))});
 }else{
  const isWord=['write','reverseMeaning'].includes(item.type),isHanja=['reverseHun','reverseEum'].includes(item.type);
  const isChar=isHanja,sz=Math.max(102,Math.min(200,Math.floor((Math.min(window.innerWidth,800)-95)/(isWord?2:1))));
  pad=makePad(document.querySelector('#e30Pad'),{cells:isWord?2:1,size:sz,grid:true,
     w:(!isWord&&!isChar?Math.min(390,window.innerWidth-68):null),h:(!isWord&&!isChar?160:null)});
  const saved=item.answer?.raw;
  if(saved)pad.load(saved);
  document.querySelector('#e30Undo').onclick=()=>pad.undo();
  document.querySelector('#e30Clear').onclick=()=>pad.clear();
 }
 function persist(){
  if(!choice&&pad){if(!pad.empty())item.answer={raw:pad.raw(),img:pad.image(.8)};else if(!item.answer?.img)item.answer=null}
  save();
 }
 document.querySelector('#e30Home').onclick=()=>{persist();go('home')};
 document.querySelector('#e30Next').onclick=()=>{
  persist();if(choice&&!item.answer?.selected)return toast('부수를 하나 골라 주세요');
  if(!choice&&!item.answer?.img&&!confirm('답을 쓰지 않았습니다. 빈 답안으로 넘길까요?'))return;
  t.cursor++;save();run(t.id);
 };
}
function question(type){
 return {write:'다음 말을 한자로 쓰세요',read:'다음 한자어를 한글로 읽어 쓰세요',
 hun:'다음 한자의 뜻(훈)을 쓰세요',eum:'다음 한자의 소리(음)를 쓰세요',
 reverseHun:'다음 훈에 맞는 한자를 쓰세요',reverseEum:'다음 음에 맞는 한자를 쓰세요',
 radical:'다음 한자의 부수는 무엇일까요?',stroke:'몇 획인지 숫자로 쓰세요',
 meaning:'이 한자어의 뜻을 쓰세요',reverseMeaning:'다음 뜻에 맞는 한자어를 쓰세요'}[type]||'정답을 쓰세요';
}
function review(t){
 t.status='submitted';t.submittedAt=Date.now();db.exam30Active=null;save();
 app.innerHTML='<div class="card exam30Empty"><h2>시험 제출 완료!</h2><p>'+t.items.length+'문제를 끝냈어요. 부모님이 필기 답안을 확인하고 O/X로 채점할 거예요.</p><button class="pri" id="e30Done">처음으로</button></div>';
 document.querySelector('#e30Done').onclick=()=>go('home');
}
function grade(v){
 const t=tests().find(x=>x.id===db.exam30GradeId)||tests().find(x=>x.status==='submitted')||tests()[0];
 if(!t){v.innerHTML='<div class="card">채점할 시험이 없어요.</div>';return}
 db.exam30GradeId=t.id;save();
 const count=()=>t.items.filter(x=>x.grade===true).length;
 v.innerHTML='<div class="card"><h2>부모 채점</h2><p>'+t.start+'~'+t.end+'쪽 · '+t.items.length+'문제 · 점수 <b id="e30Score">'+count()+'</b>/'+t.items.length+'</p>'
 +'<div id="e30Rows"></div><div class="row" style="justify-content:center;margin:15px 0"><button class="ok" id="e30Finish">채점 완료</button></div></div><div class="card" style="margin-top:12px"><h3>시험 기록</h3><div id="e30History"></div></div>';
 const rows=v.querySelector('#e30Rows');
 t.items.forEach((it,i)=>{
  const w=byId(it.id),right=it.correct||'',isChoice=it.type==='radical',auto=isChoice&&it.answer?.selected===right;
  const line=document.createElement('div');line.className='exam30Grade';
  line.innerHTML='<b>'+(i+1)+'</b><div><h4>'+clean(labels[it.type])+' · '+clean(it.prompt)+'</h4>'
   +'<div class="exam30BookTag">'+w.detailPage+'쪽 · '+clean(w.word)+'</div>'
   +(it.answer?.img?'<img alt="학생 필기 답안" src="'+it.answer.img+'">':isChoice?'<div>학생 선택: <b>'+clean(it.answer?.selected||'미선택')+'</b></div>':'<div>미작성</div>')
   +'<div class="answer">정답: '+clean(right)+'</div>'
   +(isChoice?'<small>자동 판정 참고: '+(auto?'O':'X')+' · 부모님이 최종 확정</small>':'')
   +'</div><div class="gbtn"><button data-g="o" class="'+(it.grade===true?'selO':'')+'">O</button><button data-g="x" class="'+(it.grade===false?'selX':'')+'">X</button></div>';
  line.querySelectorAll('[data-g]').forEach(btn=>btn.onclick=()=>{
   it.grade=btn.dataset.g==='o';save();
   line.querySelectorAll('[data-g]').forEach(b=>{b.className=b.dataset.g==='o'?(it.grade?'selO':''):(it.grade===false?'selX':'')});
   v.querySelector('#e30Score').textContent=count();
  });
  rows.appendChild(line);
 });
 v.querySelector('#e30Finish').onclick=()=>{
  if(t.items.some(x=>x.grade===null))return toast('모든 문제를 O 또는 X로 채점해 주세요');
  if(t.status!=='graded')for(const it of t.items)if(it.grade===false){
   addWrong(it.id);
   if(it.char&&typeof db.skillProfile==='object'){
    db.skillProfile.chars=db.skillProfile.chars||{};
    const k=db.skillProfile.chars[it.char]||{};k[it.type]=(k[it.type]||0)+1;db.skillProfile.chars[it.char]=k;
   }
  }
  t.status='graded';t.score=count();save();
  toast('채점 완료 · '+t.score+'/'+t.items.length+'문제 정답');
  parent();
 };
 history(v.querySelector('#e30History'));
}
function start(){const t=latest();if(t)return run(t.id);return run(0)}
function install(){
 if(typeof parent!=='function'||typeof home!=='function')return;
 const originalParent=parent;
 parent=function(){
  db.exam30Tests=db.exam30Tests||[];
  const allowed=['exam30','exam30grade','five','status','weak','surprise','grade','set'];
  if(!allowed.includes(ptab))ptab='exam30';
  const pending=tests().filter(t=>t.status==='submitted').length;
  app.innerHTML='<div class="tabs"><button data-t="exam30">① 시험범위·유형</button>'
    +'<button data-t="exam30grade">② 답안 채점'+(pending?' ('+pending+')':'')+'</button>'
    +'<button data-t="five">5일 학습</button><button data-t="weak">약한 글자</button>'
    +'<button data-t="status">학습 현황</button><button data-t="surprise">깜짝시험</button>'
    +'<button data-t="set">설정</button><button class="ghost" id="out">나가기</button></div><div id="pv"></div>';
  app.querySelectorAll('[data-t]').forEach(b=>{b.classList.toggle('on',b.dataset.t===ptab);b.onclick=()=>{ptab=b.dataset.t;parent()}});
  document.querySelector('#out').onclick=()=>{parentOK=false;go('home')};
  const v=document.querySelector('#pv');
  if(ptab==='exam30')return parentSetup(v);
  if(ptab==='exam30grade')return grade(v);
  const old=ptab;ptab=old;
  if(old==='five')return originalParent();
  // legacy parent owns all other tabs; it can render them using its original routing.
  originalParent();
 };
 // override kid test entry by wrapping the existing student test hub button.
 const oldHome=home;
 home=function(){
  oldHome();
  const b=document.querySelector('#kidTest');
  if(b)b.onclick=function(){studentHub()};
 };
}
function studentHub(){
 const t=latest(),c=cfg();
 app.innerHTML='<div class="exam30TestHero"><div class="card"><h2>한자 테스트</h2>'
 +'<p class="lead">부모님이 정한 '+c.start+'~'+c.end+'쪽 범위</p>'
 +'<p class="lead">'+(t?'진행 중인 시험 '+(t.cursor+1)+'/'+t.items.length+'문제':'펜으로 쓰고, 부모님이 채점해요.')+'</p>'
 +'<button class="pri exam30Save" id="e30StartStudent">'+(t?'이어서 풀기':'테스트 시작')+'</button>'
 +'<button class="ghost" id="e30BackHome" style="width:100%;margin-top:12px">처음으로</button></div></div>';
 document.querySelector('#e30StartStudent').onclick=()=>{if(t)run(t.id);else{const x=makeTest(c);if(x)run(x.id)}};
 document.querySelector('#e30BackHome').onclick=()=>go('home');
}
E.TYPES=TYPES;E.cfg=cfg;E.pool=pool;E.produce=produce;E.radicalOptions=radicalOptions;E.parentSetup=parentSetup;E.grade=grade;E.start=start;E.studentHub=studentHub;E.install=install;
install();
})();
