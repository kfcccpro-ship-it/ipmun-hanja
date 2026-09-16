window.__HANJA_JS_STARTED__=true;
function compatSet(kind,badge,msg){
  var b=document.getElementById('compatBanner');
  var bd=document.getElementById('compatBadge');
  var m=document.getElementById('compatMessage');
  if(!b||!bd||!m)return;
  b.className='compatBanner'+(kind?' '+kind:'');bd.textContent=badge;m.textContent=msg;
}
function launchContext(){
  var ua=navigator.userAgent||'';
  var proto=location.protocol||'';
  return {ua:ua,proto:proto,kakao:/KAKAOTALK/i.test(ua),pointer:typeof window.PointerEvent!=='undefined',web:(proto==='http:'||proto==='https:')};
}
function renderCompatStatus(){
  var c=launchContext();
  if(!c.pointer){compatSet('error','펜 API 없음','이 실행 환경에서는 Pointer Events를 사용할 수 없습니다. Apple Pencil은 Safari, S Pen은 Chrome에서 열어 주세요.');return;}
  if(!c.web){compatSet('temp','첨부/로컬 열기','현재는 '+(c.proto||'알 수 없는')+' 방식으로 열렸습니다. 메뉴가 움직이지 않거나 펜 입력이 안 되면 파일 자체 문제가 아니라 첨부파일 뷰어 제한일 가능성이 큽니다. HTML 파일을 첨부하지 말고 HTTPS 웹주소를 카카오톡으로 보내고, iPad는 Safari·Galaxy Tab은 Chrome에서 여세요.');return;}
  if(c.kakao){compatSet('temp','카카오 인앱','웹주소로 열렸지만 카카오톡 내부 브라우저입니다. 메뉴는 사용할 수 있어도 Apple Pencil/S Pen 실기 검수는 외부 Safari/Chrome에서 진행하는 것을 권장합니다.');return;}
  if(!STORAGE_OK){compatSet('temp','임시 모드','브라우저 저장소가 차단되어 기록은 저장되지 않습니다. 필기 테스트는 가능하지만 학습 기록을 남기려면 Safari/Chrome의 일반 탭에서 다시 열어 주세요.');return;}
  compatSet('ok','정상','Safari/Chrome 일반 웹환경과 Pointer Events가 확인되었습니다.');
}
window.addEventListener('error',function(e){compatSet('error','실행 오류','JavaScript 실행 중 오류가 발생했습니다: '+(e&&e.message?e.message:'알 수 없는 오류'));});
window.addEventListener('unhandledrejection',function(){compatSet('error','실행 오류','브라우저가 일부 앱 기능을 차단했습니다. Safari/Chrome 일반 탭에서 다시 열어 주세요.');});


const WORDS=DATA.words;
const CHECK_LABELS=['범위 확인','단어 읽기','획수 확인','보고 쓰기','가리고 쓰기','읽기 회상','쓰기 회상','패스트 점검'];
const KEY='intro_hanja_v02_state';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nowIso=()=>new Date().toISOString();
let STORAGE_OK=true;
function storageGet(k){try{return localStorage.getItem(k)}catch(e){STORAGE_OK=false;return null}}
function storageSet(k,v){try{localStorage.setItem(k,v);STORAGE_OK=true;return true}catch(e){STORAGE_OK=false;return false}}
function loadState(){try{return JSON.parse(storageGet(KEY))||null}catch(e){return null}}
let state=loadState()||{settings:{rangeStart:11,rangeEnd:14,dailyWords:5,dailyMinutes:20,penProfile:'auto'},wordProgress:{},sessions:[],exams:[],currentLesson:null,deviceChecks:[]};
function normalizeState(){state.settings=Object.assign({rangeStart:11,rangeEnd:14,dailyWords:5,dailyMinutes:20,penProfile:'auto'},state.settings||{});state.wordProgress=state.wordProgress||{};state.sessions=state.sessions||[];state.exams=state.exams||[];state.deviceChecks=state.deviceChecks||[];for(const w of WORDS){const p=state.wordProgress[w.id]||{};p.completed=p.completed||0;p.reviewDebt=p.reviewDebt||0;p.wrongRead=p.wrongRead||0;p.wrongWrite=p.wrongWrite||0;p.fastOk=p.fastOk||0;p.fastNg=p.fastNg||0;state.wordProgress[w.id]=p}if(state.currentLesson){state.currentLesson.practiceStrokes=state.currentLesson.practiceStrokes||{};state.currentLesson.practiceStrokeMatch=state.currentLesson.practiceStrokeMatch||{};state.currentLesson.strokeCheckedWordIds=state.currentLesson.strokeCheckedWordIds||[];state.currentLesson.completedWordIds=state.currentLesson.completedWordIds||[];state.currentLesson.checks=Object.assign(Object.fromEntries(CHECK_LABELS.map(x=>[x,false])),state.currentLesson.checks||{})}}
normalizeState();
function saveState(){return storageSet(KEY,JSON.stringify(state))}
function fmtDate(iso){const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtTime(iso){const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function fmtDur(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function pagesFor(w){return [w.mainPage,w.detailPage]}
function rangePool(a=state.settings.rangeStart,b=state.settings.rangeEnd){const lo=Math.min(a,b),hi=Math.max(a,b);return WORDS.filter(w=>pagesFor(w).some(p=>p>=lo&&p<=hi));}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function uid(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}

const PEN_PROFILES={
  auto:{label:'자동',minWidth:2.2,maxWidth:6.0,gamma:.92},
  apple1:{label:'iPad · Apple Pencil 1세대',minWidth:2.4,maxWidth:6.6,gamma:.82},
  spen:{label:'Galaxy Tab · S Pen',minWidth:2.0,maxWidth:5.4,gamma:1.0}
};
const PEN_TELEMETRY={seenPen:false,lastType:'',minPressure:1,maxPressure:0,penSamples:0,touchRejected:0,coalescedSupported:false,lastSampleTs:null,gapSum:0,gapCount:0,maxGap:0,orientationChanges:0,lastOrientation:null,statusRaf:0};
function detectEnvironment(){const ua=navigator.userAgent||'';if(/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return 'iPad · Safari/WebKit';if(/SM-|Samsung/i.test(ua)&&/Android/i.test(ua))return 'Galaxy · Android';if(/Android/i.test(ua))return 'Android 태블릿';return 'PC/기타'}
function effectivePenProfile(){const chosen=state?.settings?.penProfile||'auto';if(chosen!=='auto')return chosen;const env=detectEnvironment();if(env.startsWith('iPad'))return 'apple1';if(env.startsWith('Galaxy'))return 'spen';return 'auto'}
function penTuning(){return PEN_PROFILES[effectivePenProfile()]||PEN_PROFILES.auto}
function schedulePenStatus(){if(PEN_TELEMETRY.statusRaf)return;PEN_TELEMETRY.statusRaf=requestAnimationFrame(()=>{PEN_TELEMETRY.statusRaf=0;try{renderPenStatus()}catch(_){ }try{renderDeviceCheckMetrics()}catch(_){ }})}
function notePointer(e,coalesced=false){PEN_TELEMETRY.lastType=e.pointerType||'unknown';if(e.pointerType==='touch'){PEN_TELEMETRY.touchRejected++;schedulePenStatus();return}if(e.pointerType==='pen'){PEN_TELEMETRY.seenPen=true;PEN_TELEMETRY.penSamples++;const p=Number.isFinite(e.pressure)?e.pressure:0;if(p>0){PEN_TELEMETRY.minPressure=Math.min(PEN_TELEMETRY.minPressure,p);PEN_TELEMETRY.maxPressure=Math.max(PEN_TELEMETRY.maxPressure,p)}if(coalesced)PEN_TELEMETRY.coalescedSupported=true;const ts=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();if(PEN_TELEMETRY.lastSampleTs!==null){const gap=Math.max(0,ts-PEN_TELEMETRY.lastSampleTs);if(gap<1000){PEN_TELEMETRY.gapSum+=gap;PEN_TELEMETRY.gapCount++;PEN_TELEMETRY.maxGap=Math.max(PEN_TELEMETRY.maxGap,gap)}}PEN_TELEMETRY.lastSampleTs=ts}schedulePenStatus()}
class DrawingPad{
  constructor(canvas,initial=[],opts={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.opts=Object.assign({expectedStrokes:null,onChange:null,allowMouse:true},opts);this.strokes=JSON.parse(JSON.stringify(initial||[]));this.current=null;this.active=false;this.activePointer=null;this.pendingResize=0;this.resize();this.bind();this.redraw();}
  resize(){const r=this.canvas.getBoundingClientRect();if(r.width<8||r.height<8)return;const dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.floor(r.width*dpr));this.canvas.height=Math.max(1,Math.floor(r.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);this.cssW=r.width;this.cssH=r.height;this.redraw();}
  bind(){
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();notePointer(e);return}if(e.pointerType==='mouse'&&!this.opts.allowMouse)return;if(e.pointerType==='mouse'&&e.button!==0)return;if(this.active)return;e.preventDefault();notePointer(e);try{this.canvas.setPointerCapture?.(e.pointerId)}catch(_){};this.active=true;this.activePointer=e.pointerId;this.current=[];this.strokes.push(this.current);const added=this.addPoint(e,true);if(added)this.drawDot(added)});
    this.canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'){if(this.active)e.preventDefault();return}if(!this.active||e.pointerId!==this.activePointer)return;e.preventDefault();this.addEvent(e)});
    const end=e=>{if(!this.active||e.pointerId!==this.activePointer)return;e.preventDefault();this.active=false;this.activePointer=null;this.current=null;try{this.canvas.releasePointerCapture?.(e.pointerId)}catch(_){};this.notify()};
    this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('lostpointercapture',e=>{if(this.active&&e.pointerId===this.activePointer){this.active=false;this.activePointer=null;this.current=null;this.notify()}});
    if(window.ResizeObserver){this.ro=new ResizeObserver(()=>{cancelAnimationFrame(this.pendingResize);this.pendingResize=requestAnimationFrame(()=>this.resize())});this.ro.observe(this.canvas)}
  }
  eventList(e){if(typeof e.getCoalescedEvents==='function'){try{const xs=e.getCoalescedEvents();if(xs&&xs.length){PEN_TELEMETRY.coalescedSupported=true;return xs}}catch(_){}}return [e]}
  addEvent(e){const list=this.eventList(e);for(const ev of list){notePointer(ev,list.length>1);const prev=this.current?.length?this.current[this.current.length-1]:null;const p=this.addPoint(ev,false);if(p&&prev)this.drawSegment(prev,p)}}
  addPoint(e,start){const r=this.canvas.getBoundingClientRect();const pressure=(e.pointerType==='pen'&&Number.isFinite(e.pressure)&&e.pressure>0)?e.pressure:.5;const p={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,pressure,pt:e.pointerType||'unknown',t:Date.now()};if(!start&&this.current?.length){const q=this.current[this.current.length-1];if(Math.hypot(p.x-q.x,p.y-q.y)<.0012)return null}this.current.push(p);return p}
  widthFor(p,pt){if(pt==='mouse')return 3.2;const t=penTuning();const v=Math.pow(Math.max(.08,Math.min(1,p||.5)),t.gamma);return t.minWidth+(t.maxWidth-t.minWidth)*v}
  prep(){const c=this.ctx;c.lineCap='round';c.lineJoin='round';c.strokeStyle='#161b22';c.fillStyle='#161b22'}
  drawDot(p){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight;if(!w||!h)return;this.prep();const r=this.widthFor(p.pressure,p.pt)/2;this.ctx.beginPath();this.ctx.arc(p.x*w,p.y*h,r,0,Math.PI*2);this.ctx.fill()}
  drawSegment(a,b){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight;if(!w||!h)return;this.prep();const c=this.ctx;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.lineWidth=this.widthFor((a.pressure+b.pressure)/2,b.pt||a.pt);c.stroke()}
  redraw(){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight,c=this.ctx;if(!w||!h)return;c.fillStyle='#fff';c.fillRect(0,0,w,h);for(const st of this.strokes){if(!st.length)continue;if(st.length===1){this.drawDot(st[0]);continue}for(let i=1;i<st.length;i++)this.drawSegment(st[i-1],st[i])}}
  notify(){this.opts.onChange?.(this)}
  clear(){this.strokes=[];this.current=null;this.active=false;this.activePointer=null;this.redraw();this.notify()}
  undo(){if(this.strokes.length){this.strokes.pop();this.redraw();this.notify()}}
  strokeCount(){return this.strokes.filter(st=>st&&st.length).length}
  data(){return this.strokes.filter(st=>st.length).map(st=>st.map(p=>({x:+p.x.toFixed(4),y:+p.y.toFixed(4),pressure:+(p.pressure||.5).toFixed(3),pt:p.pt||undefined})))}
}
const pads=new Map();
function makePad(canvas,initial=[],opts={}){const p=new DrawingPad(canvas,initial,opts);pads.set(canvas.id,p);return p}

function renderHome(){const s=state.settings;const wrong=rangePool().filter(w=>(state.wordProgress[w.id]?.reviewDebt||0)>0).length;$('#homeLine').textContent=`오늘은 ${s.dailyWords}단어만 해보자`;$('#homeStudySub').textContent=`${s.dailyWords}단어 · ${s.dailyWords*2}글자 · ${s.dailyMinutes}분`;$('#homeRange').textContent=`교재 ${s.rangeStart}~${s.rangeEnd}쪽`;$('#homeWrong').textContent=`다시 볼 단어 ${wrong}개`;$('#homeFastSub').textContent=wrong?`틀린 것 ${wrong}개부터 점검`:'읽기 · 쓰기 · 획수';$('#homeStudyLabel').textContent=state.currentLesson?.startedAt&&!state.currentLesson?.endedAt?'오늘 공부 이어서':'오늘 공부'}
function switchView(name){document.body.classList.toggle('homeMode',name==='home');$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));if(name==='home')renderHome();if(name==='today')renderToday();if(name==='fast')renderFastIdle();if(name==='exam')renderExam();if(name==='records')renderRecords();if(name==='parent'){renderParent();renderGrading();setupPenTest();setupDeviceCheck();}}
$$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));$('#parentQuickBtn').addEventListener('click',()=>switchView('parent'));$('#parentHeaderBtn').addEventListener('click',()=>switchView('parent'));

function getDailyPlan(){const pool=rangePool();const n=Math.min(state.settings.dailyWords,pool.length);return [...pool].sort((a,b)=>{const da=state.wordProgress[a.id]?.reviewDebt||0,db=state.wordProgress[b.id]?.reviewDebt||0;if(db!==da)return db-da;const pa=state.wordProgress[a.id]?.completed||0,pb=state.wordProgress[b.id]?.completed||0;return pa-pb||a.order-b.order}).slice(0,n)}
function ensureLessonPlan(force=false){if(state.currentLesson&&!force){state.currentLesson.practiceStrokes=state.currentLesson.practiceStrokes||{};state.currentLesson.practiceStrokeMatch=state.currentLesson.practiceStrokeMatch||{};return}const plan=getDailyPlan();state.currentLesson={id:uid('lesson'),plannedWordIds:plan.map(w=>w.id),startedAt:null,endedAt:null,completedWordIds:[],strokeCheckedWordIds:[],practiceStrokes:{},practiceStrokeMatch:{},checks:Object.fromEntries(CHECK_LABELS.map(x=>[x,false]))};saveState()}
function lessonWords(){ensureLessonPlan();return state.currentLesson.plannedWordIds.map(id=>WORDS.find(w=>w.id===id)).filter(Boolean)}

let timerHandle=null;
function renderToday(){ensureLessonPlan();const ws=lessonWords();$('#todayGoalWords').textContent=`${ws.length}단어`;$('#todayGoalChars').textContent=`${ws.length*2}자`;$('#todayGoalMin').textContent=`${state.settings.dailyMinutes}분`;$('#lessonRangeChip').textContent=`교재 ${state.settings.rangeStart}~${state.settings.rangeEnd}쪽`;$('#lessonWordChip').textContent=`${ws.length}단어 · ${ws.length*2}자`;$('#topRange').textContent=`교재 ${state.settings.rangeStart}~${state.settings.rangeEnd}쪽`;
  renderChecks();renderWordCards(ws);updateLessonStats();
}
function renderChecks(){const box=$('#lessonChecks');box.innerHTML='';CHECK_LABELS.forEach(l=>{const el=document.createElement('label');el.className='checkItem';el.innerHTML=`<input type="checkbox" ${state.currentLesson.checks[l]?'checked':''}><span>${l}</span>`;const inp=el.querySelector('input');inp.addEventListener('change',()=>{state.currentLesson.checks[l]=inp.checked;saveState();updateLessonStats()});box.appendChild(el)});}
function meterClass(n,expected){return n===expected?'match':n>expected?'over':''}
function meterText(n,expected){return `내가 쓴 획 ${n} / 정답 ${expected}획`}
function renderWordCards(ws){pads.clear();const box=$('#todayWords');box.innerHTML='';if(!ws.length){box.innerHTML='<div class="empty">현재 범위에서 학습할 단어가 없습니다.</div>';return}ws.forEach(w=>{const done=state.currentLesson.completedWordIds.includes(w.id),strokeDone=state.currentLesson.strokeCheckedWordIds.includes(w.id);const c=document.createElement('article');c.className='wordCard';const def=w.sourceDefinitionStatus==='verified'&&w.sourceDefinition?`<div class="small muted">${esc(w.sourceDefinition)}</div>`:'';c.innerHTML=`<div class="wordTop"><div><div class="hanjaWord">${w.hanja}</div><div class="reading">${w.reading}</div></div><span class="chip">교재 ${w.mainPage}쪽</span></div><div class="strokeRow">${w.characterDetails.map(x=>`<span class="charStroke"><b>${x.char}</b><span>${x.strokeCount}획</span></span>`).join('')}</div><div class="totalStroke">두 글자 합계 ${w.totalStrokeCount}획</div>${def}<div class="wordChecks"><label><input class="strokeCheck" type="checkbox" ${strokeDone?'checked':''}> 획수 봤어요</label><label><input class="wordDone" type="checkbox" ${done?'checked':''}> 이 단어 끝</label></div><div class="pads">${w.characterDetails.map((x,i)=>`<div class="padWrap"><div class="padLabel">${x.char} · 정답 ${x.strokeCount}획</div><div class="guideChar">${x.char}</div><canvas id="practice_${w.id}_${i}" class="drawCanvas"></canvas><div class="strokeMeter" id="meter_${w.id}_${i}">내가 쓴 획 0 / 정답 ${x.strokeCount}획</div><div class="padTools"><button class="miniBtn guideBtn">가이드 켜짐</button><button class="miniBtn undoBtn">한 획 되돌리기</button><button class="miniBtn clearBtn">지우기</button></div></div>`).join('')}</div>`;
      c.querySelector('.strokeCheck').addEventListener('change',e=>{const arr=state.currentLesson.strokeCheckedWordIds;state.currentLesson.strokeCheckedWordIds=e.target.checked?[...new Set([...arr,w.id])]:arr.filter(x=>x!==w.id);if(state.currentLesson.strokeCheckedWordIds.length===ws.length)state.currentLesson.checks['획수 확인']=true;saveState();renderChecks();updateLessonStats()});
      c.querySelector('.wordDone').addEventListener('change',e=>{const arr=state.currentLesson.completedWordIds;state.currentLesson.completedWordIds=e.target.checked?[...new Set([...arr,w.id])]:arr.filter(x=>x!==w.id);saveState();updateLessonStats()});
      box.appendChild(c);
      const cvs=[...c.querySelectorAll('canvas')],meters=[...c.querySelectorAll('.strokeMeter')];
      cvs.forEach((cv,i)=>{const key=`${w.id}_${i}`,expected=w.characterDetails[i].strokeCount,meter=meters[i],initial=state.currentLesson.practiceStrokes[key]||[];const update=(pad,doSave=true)=>{const n=pad.strokeCount();meter.textContent=meterText(n,expected);meter.className=`strokeMeter ${meterClass(n,expected)}`.trim();if(doSave){state.currentLesson.practiceStrokes[key]=pad.data();if(n>0)state.currentLesson.practiceStrokeMatch[key]=n===expected;else delete state.currentLesson.practiceStrokeMatch[key];saveState();updateLessonStats()}};const pad=makePad(cv,initial,{expectedStrokes:expected,onChange:p=>update(p,true)});update(pad,false)});
      c.querySelectorAll('.clearBtn').forEach((b,i)=>b.addEventListener('click',()=>pads.get(cvs[i].id).clear()));c.querySelectorAll('.undoBtn').forEach((b,i)=>b.addEventListener('click',()=>pads.get(cvs[i].id).undo()));c.querySelectorAll('.guideBtn').forEach((b,i)=>b.addEventListener('click',()=>{const g=c.querySelectorAll('.guideChar')[i];const off=g.style.display==='none';g.style.display=off?'flex':'none';b.textContent=off?'가이드 켜짐':'가이드 꺼짐'}));
  });}
