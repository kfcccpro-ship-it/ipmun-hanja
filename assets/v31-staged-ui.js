/* v0.31.0: iPad-first student UI, top-priority textbook glossary, stage exams,
   parent's O/X scoring and a separate on-device allowance ledger. */
(function(){
'use strict';
const C=window.__hanjaV31Core,T=window.__hanja31TermData;
if(!C||!T)return;
const X=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const $v=id=>document.getElementById(id);
const selectPages=(first,last)=>Array.from({length:24},(_,i)=>i+29).map(p=>'<option value="'+p+'" '+(p===+first?'selected':'')+'>'+p+'쪽</option>').join('');
const won=x=>Number(x||0).toLocaleString('ko-KR')+'원';
const labelType=t=>({termReading:'교재 낱말 읽기',soundChoice:'한자 음 고르기',wordWrite:'한자어 쓰기',hunWrite:'훈(뜻) 쓰기',
 eumWrite:'음 쓰기',radicalChoice:'부수 고르기',strokeWrite:'전체 획수 쓰기'}[t]||t);
const labelQuestion=t=>({termReading:'아래 한자어를 한글로 읽어 쓰세요',soundChoice:'이 한자의 소리는 무엇일까요?',
 wordWrite:'한글을 보고 한자로 쓰세요',hunWrite:'한자의 뜻(훈)을 쓰세요',eumWrite:'한자의 음을 쓰세요',
 radicalChoice:'이 한자의 부수를 고르세요',strokeWrite:'총 몇 획인지 숫자로 쓰세요'}[t]||'정답을 쓰세요');
function speak(s){
 if(!('speechSynthesis' in window))return toast('이 기기에서 음성 듣기를 지원하지 않아요');
 try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s);u.lang='ko-KR';u.rate=.76;window.speechSynthesis.speak(u)}
 catch(e){toast('음성 재생을 지원하지 않아요')}
}
function scrollTop(){window.scrollTo(0,0)}
function show(html){window.__hanjaActiveWriter=null;app.innerHTML=html;scrollTop()}
function extraEnabled(key){return !!C.ensure().settings[key]}
function oldMainLearn(){const f=window.__hanjaV29&&window.__hanjaV29.kidHub;if(typeof f==='function')return f('learn');go('home')}
function bookTop(mode){
 const en=extraEnabled(mode==='learn'?'termLearn':'termTest');
 const p=C.scope(),recent=C.termPool(p,p.end),cnt=recent.length||C.termPool(p).length;
 const text=mode==='learn'?'한자 옆에 실린 두 글자 낱말을 먼저 읽어 봐요.':'간단한 5문제 · 한글 읽기를 펜으로 써요.';
 return '<div class="card v31Top"><span class="v31First">맨 먼저 · 교재 속 작은 낱말 모음</span>'
  +'<h2>두 글자 낱말 읽기</h2><p>'+text+'</p>'
  +'<div class="v31Progress"><span>'+p.start+'~'+p.end+'쪽</span><span>최근 페이지 관련 낱말 '+cnt+'개</span></div>'
  +(en?'<button class="pri v31Primary" id="v31TopGo">'+(mode==='learn'?'낱말 읽기 시작':'낱말 읽기 쪽지시험')+'</button>'
       :'<div class="v31Info">부모님이 선택 기능을 꺼 두었어요. 부모 모드에서 언제든지 켤 수 있습니다.</div>')
  +'</div>';
}
function learnHub(){
 const p=C.scope(),s=C.ensure();
 show('<div class="v31Wrap"><div class="v31Line"><h2>오늘의 학습</h2><button class="ghost" id="v31GoHome">처음으로</button></div>'
  +bookTop('learn')
  +'<div class="v31Next"><h3>한자 익히기</h3><p>획순 보고 → 훈·음 읽기 → 펜으로 5번 쓰기 → 쉬운 문장 읽기</p>'
  +'<button class="pri v31Primary" id="v31CoreLearn">한자 학습 시작</button></div>'
  +'<p class="v31Muted">모음 읽기는 부모님이 켜고 끌 수 있어요. 기존 5일 학습과 학습 포인트는 그대로 유지됩니다.</p></div>');
 $v('v31GoHome').onclick=()=>go('home');
 $v('v31CoreLearn').onclick=oldMainLearn;
 if($v('v31TopGo'))$v('v31TopGo').onclick=()=>termStudy(p.end,0,false);
}
function testHub(){
 const p=C.scope(),s=C.ensure(),v=C.wallet();
 const arr=['s1','s2','s3'];
 show('<div class="v31Wrap"><div class="v31Line"><h2>한자 테스트</h2><button class="ghost" id="v31GoHome">처음으로</button></div>'
  +bookTop('test')
  +'<div class="card v31Card"><h2>3단계 도전</h2><p>'+p.start+'~'+p.end+'쪽 · 펜으로 쓰고 부모님이 확인해요.</p>'
  +'<div class="v31Part">'+arr.map(function(kind){
   const r=C.stageState(kind,p),allowed=C.canStart(kind,p),n=s.settings.counts[kind],reward=s.settings.won[kind];
   const status=r.status==='passed'?'통과 완료':r.status==='pending'?'부모 채점 기다리는 중':r.status==='retry_ready'?'틀린 문제 재도전':
     r.status==='active'?'이어서 풀기':allowed?'준비 완료':'이전 단계 통과 후 열림';
   const done=r.status==='passed',waiting=r.status==='pending',can=allowed&&!done&&!waiting;
   return '<div class="v31Step '+(done?'done':!allowed?'locked':'')+'"><div><h3>'+X(C.STAGES[kind])+'</h3>'
    +'<p>'+n+'문제 · 통과 기준 '+s.settings.passPct+'% · <b class="v31Money">'+won(reward)+'</b></p>'
    +'<div class="v31Progress">'+(done?'완료':status)+(r.round>1?' · '+r.round+'회차':'')+'</div></div>'
    +'<button class="'+(can?'pri':'ghost')+'" id="v31Stage_'+kind+'" '+(!can?'disabled':'')+'>'+status+'</button></div>';
  }).join('')+'</div></div>'
  +'<div class="v31Info">오늘 적립: '+won(v.today)+' / 최대 '+won(s.settings.dailyCap)+' · 학습 포인트(500P)와 용돈은 별도로 기록됩니다.</div>'
  +'</div>');
 $v('v31GoHome').onclick=()=>go('home');
 if($v('v31TopGo'))$v('v31TopGo').onclick=()=>startExam('terms');
 for(const kind of arr){const b=$v('v31Stage_'+kind);if(b&&!b.disabled)b.onclick=()=>startExam(kind)}
}
function termStudy(page,idx=0,expanded=false){
 const p=C.scope(),w=C.words(p).filter(x=>x.detailPage===+page);
 const byChar=new Map();
 for(const word of w)for(const info of T.collection(word)){
  if(!byChar.has(info.character))byChar.set(info.character,info);
 }
 const all=[...byChar.values()];
 if(!all.length){
  show('<div class="card v31Wrap"><h2>이 쪽에 낱말 모음이 없어요</h2><button class="pri" id="v31Back">학습으로</button></div>');
  $v('v31Back').onclick=learnHub;return;
 }
 idx=Math.max(0,Math.min(idx,all.length-1));const c=all[idx],lim=C.ensure().settings.termDisplay;
 const terms=expanded?c.terms:c.terms.slice(0,lim),pages=Array.from({length:p.end-p.start+1},(_,i)=>p.start+i);
 show('<div class="v31Wrap"><div class="v31Line"><h2>교재 낱말 모음</h2><button class="ghost" id="v31Back">학습으로</button></div>'
  +'<div class="card"><span class="v31First">한자 옆 작은 글씨 · 두 글자 낱말</span>'
  +'<div class="v31BookTiles">'+pages.map(n=>'<button class="'+(n===+page?'on':'')+'" data-p="'+n+'">'+n+'쪽</button>').join('')+'</div>'
  +'<div class="v31Progress">'+page+'쪽 · '+(idx+1)+' / '+all.length+'글자</div>'
  +'<div class="v31CharHeader"><strong>'+X(c.character)+'</strong><div>'+X(c.hun)+' '+X(c.eum)+'<br><span class="v31Muted">한 글자에서 낱말로!</span></div></div>'
  +'<div class="v31Guide">낱말을 누르면 한글 읽기가 나와요. 눌러서 확인한 뒤 소리 내어 세 번 읽어 보세요.</div>'
  +'<div class="v31Terms">'+terms.map((t,i)=>'<button class="v31Term" data-word="'+i+'"><b>'+X(t.word)+'</b><small>읽기 보기</small></button>').join('')+'</div>'
  +(c.terms.length>lim?'<button class="ghost" id="v31Expand">'+(expanded?'처음 '+lim+'개만 보기':'다른 낱말도 보기 ('+(c.terms.length-lim)+'개)')+'</button>':'')
  +'<div class="v31Pager"><button class="ghost" id="v31Prev" '+(!idx?'disabled':'')+'>이전 글자</button><button class="pri" id="v31Next">'+(idx+1<all.length?'다음 글자':'학습 마치기')+'</button></div>'
  +'</div></div>');
 $v('v31Back').onclick=learnHub;
 app.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>termStudy(+b.dataset.p,0,false));
 app.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{
  const t=terms[+b.dataset.word];
  b.classList.toggle('revealed');b.querySelector('small').textContent=b.classList.contains('revealed')?(t.reading||'부모님 확인 필요'):'읽기 보기';
  if(b.classList.contains('revealed')&&t.reading)speak(t.reading);
 });
 if($v('v31Expand'))$v('v31Expand').onclick=()=>termStudy(page,idx,!expanded);
 $v('v31Prev').onclick=()=>termStudy(page,idx-1,false);
 $v('v31Next').onclick=()=>idx+1<all.length?termStudy(page,idx+1,false):learnHub();
}
function startExam(kind){
 if(!C.canStart(kind)){
  toast('앞 단계를 먼저 통과해 주세요.');return;
 }
 const r=C.getOrCreate(kind);
 if(!r)return toast('출제할 문제가 없습니다. 부모님에게 범위를 확인해 달라고 해 주세요.');
 if(r.status==='passed')return result(r);
 if(r.status==='pending')return result(r);
 if(r.status==='retry_ready'){if(!C.retry(r))return result(r)}
 question(r);
}
function question(r){
 if(r.cursor>=r.queue.length){
  const state=C.finishRound(r);return result(r,state);
 }
 const i=r.queue[r.cursor],it=r.items[i],obj=it.mode==='choice',n=r.queue.length;
 const promptHanja=/^[\u3400-\u9fff\uF900-\uFAFF]+$/.test(it.prompt);
 const questionHtml=promptHanja?'<div class="v31BigHanja">'+X(it.prompt)+'</div>':'<div class="v31BigRead">'+X(it.prompt)+'</div>';
 show('<div class="v31Wrap"><div class="v31Line"><h2>'+X(C.STAGES[r.kind])+'</h2><button class="ghost" id="v31Leave">나가기</button></div>'
  +'<div class="v31Progress"><span>진행 '+(r.cursor+1)+'/'+n+'문제</span>'
  +(r.round>1?'<span>재도전 '+r.round+'회차</span>':'')+'</div>'
  +'<div class="prog"><div style="width:'+Math.round(r.cursor/Math.max(n,1)*100)+'%"></div></div>'
  +'<div class="card"><div class="v31Question">'+X(labelQuestion(it.type))+'</div>'+questionHtml
  +(obj?'<div class="v31QuizChoice">'+(it.options||[]).map((o,k)=>'<button data-opt="'+k+'" class="'+(it.answer?.selected===o?'on':'')+'">'+X(o)+'</button>').join('')+'</div>'
       :'<div id="v31Pad" class="v31Writing"></div><div class="v31PenTools"><button class="ghost" id="v31Undo">한 획 지우기</button><button class="ghost" id="v31Clear">모두 지우기</button></div>')
  +'<p class="v31Muted" style="text-align:center">'+(obj?'정답을 하나 선택하세요.':'Apple Pencil로 답을 직접 써 보세요. 부모님이 채점합니다.')+'</p>'
  +'<div class="v31Pager"><button class="ghost" id="v31LeaveBottom">나중에 이어하기</button><button class="pri" id="v31NextQ">'+(r.cursor+1<n?'다음 문제':'답안 제출')+'</button></div></div></div>');
 let pad=null;
 if(obj){
  app.querySelectorAll('[data-opt]').forEach(b=>b.onclick=()=>{
   C.recordChoice(it,it.options[+b.dataset.opt]);save();
   app.querySelectorAll('[data-opt]').forEach(z=>z.classList.toggle('on',z===b));
  });
 }else{
  const two=it.type==='wordWrite';
  const portrait=window.innerWidth||400;
  const sz=Math.max(96,Math.min(205,Math.floor((Math.min(portrait,860)-115)/(two?2:1))));
  const width=(!two&&it.type!=='strokeWrite'&&it.type!=='hunWrite'&&it.type!=='eumWrite')?Math.min(360,Math.max(200,portrait-78)):null;
  const txtWidth=!two&&['termReading','hunWrite','eumWrite'].includes(it.type)?Math.min(390,Math.max(180,portrait-84)):width;
  pad=makePad($v('v31Pad'),{cells:two?2:1,size:sz,grid:two||it.type==='strokeWrite',
   w:txtWidth,h:txtWidth?160:null});
  if(it.answer?.raw)pad.load(it.answer.raw);
  function persist(){
   if(!pad)return;
   if(!pad.empty())it.answer={raw:pad.raw(),img:pad.image(.75)};
   else it.answer=null;
   save();
  }
  window.__hanjaActiveWriter=persist;
  $v('v31Undo').onclick=()=>pad.undo();
  $v('v31Clear').onclick=()=>pad.clear();
 }
 const keep=()=>{
  if(typeof window.__hanjaActiveWriter==='function')window.__hanjaActiveWriter();
  return C.isAnswered(it);
 };
 const leave=()=>{keep();r.status='active';save();r.kind==='terms'?testHub():testHub()};
 $v('v31Leave').onclick=leave;$v('v31LeaveBottom').onclick=leave;
 $v('v31NextQ').onclick=()=>{
  const ok=keep();
  if(!ok&&!confirm('답안이 비어 있습니다. 빈칸으로 제출할까요?'))return;
  if(!ok){it.answer={blank:true};it.grade=false}
  if(obj&&ok)it.grade=String(it.answer.selected)===String(it.expected);
  if(!obj&&ok)it.grade=null;
  if(it.answer?.raw)delete it.answer.raw; // JPEG answer persists for parent's O/X; PNG only needed while editing
  r.cursor++;save();question(r);
 };
}
function result(r,state){
 state=state||r.status;
 const pass=r.status==='passed',pending=r.status==='pending',again=r.status==='retry_ready';
 const w=C.wallet(),credit=C.ledger(r.day).find(x=>x.kind===r.kind);
 const ttl=pass?'통과했어요!':pending?'부모님 채점을 기다려요':again?'아쉬워요. 다시 해 볼까요?':'시험 진행 상태';
 show('<div class="v31Wrap"><div class="card" style="text-align:center"><h2>'+ttl+'</h2>'
  +'<div class="v31BigRead">'+(pass?'성공!':pending?'채점 대기':String(r.score||0)+' / '+r.items.length+'문제')+'</div>'
  +'<p>'+(pass?(credit?'이번 단계 '+won(credit.amount)+' 적립!':'이번 단계를 통과했어요.'):pending?'부모님이 펜으로 쓴 답안을 O/X로 확인해 주시면 다음 단계가 열려요.':'틀린 문제만 다시 연습하고 도전해 봐요.')+'</p>'
  +(again?'<button class="pri v31Primary" id="v31Try">틀린 문제 다시 풀기</button>':'')
  +'<button class="ghost v31Primary" id="v31Return">테스트 목록으로</button></div></div>');
 if($v('v31Try'))$v('v31Try').onclick=()=>{if(C.retry(r))question(r)};
 $v('v31Return').onclick=testHub;
}
function customTabs(){
 return '<div class="tabs"><button data-v31="v31setup">① 평가·용돈 설정</button><button data-v31="v31terms">② 낱말 읽기</button>'
 +'<button data-v31="v31grade">③ 답안 채점</button><button data-v31="v31wallet">용돈 장부</button>'
 +'<button data-legacy="five">기존 5일 학습</button><button data-legacy="exam30">기존 시험</button>'
 +'<button data-legacy="weak">약한 글자</button><button data-legacy="set">기기 설정</button>'
 +'<button class="ghost" id="v31ParentOut">나가기</button></div><div id="v31Panel"></div>';
}
function parentNav(){
 app.querySelectorAll('[data-v31]').forEach(b=>{
  b.classList.toggle('on',b.dataset.v31===ptab);
  b.onclick=()=>{ptab=b.dataset.v31;parent()};
 });
 app.querySelectorAll('[data-legacy]').forEach(b=>b.onclick=()=>{ptab=b.dataset.legacy;parent()});
 const out=$v('v31ParentOut');if(out)out.onclick=()=>{parentOK=false;ptab='v31setup';go('home')};
}
function settingsPanel(v){
 const s=C.ensure(),opt=s.settings,p=C.scope(),pages=Array.from({length:24},(_,i)=>29+i);
 v.innerHTML='<div class="v31Parent">'
  +'<div class="card"><h2>부모님 한 번 설정하면 끝!</h2><p class="v31Muted">기본값 B안: 음 객관식 6 → 훈·음·한자 쓰기 8 → 부수·획수 6. 통과할 때마다 용돈을 적립해요.</p>'
  +'<button class="sun" id="v31Default">B안 기본값 다시 적용</button></div>'
  +'<div class="card"><h2>1. 교재 쪽수와 마지막 단어</h2>'
  +'<div class="v31Inputs"><label>시작 쪽<select id="v31Start">'+selectPages(p.start)+'</select></label>'
  +'<label>마지막 쪽<select id="v31End">'+selectPages(p.end)+'</select></label>'
  +'<label>끝 쪽의 마지막 단어<select id="v31Last"></select></label></div>'
  +'<div class="v31Info" id="v31ScopePreview" style="margin-top:12px"></div></div>'
  +'<div class="card"><h2>2. 교재 낱말 모음</h2>'
  +'<label class="v31Check"><input id="v31TermLearn" type="checkbox" '+(opt.termLearn?'checked':'')+'>학습 첫 번째 모듈에 넣기</label>'
  +'<label class="v31Check"><input id="v31TermTest" type="checkbox" '+(opt.termTest?'checked':'')+'>테스트 첫 번째 모듈에 넣기</label>'
  +'<div class="v31Inputs"><label>한 번에 보여줄 낱말 수<select id="v31TermShow">'+[4,6,8,10].map(n=>'<option value="'+n+'" '+(n===opt.termDisplay?'selected':'')+'>'+n+'개</option>').join('')+'</select></label>'
  +'<label>읽기 쪽지시험<select id="v31TermN">'+[3,5,6,8,10].map(n=>'<option value="'+n+'" '+(n===opt.termQuizCount?'selected':'')+'>'+n+'문제</option>').join('')+'</select></label>'
  +'<label>모음 평가 범위<select id="v31TermMode"><option value="latest" '+(opt.termPageMode==='latest'?'selected':'')+'>지정한 마지막 쪽 중심</option><option value="all" '+(opt.termPageMode==='all'?'selected':'')+'>지정한 전체 범위</option></select></label></div>'
  +'<div class="v31Guide" style="margin-top:12px">교재에 인쇄된 두 글자 한자어를 사용합니다. 한글 읽기는 한자음으로 구성한 값이므로, 예외 읽기는 ‘낱말 읽기’ 탭에서 부모님이 수정할 수 있습니다.</div></div>'
  +'<div class="card"><h2>3. 단계별 평가와 용돈</h2>'
  +'<div class="v31Info">① 음 고르기 → ② 직접 쓰기 → ③ 부수·획수. 필기 답안은 부모님이 O/X 채점합니다.</div>'
  +'<div class="v31Inputs" style="margin-top:12px"><label>1단계 문제 수<select id="v31N1">'+numOptions(opt.counts.s1)+'</select></label>'
  +'<label>1단계 적립금(원)<input type="number" id="v31W1" min="0" max="10000" step="10" value="'+opt.won.s1+'"></label>'
  +'<label>2단계 문제 수<select id="v31N2">'+numOptions(opt.counts.s2)+'</select></label>'
  +'<label>2단계 적립금(원)<input type="number" id="v31W2" min="0" max="10000" step="10" value="'+opt.won.s2+'"></label>'
  +'<label>3단계 문제 수<select id="v31N3">'+numOptions(opt.counts.s3)+'</select></label>'
  +'<label>3단계 적립금(원)<input type="number" id="v31W3" min="0" max="10000" step="10" value="'+opt.won.s3+'"></label></div>'
  +'<details class="v31Fold" style="margin-top:12px"><summary>통과 기준·상한·모음 보상 상세 설정</summary>'
  +'<div class="v31Inputs" style="padding-bottom:12px"><label>단계별 통과 기준<select id="v31Pass">'+[60,70,80,90,100].map(n=>'<option value="'+n+'" '+(n===opt.passPct?'selected':'')+'>'+n+'%</option>').join('')+'</select></label>'
  +'<label>하루 용돈 적립 상한(원)<input type="number" min="0" max="100000" step="50" id="v31Cap" value="'+opt.dailyCap+'"></label>'
  +'<label>모음 읽기 통과 보너스(원)<input type="number" min="0" max="10000" step="10" id="v31WT" value="'+opt.won.terms+'"></label></div></details>'
  +'<div class="v31Info" style="margin-top:12px">학습 포인트 500P와 용돈(원)은 별도입니다. 같은 단계는 하루 한 번만 적립되며, 실제 입금 기능은 없습니다.</div>'
  +'<button class="pri v31Primary" id="v31SaveSettings">부모 설정 저장하기</button></div></div>';
 function fillLast(){
  const end=+$v('v31End').value,list=wordsOn(end),sel=$v('v31Last');
  sel.innerHTML=list.map(w=>'<option value="'+w.id+'">'+X(w.word)+' ('+X(w.read)+')</option>').join('');
  if(list.some(w=>w.id===p.lastId)&&end===p.end)sel.value=String(p.lastId);
  else if(list.length)sel.value=String(list[list.length-1].id);
  preview();
 }
 function wordsOn(page){return uniqWords(ITEMS.filter(x=>x.detailPage===+page))}
 function preview(){
  const a=Math.min(+$v('v31Start').value,+$v('v31End').value),b=Math.max(+$v('v31Start').value,+$v('v31End').value);
  const last=+$v('v31Last').value,words=C.words({start:a,end:b,lastId:last});
  const terms=C.termPool({start:a,end:b,lastId:last});
  $v('v31ScopePreview').innerHTML='<b>'+a+'~'+b+'쪽 · '+words.length+'개 기본 한자어</b><br>교재 속 두 글자 관련 낱말 '+terms.length+'개';
 }
 $v('v31Start').onchange=()=>{if(+$v('v31Start').value>+$v('v31End').value)$v('v31End').value=$v('v31Start').value;fillLast()};
 $v('v31End').onchange=()=>{if(+$v('v31End').value<+$v('v31Start').value)$v('v31Start').value=$v('v31End').value;fillLast()};
 $v('v31Last').onchange=preview;fillLast();
 $v('v31Default').onclick=()=>{
  if(!confirm('평가 단계·용돈·모음 학습 옵션을 B안 기본값으로 되돌릴까요? 시험범위와 기존 학습기록은 유지됩니다.'))return;
  s.settings=JSON.parse(JSON.stringify(C.DEFS.settings));save();settingsPanel(v);
 };
 $v('v31SaveSettings').onclick=()=>{
  const start=Math.min(+$v('v31Start').value,+$v('v31End').value),end=Math.max(+$v('v31Start').value,+$v('v31End').value),lastId=+$v('v31Last').value;
  const conf=db.exam30Config||{};
  db.exam30Config=Object.assign({},conf,{start,end,lastId});
  const n=x=>Math.max(0,Number($v(x).value)||0);
  s.settings={
   termLearn:$v('v31TermLearn').checked,termTest:$v('v31TermTest').checked,
   termDisplay:n('v31TermShow'),termQuizCount:n('v31TermN'),termPageMode:$v('v31TermMode').value,
   passPct:n('v31Pass'),dailyCap:n('v31Cap'),
   counts:{s1:n('v31N1'),s2:n('v31N2'),s3:n('v31N3')},
   won:{s1:n('v31W1'),s2:n('v31W2'),s3:n('v31W3'),terms:n('v31WT')}
  };
  C.prune();save();toast('교재 범위 · 단계별 평가 · 용돈 설정 저장 완료');settingsPanel(v);
 };
}
function numOptions(cur){return [3,4,5,6,8,10,12,15,20].map(n=>'<option value="'+n+'" '+(n===+cur?'selected':'')+'>'+n+'문제</option>').join('')}
function termAdmin(v,page=null,char=null){
 const p=C.scope(),s=C.ensure(),pages=Array.from({length:p.end-p.start+1},(_,i)=>p.start+i);
 page=page||p.end;
 const source=C.words(p).filter(w=>w.detailPage===+page);
 const rows=new Map();
 for(const w of source)for(const x of T.collection(w))if(!rows.has(x.character))rows.set(x.character,x);
 const all=[...rows.values()];const picked=all.find(x=>x.character===char)||all[0];
 v.innerHTML='<div class="v31Parent"><div class="card"><h2>교재 옆 두 글자 낱말 읽기</h2>'
  +'<p class="v31Muted">한글 읽기는 교재에 별도 표기되지 않았습니다. 기본 음독을 제공하고 부모님이 직접 수정할 수 있습니다.</p>'
  +'<label class="v31Muted">교재 페이지<select id="v31FixPage" style="display:block;width:100%;max-width:230px;margin:6px 0;padding:12px;font-size:20px">'
  +pages.map(n=>'<option value="'+n+'" '+(n===+page?'selected':'')+'>'+n+'쪽</option>').join('')+'</select></label>'
  +'<div class="v31BookTiles">'+all.map(x=>'<button data-char="'+X(x.character)+'" class="'+(picked&&picked.character===x.character?'on':'')+'">'+X(x.character)+'</button>').join('')+'</div>'
  +(picked?'<div class="v31Info">'+X(picked.character)+' · '+X(picked.hun)+' '+X(picked.eum)+' · 두 글자 낱말 '+picked.terms.length+'개</div>'
  +'<div id="v31FixList">'+picked.terms.map((x,i)=>'<div class="v31TermOverride"><b>'+X(x.word)+'</b>'
   +'<input type="text" aria-label="'+X(x.word)+' 읽기" data-term="'+X(x.word)+'" value="'+X(x.reading||'')+'">'
   +'<button class="ghost" data-save="'+i+'">저장</button></div>').join('')+'</div>'
  :'<p>이 페이지에는 낱말이 없습니다.</p>')+'</div></div>';
 $v('v31FixPage').onchange=()=>termAdmin(v,+$v('v31FixPage').value);
 v.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>termAdmin(v,page,b.dataset.char));
 if(picked)v.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{
  const term=picked.terms[+b.dataset.save].word;
  const inp=v.querySelector('input[data-term="'+term+'"]');
  const read=inp.value.replace(/\s+/g,'').trim();
  if(!/^[가-힣]{2,6}$/.test(read))return toast('올바른 한글 읽기를 입력해 주세요');
  s.overrides[term]=read;window.__hanja31ReadingOverrides=s.overrides;
  save();toast(term+' → '+read+' 읽기 수정 완료');
 });
}
function parentGrade(v){
 const runs=C.ensure().runs;
 const pending=runs.filter(r=>r.status==='pending'),all=runs.filter(r=>r.status==='passed'||r.status==='retry_ready');
 const id=Number(C.ensure().gradeId)||0;
 const r=runs.find(x=>x.id===id)||pending[0]||all[0];
 v.innerHTML='<div class="v31Parent"><div class="card"><h2>부모님 필기 답안 채점</h2>'
  +'<p class="v31Muted">객관식은 자동 정오 판정, 필기 답안은 부모님이 O/X로 확인합니다.</p>'
  +'<div class="v31BookTiles">'+pending.map(x=>'<button class="sun" data-grade-id="'+x.id+'">'+X(C.STAGES[x.kind])+' · '+x.day+'</button>').join('')+'</div>'
  +(!pending.length?'<div class="v31Info">현재 채점 대기 답안이 없습니다.</div>':'')
  +'</div><div id="v31GradeBody"></div>'
  +'<details class="v31Fold"><summary>채점 완료·재도전 시험 기록</summary><div class="v31BookTiles">'+all.slice(0,25).map(x=>'<button data-grade-id="'+x.id+'">'+X(C.STAGES[x.kind])+' · '+x.day+' · '+(x.status==='passed'?'통과':'재도전')+'</button>').join('')+'</div></details></div>';
 v.querySelectorAll('[data-grade-id]').forEach(b=>b.onclick=()=>{C.ensure().gradeId=+b.dataset.gradeId;save();parentGrade(v)});
 if(!r)return;
 const graded=r.status==='passed'||r.status==='retry_ready';
 const host=$v('v31GradeBody');host.innerHTML='<div class="card"><h2>'+X(C.STAGES[r.kind])+' · '+r.day+'</h2>'
  +'<div class="v31Progress"><span>문제 수 '+r.items.length+'</span><span>현재 O <b id="v31GradeCount">'+r.items.filter(x=>x.grade===true).length+'</b></span>'
  +'<span>'+(graded?'채점 완료':'필기 채점 진행 중')+'</span></div><div id="v31GradeRows"></div>'
  +(!graded?'<button class="pri v31Primary" id="v31FinishGrade">채점 확정하기</button>':'')
  +'</div>';
 const rows=$v('v31GradeRows');
 r.items.forEach((it,i)=>{
  const row=document.createElement('div');row.className='v31Grade';
  row.innerHTML='<b>'+(i+1)+'</b><div><h3>'+X(labelType(it.type))+' · '+X(it.prompt)+'</h3>'
   +(it.answer?.img?'<img src="'+it.answer.img+'" alt="'+(i+1)+'번 필기 답안">':
     it.mode==='choice'?'<p>선택한 답: '+X(it.answer?.selected||'미선택')+'</p>':'<p>빈 답안</p>')
   +'<p>정답: <strong>'+X(it.expected)+'</strong></p>'
   +(it.mode==='choice'?'<p class="v31Muted">자동 판정: '+(it.grade===true?'O':'X')+'</p>':'')
   +'</div><div class="gbtn">'
   +'<button data-pass="1" class="'+(it.grade===true?'selO':'')+'" '+(graded?'disabled':'')+'>O</button>'
   +'<button data-pass="0" class="'+(it.grade===false?'selX':'')+'" '+(graded?'disabled':'')+'>X</button>'
   +'</div>';
  if(!graded)row.querySelectorAll('[data-pass]').forEach(b=>b.onclick=()=>{
   it.grade=b.dataset.pass==='1';save();
   row.querySelectorAll('[data-pass]').forEach(x=>x.className=x.dataset.pass==='1'?(it.grade?'selO':''):(it.grade===false?'selX':''));
   const summary=v.querySelector('#v31GradeCount');if(summary)summary.textContent=r.items.filter(x=>x.grade===true).length;
  });
  rows.appendChild(row);
 });
 if(!graded)$v('v31FinishGrade').onclick=()=>{
  if(r.items.some(x=>x.grade===null))return toast('남은 필기 답안을 모두 O/X로 표시해 주세요');
  const result=C.finalize(r);
  save();toast(result==='passed'?'단계 통과! 용돈 적립 완료':'재도전 대상 · 틀린 문제만 다시 풀 수 있어요');
  parentGrade(v);
 };
}
function walletPanel(v){
 const s=C.ensure(),val=C.wallet(),list=C.ledger();
 v.innerHTML='<div class="v31Parent"><div class="card"><h2>아이 용돈 적립 장부</h2>'
  +'<p class="v31Muted">실제 계좌 입금이 아닌 앱 내부 기록입니다. 지급 여부는 부모님이 수동으로 표시합니다.</p>'
  +'<div class="v31Wallet"><div>전체 적립<br><strong>'+won(val.total)+'</strong></div>'
  +'<div>아직 안 준 용돈<br><strong>'+won(val.unpaid)+'</strong></div></div>'
  +'<div class="v31Info" style="margin-top:12px">오늘 '+won(val.today)+' 적립 · 하루 상한 '+won(s.settings.dailyCap)+'</div>'
  +'<div id="v31Ledger">'+(list.length?list.map((x,i)=>'<div class="v31Ledger"><span>'+X(x.day)+'</span><span>'+X(x.name)+'<br><b>'+won(x.amount)+'</b></span>'
   +'<button class="'+(x.paid?'ghost':'ok')+'" data-credit="'+i+'">'+(x.paid?'지급 완료':'지급했어요')+'</button></div>').join(''):'<p>아직 적립 기록이 없습니다.</p>')+'</div></div></div>';
 v.querySelectorAll('[data-credit]').forEach(b=>b.onclick=()=>{
  const l=list[+b.dataset.credit];
  if(l.paid){if(!confirm('지급 완료 기록을 취소할까요?'))return;l.paid=false}
  else{if(!confirm(won(l.amount)+'을 아이에게 지급했나요? 실제 송금 기능은 없습니다.'))return;l.paid=true}
  save();walletPanel(v);
 });
}
function install(){
 const prevHome=home,prevParent=parent,prevLogin=parentLogin;
 home=function(){
  prevHome();
  const learn=$v('kidLearn'),test=$v('kidTest');
  if(learn)learn.onclick=learnHub;
  if(test)test.onclick=testHub;
 };
 parentLogin=function(){if(!parentOK)ptab='v31setup';prevLogin()};
 parent=function(){
  if(['v31setup','v31terms','v31grade','v31wallet'].includes(ptab)){
   app.innerHTML=customTabs();parentNav();
   const v=$v('v31Panel');
   if(ptab==='v31setup')return settingsPanel(v);
   if(ptab==='v31terms')return termAdmin(v);
   if(ptab==='v31grade')return parentGrade(v);
   if(ptab==='v31wallet')return walletPanel(v);
  }
  prevParent();
  const tabs=app.querySelector('.tabs');
  if(tabs){
   const custom=[['v31setup','① 평가·용돈 설정'],['v31terms','② 낱말 읽기'],['v31grade','③ 답안 채점'],['v31wallet','용돈 장부']];
   custom.slice().reverse().forEach(([id,label])=>{
    const b=document.createElement('button');b.dataset.v31=id;b.textContent=label;
    b.onclick=()=>{ptab=id;parent()};tabs.insertBefore(b,tabs.firstChild);
   });
   const old=tabs.querySelector('[data-t="exam30"]');if(old)old.textContent='기존 시험';
  }
 };
 // All routes via global header preserve the current pen response first.
 const safe=()=>{if(typeof window.__hanjaActiveWriter==='function')try{window.__hanjaActiveWriter()}catch(e){}};
 ['homeBtn','parentBtn'].forEach(id=>{const el=$v(id);if(el)el.addEventListener('pointerdown',safe,true)});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')safe()});
 window.addEventListener('pagehide',safe);
 // Keep the daily ledger compact; retaining stage results and currency amounts.
 C.prune();
}
window.__hanjaV31UI={learnHub,testHub,termStudy,settingsPanel,parentGrade,walletPanel,install};
install();
})();
