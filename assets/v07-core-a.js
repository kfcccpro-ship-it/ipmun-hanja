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
const KEY='intro_hanja_v02_state';
const GUIDE_OPACITY=[.30,.10,.035,0,0];
const NEXT_ATTEMPT_DELAY=3000;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nowIso=()=>new Date().toISOString();
let STORAGE_OK=true;
function storageGet(k){try{return localStorage.getItem(k)}catch(e){STORAGE_OK=false;return null}}
function storageSet(k,v){try{localStorage.setItem(k,v);STORAGE_OK=true;return true}catch(e){STORAGE_OK=false;return false}}
function loadState(){try{return JSON.parse(storageGet(KEY))||null}catch(e){return null}}
let state=loadState()||{settings:{rangeStart:11,rangeEnd:14,dailyCharacters:10,dailyMinutes:20,penProfile:'auto'},wordProgress:{},characterProgress:{},sessions:[],exams:[],currentLesson:null,deviceChecks:[]};
function normalizeState(){
  const old=state.settings||{};
  state.settings=Object.assign({rangeStart:11,rangeEnd:14,dailyCharacters:old.dailyCharacters??Math.min(20,Math.max(1,(old.dailyWords||5)*2)),dailyMinutes:20,penProfile:'auto'},old);
  state.wordProgress=state.wordProgress||{};state.characterProgress=state.characterProgress||{};state.sessions=state.sessions||[];state.exams=state.exams||[];state.deviceChecks=state.deviceChecks||[];
  for(const w of WORDS){const p=state.wordProgress[w.id]||{};p.completed=p.completed||0;p.reviewDebt=p.reviewDebt||0;p.wrongRead=p.wrongRead||0;p.wrongWrite=p.wrongWrite||0;p.fastOk=p.fastOk||0;p.fastNg=p.fastNg||0;state.wordProgress[w.id]=p}
  for(const ch of Object.keys(CHAR_INFO)){const p=state.characterProgress[ch]||{};p.completed=p.completed||0;state.characterProgress[ch]=p}
  if(state.currentLesson&&!Array.isArray(state.currentLesson.plannedCharacters))state.currentLesson=null;
  if(state.currentLesson){state.currentLesson.charWork=state.currentLesson.charWork||{};state.currentLesson.completedCharacters=state.currentLesson.completedCharacters||[];for(const ch of state.currentLesson.plannedCharacters)ensureCharWork(ch)}
}
function ensureCharWork(ch){if(!state.currentLesson)return null;let cw=state.currentLesson.charWork[ch];if(!cw){cw={strokes:[[],[],[],[],[]],completedAttempts:0,unlockAt:0,hunInput:'',eumInput:'',hunOk:false,eumOk:false,completed:false};state.currentLesson.charWork[ch]=cw}cw.strokes=Array.from({length:5},(_,i)=>Array.isArray(cw.strokes?.[i])?cw.strokes[i]:[]);cw.completedAttempts=Math.min(5,Math.max(0,cw.completedAttempts||0));return cw}
normalizeState();
function saveState(){return storageSet(KEY,JSON.stringify(state))}
function fmtDate(iso){const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtTime(iso){const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function fmtDur(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function pagesFor(w){return [w.mainPage,w.detailPage]}
function rangePool(a=state.settings.rangeStart,b=state.settings.rangeEnd){const lo=Math.min(a,b),hi=Math.max(a,b);return WORDS.filter(w=>pagesFor(w).some(p=>p>=lo&&p<=hi));}
function rangeCharacterPool(a=state.settings.rangeStart,b=state.settings.rangeEnd){const m=new Map();for(const w of rangePool(a,b)){for(const d of w.characterDetails){if(!m.has(d.char)){const info=CHAR_INFO[d.char]||{char:d.char,hun:'',eum:''};m.set(d.char,{...info,strokeCount:d.strokeCount,sourcePrintedPage:d.sourcePrintedPage,order:w.order,wordIds:[],examples:[]})}const x=m.get(d.char);if(!x.wordIds.includes(w.id))x.wordIds.push(w.id);if(!x.examples.some(e=>e.id===w.id))x.examples.push({id:w.id,hanja:w.hanja,reading:w.reading,mainPage:w.mainPage});}}return [...m.values()]}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
function uid(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function normKo(s){return String(s??'').replace(/\s+/g,'').trim()}
function charReviewDebt(info){return Math.max(0,...info.wordIds.map(id=>state.wordProgress[id]?.reviewDebt||0))}

const PEN_PROFILES={auto:{label:'자동',minWidth:2.2,maxWidth:6.0,gamma:.92},apple1:{label:'iPad · Apple Pencil 1세대',minWidth:2.4,maxWidth:6.6,gamma:.82},spen:{label:'Galaxy Tab · S Pen',minWidth:2.0,maxWidth:5.4,gamma:1.0}};
const PEN_TELEMETRY={seenPen:false,lastType:'',minPressure:1,maxPressure:0,penSamples:0,touchRejected:0,coalescedSupported:false,lastSampleTs:null,gapSum:0,gapCount:0,maxGap:0,orientationChanges:0,lastOrientation:null,statusRaf:0};
function detectEnvironment(){const ua=navigator.userAgent||'';if(/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return 'iPad · Safari/WebKit';if(/SM-|Samsung/i.test(ua)&&/Android/i.test(ua))return 'Galaxy · Android';if(/Android/i.test(ua))return 'Android 태블릿';return 'PC/기타'}
function effectivePenProfile(){const chosen=state?.settings?.penProfile||'auto';if(chosen!=='auto')return chosen;const env=detectEnvironment();if(env.startsWith('iPad'))return 'apple1';if(env.startsWith('Galaxy'))return 'spen';return 'auto'}
function penTuning(){return PEN_PROFILES[effectivePenProfile()]||PEN_PROFILES.auto}
function schedulePenStatus(){if(PEN_TELEMETRY.statusRaf)return;PEN_TELEMETRY.statusRaf=requestAnimationFrame(()=>{PEN_TELEMETRY.statusRaf=0;try{renderPenStatus()}catch(_){ }try{renderDeviceCheckMetrics()}catch(_){ }})}
function notePointer(e,coalesced=false){PEN_TELEMETRY.lastType=e.pointerType||'unknown';if(e.pointerType==='touch'){PEN_TELEMETRY.touchRejected++;schedulePenStatus();return}if(e.pointerType==='pen'){PEN_TELEMETRY.seenPen=true;PEN_TELEMETRY.penSamples++;const p=Number.isFinite(e.pressure)?e.pressure:0;if(p>0){PEN_TELEMETRY.minPressure=Math.min(PEN_TELEMETRY.minPressure,p);PEN_TELEMETRY.maxPressure=Math.max(PEN_TELEMETRY.maxPressure,p)}if(coalesced)PEN_TELEMETRY.coalescedSupported=true;const ts=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();if(PEN_TELEMETRY.lastSampleTs!==null){const gap=Math.max(0,ts-PEN_TELEMETRY.lastSampleTs);if(gap<1000){PEN_TELEMETRY.gapSum+=gap;PEN_TELEMETRY.gapCount++;PEN_TELEMETRY.maxGap=Math.max(PEN_TELEMETRY.maxGap,gap)}}PEN_TELEMETRY.lastSampleTs=ts}schedulePenStatus()}
