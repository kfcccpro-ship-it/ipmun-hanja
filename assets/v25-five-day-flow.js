(function(){
  'use strict';

  const FIVE_DAYS=5;
  const SET2_DAILY_WORDS=20;
  const MAX_SET1_WORDS=10;

  function isoAdd(iso,n){
    const d=new Date(iso+'T12:00:00');
    d.setDate(d.getDate()+n);
    return d.toLocaleDateString('sv-SE');
  }
  function daysBetween(a,b){
    const A=new Date(a+'T12:00:00'),B=new Date(b+'T12:00:00');
    return Math.round((B-A)/86400000);
  }
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }
  function ensureV25(){
    db.fiveDayPlan=db.fiveDayPlan||null;
    db.dailySetPlans=db.dailySetPlans||{};
    db.dailyLearnedWords=db.dailyLearnedWords||{};
    db.surpriseTests=db.surpriseTests||[];
    db.v25=db.v25||{};
    db.points=db.points||{total:0,days:{}};
    db.points.days=db.points.days||{};
  }
  function planKey(p){
    return p?[p.start,p.end,(p.set1WordIds||[]).join(','),p.set2EndPage,p.set2EndWordId].join('|'):'';
  }
  function activePlan(date=today()){
    ensureV25();
    const p=db.fiveDayPlan;
    return p&&p.start&&p.end&&p.start<=date&&date<=p.end?p:null;
  }
  function cycleDay(p=activePlan(),date=today()){
    return p?daysBetween(p.start,date)+1:0;
  }
  function set1Words(p=activePlan()){
    return (p?.set1WordIds||[]).map(byId).filter(Boolean);
  }
  function cumulativeWords(p=activePlan()){
    if(!p)return [];
    const endPage=Math.max(29,Math.min(52,+p.set2EndPage||29));
    let list=uniqWords(ITEMS.filter(function(d){return d.detailPage>=29&&d.detailPage<=endPage}));
    if(p.set2EndWordId){
      const ix=list.findIndex(function(w){return w.id===+p.set2EndWordId});
      if(ix>=0)list=list.slice(0,ix+1);
    }
    return list;
  }
  function baseWord(id){
    const d=byId(+id);
    return d&&byId(d.id%2===0?d.id-1:d.id);
  }
  function selectSet2(pool,count=SET2_DAILY_WORDS){
    pool=uniqWords(pool);
    if(!pool.length)return [];
    const poolIds=new Set(pool.map(function(w){return w.id}));
    const wrong=uniqWords(Object.entries(db.wrong||{}).sort(function(a,b){return b[1]-a[1]})
      .map(function(x){return baseWord(+x[0])})
      .filter(function(w){return w&&poolIds.has(w.id)}));
    const recent=pool.slice(-Math.min(12,pool.length));
    const out=[];
    wrong.slice(0,Math.min(8,count)).forEach(function(w){if(!out.some(function(x){return x.id===w.id}))out.push(w)});
    let recentN=0;
    shuffle(recent).forEach(function(w){
      if(out.length<count&&recentN<8&&!out.some(function(x){return x.id===w.id})){out.push(w);recentN++}
    });
    shuffle(pool).forEach(function(w){
      if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w);
    });
    return out.slice(0,Math.min(count,pool.length));
  }
  function getDailyPlan(create=true,date=today()){
    ensureV25();
    const p=activePlan(date);
    if(!p)return null;
    const key=planKey(p);
    let d=db.dailySetPlans[date];
    if((!d||d.planKey!==key)&&create){
      const s1=set1Words(p),s2=selectSet2(cumulativeWords(p),SET2_DAILY_WORDS);
      d={
        date,planKey:key,
        set1:{wordIds:s1.map(function(w){return w.id}),studyIndex:0,learnDone:false,quizDone:false,quizState:null},
        set2:{wordIds:s2.map(function(w){return w.id}),studyIndex:0,learnDone:false,quizDone:false,quizState:null},
        createdAt:Date.now()
      };
      db.dailySetPlans[date]=d;
      save();
    }
    return d&&d.planKey===key?d:null;
  }
  function learnedBucket(date=today()){
    ensureV25();
    db.dailyLearnedWords[date]=db.dailyLearnedWords[date]||{set1:[],set2:[]};
    return db.dailyLearnedWords[date];
  }
  function recordLearned(setKey,w,date=today()){
    const b=learnedBucket(date),a=b[setKey]||(b[setKey]=[]);
    if(!a.includes(w.id))a.push(w.id);
    db.days[date]=db.days[date]||[];
    charsOf(w).forEach(function(c){
      if(!db.learned.includes(c.id))db.learned.push(c.id);
      if(!db.days[date].includes(c.id))db.days[date].push(c.id);
    });
    save();
  }
  function manualPool(date=today()){
    const b=learnedBucket(date),ids=[...(b.set1||[]),...(b.set2||[])];
    return uniqWords(ids.map(byId).filter(Boolean));
  }
  function award500(date=today()){
    ensureV25();
    const d=db.dailySetPlans[date];
    if(!d||!d.set1.quizDone||!d.set2.quizDone||db.points.days[date])return false;
    db.points.days[date]=500;
    db.points.total=(db.points.total||0)+500;
    save();
    return true;
  }
  function statusText(st,total){
    if(st.quizDone)return '완료';
    if(st.learnDone)return '학습 완료 · 쪽지시험 남음';
    if(st.studyIndex)return '학습 '+st.studyIndex+'/'+total+' 이어하기';
    return '학습 시작';
  }

  const style=document.createElement('style');
  style.id='v25-style';
  style.textContent=`
    .v25Hero{border:2px solid var(--line);background:linear-gradient(135deg,#fff 0%,var(--paper) 100%)}
    .v25Kicker{font-family:'Jua';font-size:18px;color:var(--seal)}
    .v25Day{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:#fff;border:1px solid var(--line);font-family:'Jua'}
    .v25Cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .v25Set{position:relative;overflow:hidden}
    .v25Set h2{margin:0 0 5px}.v25Set .num{font-family:'Jua';font-size:42px;color:var(--seal);opacity:.16;position:absolute;right:16px;top:6px}
    .v25Status{font-family:'Jua';font-size:17px;margin:10px 0;padding:8px 10px;border-radius:10px;background:var(--paper)}
    .v25Status.done{color:var(--leaf)}
    .v25Locked{opacity:.58}
    .v25PlanSummary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .v25PlanSummary span{padding:7px 10px;border-radius:999px;background:var(--paper);border:1px solid var(--line);font-family:'Jua'}
    .v25Page{margin-top:10px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
    .v25Page summary{cursor:pointer;padding:10px 12px;font-family:'Jua';font-size:18px}
    .v25PickGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 10px 10px}
    .v25Pick{display:grid;gap:2px;padding:9px;border:1px solid var(--line);border-radius:10px;background:#fff;text-align:center}
    .v25Pick.on{outline:3px solid #E8B85D;background:#FFF8E4}
    .v25Pick .hz{font-size:24px}.v25Pick small{color:var(--sub)}
    .v25StudyChars{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:10px 0}
    .v25StudyChars>div{display:grid;justify-items:center;gap:5px}
    .v25StudyWord{text-align:center;font-family:var(--hanja);font-size:56px;font-weight:800}
    .v25QuizCard{text-align:center}.v25QuizCard .wordRead{font-size:52px}
    .v25Surprise{border:3px solid #E8B85D;background:#FFF8E4}
    .v25SurpriseList{display:grid;gap:10px}
    .v25GradeRow{display:grid;grid-template-columns:42px minmax(150px,1fr) minmax(180px,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
    .v25GradeRow img{max-width:220px;width:100%;background:#fff;border:1px solid var(--line);border-radius:8px}
    @media(max-width:760px){.v25Cards{grid-template-columns:1fr}.v25PickGrid{grid-template-columns:repeat(2,1fr)}.v25GradeRow{grid-template-columns:34px 1fr}.v25GradeRow .gbtn{grid-column:1/-1}.v25GradeRow img{max-width:100%}}
  `;
  document.head.appendChild(style);

  home=function(){
    ensureV25();
    const p=activePlan(),d=p?getDailyPlan(true):null,day=cycleDay(p),s1=p?set1Words(p):[],pool=p?cumulativeWords(p):[];
    const pending=db.surpriseTests.filter(function(x){return x.date===today()&&(x.status==='ready'||x.status==='in_progress')}).sort(function(a,b){return b.id-a.id})[0];
    const done=!!(d&&d.set1.quizDone&&d.set2.quizDone);
    app.innerHTML=`
      <div class="card v25Hero">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:14px">
          <div><div class="v25Kicker">학원 수업·쪽지시험 대비</div><h1 style="margin:5px 0 6px">오늘도 한자 공부 시작!</h1>
          <p class="muted" style="margin:0">하루는 <b>1세트 복습 → 2세트 실전 대비</b> 순서로 진행합니다.</p></div>
          <div style="text-align:right">${p?`<span class="v25Day">D${day} / D5</span><div class="muted" style="margin-top:6px">${p.start} ~ ${p.end}</div>`:'<span class="pill wait">부모 설정 필요</span>'}</div>
        </div>
        ${done?`<p class="okMsg" style="margin:12px 0 0">두 세트 완료 · 오늘 500P ${db.points.days[today()]?'적립 완료':'적립 확인 중'}</p>`:''}
      </div>
      ${pending?`<div class="card v25Surprise" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><h2 style="margin:0">깜짝 쪽지시험 도착</h2><p style="margin:5px 0 0">${pending.wordIds.length}문제 · 오늘 공부한 단어에서 부모님이 직접 골랐어요.</p></div><span class="big">📝</span></div><button class="sun big" id="v25SurpriseStart">지금 시험 보기</button></div>`:''}
      ${p?`<div class="v25Cards">
        <div class="card v25Set"><span class="num">1</span><h2>① 이번 주 복습 세트</h2><p class="muted">부모가 고른 ${s1.length}단어를 5일 동안 반복합니다.</p>
          <div class="v25PlanSummary">${s1.map(function(w){return `<span class="hz">${w.word}</span>`}).join('')}</div>
          <div class="v25Status ${d.set1.quizDone?'done':''}">${statusText(d.set1,d.set1.wordIds.length)}</div>
          <button class="pri big" id="v25Set1">${d.set1.quizDone?'오늘 1세트 완료':d.set1.learnDone?'1세트 쪽지시험 보기':d.set1.studyIndex?'1세트 이어하기':'1세트 학습 시작'}</button>
        </div>
        <div class="card v25Set ${d.set1.quizDone?'':'v25Locked'}"><span class="num">2</span><h2>② 실제 시험 대비 세트</h2><p class="muted">29쪽부터 현재 진도 끝까지 누적 ${pool.length}단어. 오늘은 ${d.set2.wordIds.length}단어를 먼저 학습한 뒤 시험을 봅니다.</p>
          <div class="v25Status ${d.set2.quizDone?'done':''}">${d.set1.quizDone?statusText(d.set2,d.set2.wordIds.length):'1세트 완료 후 열립니다'}</div>
          <button class="pri big" id="v25Set2" ${d.set1.quizDone?'':'disabled'}>${d.set2.quizDone?'오늘 2세트 완료':d.set2.learnDone?'2세트 실전시험 보기':d.set2.studyIndex?'2세트 이어하기':'2세트 학습 시작'}</button>
        </div>
      </div>`:`<div class="card" style="margin-top:14px;text-align:center"><h2>5일 학습 계획이 없습니다</h2><p class="muted">부모 모드에서 ① 복습 단어와 ② 현재 학원 진도 끝을 한 번 정하면 5일 동안 그대로 사용합니다.</p><button class="sun big" id="v25ParentSetup">부모 모드에서 설정</button></div>`}
      <div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><b class="jua" style="font-size:20px">오늘 보상</b><div class="muted">두 세트 쪽지시험을 모두 끝내면 하루 500P</div></div><div class="score">${db.points.total||0}P</div></div></div>
      <div class="path" style="margin-top:14px">
        <button class="step strokeHome" data-go="strokeHub"><span class="big hz">一二三</span><span class="t">큰글씨 획순</span><span class="muted">숫자 획순 자동재생</span></button>
        <button class="step" data-go="fast"><span class="big">⚡</span><span class="t">시험 전 점검</span><span class="muted">오답 ${Object.keys(db.wrong||{}).length}개 · 스피드 퀴즈</span></button>
        <button class="step" data-go="bookIdx"><span class="big">📖</span><span class="t">책으로 찾기</span><span class="muted">쪽별 단어 다시 보기</span></button>
        <button class="step" data-go="record"><span class="big">📊</span><span class="t">내 기록</span><span class="muted">공부한 날 ${Object.keys(db.days||{}).length}일</span></button>
      </div>`;
    if(document.querySelector('#v25Set1'))document.querySelector('#v25Set1').onclick=function(){if(!d.set1.quizDone)startSet('set1')};
    if(document.querySelector('#v25Set2'))document.querySelector('#v25Set2').onclick=function(){if(d.set1.quizDone&&!d.set2.quizDone)startSet('set2')};
    if(document.querySelector('#v25ParentSetup'))document.querySelector('#v25ParentSetup').onclick=function(){go('parent')};
    if(document.querySelector('#v25SurpriseStart'))document.querySelector('#v25SurpriseStart').onclick=function(){runSurprise(pending.id)};
    app.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){go(b.dataset.go)}});
  };

  function startSet(setKey){
    const d=getDailyPlan(true);if(!d)return toast('부모 모드에서 5일 계획을 먼저 설정해 주세요');
    const st=d[setKey];
    if(setKey==='set2'&&!d.set1.quizDone)return toast('1세트를 먼저 완료해 주세요');
    if(st.quizDone)return toast('오늘 이 세트는 완료했습니다');
    if(st.learnDone)return runSetQuiz(setKey);
    runStudy(setKey);
  }

  function runStudy(setKey){
    const d=getDailyPlan(true),st=d&&d[setKey];if(!st)return go('home');
    const words=st.wordIds.map(byId).filter(Boolean);
    let i=Math.max(0,Math.min(+st.studyIndex||0,words.length));
    if(i>=words.length){st.learnDone=true;save();return runSetQuiz(setKey)}
    const w=words[i],cs=charsOf(w),size=Math.min(220,Math.max(150,Math.floor((Math.min(window.innerWidth,900)-80)/2)));
    const label=setKey==='set1'?'1세트 · 이번 주 복습':'2세트 · 실제 시험 대비';
    app.innerHTML=`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label} · 학습</span><span class="jua">${i+1} / ${words.length}</span></div>
      <div class="prog" style="margin:10px 0 14px"><div style="width:${(i+1)/words.length*100}%"></div></div>
      <div class="card">
        <div class="v25StudyWord">${w.word}</div><div class="wordRead">${esc(w.read)}</div>
        <div class="writeClues">${cs.map(function(c){return `<span>[${esc(c.hun)} ${esc(c.eum)}]</span>`}).join('<b>+</b>')}</div>
        <p style="text-align:center">${esc(w.mean)}</p>
        <div class="v25StudyChars">${cs.map(function(c,k){return `<div><div id="v25Stroke${k}"></div><b class="jua">[${esc(c.hun)} ${esc(c.eum)}] · ${c.hoek}획</b></div>`}).join('')}</div>
        <p class="muted" style="text-align:center">획순을 본 뒤 두 글자를 직접 한 번 써 봅니다.</p>
        <div id="v25StudyPad" class="row" style="justify-content:center;gap:10px"></div>
        <div class="row" style="justify-content:space-between;margin-top:14px"><button class="ghost" id="v25StudyHome">오늘 화면</button><button class="pri" id="v25StudyNext">${i<words.length-1?'다음 단어':'학습 완료 → 쪽지시험'}</button></div>
      </div>`;
    cs.forEach(function(c,k){mountStrokeLesson(document.querySelector('#v25Stroke'+k),c.ch,c.hoek,{size,auto:true})});
    const pad1=makePad(document.querySelector('#v25StudyPad'),{cells:1,size:Math.min(165,size)});
    const pad2=makePad(document.querySelector('#v25StudyPad'),{cells:1,size:Math.min(165,size)});
    document.querySelector('#v25StudyHome').onclick=function(){go('home')};
    document.querySelector('#v25StudyNext').onclick=function(){
      if(!pad1.strokes()||!pad2.strokes())return toast('두 글자를 모두 직접 써 주세요');
      recordLearned(setKey,w);st.studyIndex=i+1;
      if(st.studyIndex>=words.length)st.learnDone=true;
      save();
      if(st.learnDone)return runSetQuiz(setKey);
      runStudy(setKey);
    };
  }

  function buildQuizItems(setKey,words){
    if(setKey==='set1'){
      const items=[];
      words.forEach(function(w){items.push({id:w.id,type:'read'});items.push({id:w.id,type:'write'})});
      return items;
    }
    const n=Math.min(10,words.length),read=words.slice(0,n),remaining=words.slice(n);
    const write=(remaining.length?remaining:words).slice(0,Math.min(10,remaining.length||words.length));
    return read.map(function(w){return {id:w.id,type:'read'}}).concat(write.map(function(w){return {id:w.id,type:'write'}}));
  }
  function ensureQuizState(setKey,st,words){
    const key=words.map(function(w){return w.id}).join(',');
    if(!st.quizState||st.quizState.key!==key){
      st.quizState={key:key,items:buildQuizItems(setKey,words),cursor:0,misses:[],round:1};
      save();
    }
    return st.quizState;
  }
  function markMiss(q,item){
    q.misses.push({id:item.id,type:item.type});
    const w=byId(item.id);if(w){addWrong(w.id);addWrong(w.id+1)}
  }
  function runSetQuiz(setKey){
    const d=getDailyPlan(true),st=d&&d[setKey];if(!st)return go('home');
    if(setKey==='set2'&&!d.set1.quizDone)return toast('1세트를 먼저 완료해 주세요');
    if(!st.learnDone)return runStudy(setKey);
    const words=st.wordIds.map(byId).filter(Boolean),q=ensureQuizState(setKey,st,words);
    if(q.cursor>=q.items.length){
      if(q.misses.length){
        const seen=new Set(),again=q.misses.filter(function(x){const k=x.type+':'+x.id;if(seen.has(k))return false;seen.add(k);return true});
        q.items=again;q.cursor=0;q.misses=[];q.round++;save();
        app.innerHTML=`<div class="card routineDone"><h2>틀린 문제만 다시!</h2><div class="score">${again.length}문제</div><p>전부 맞을 때까지 짧게 한 번 더 확인합니다.</p><button class="pri" id="v25Retry">다시 도전</button></div>`;
        document.querySelector('#v25Retry').onclick=function(){runSetQuiz(setKey)};return;
      }
      st.quizDone=true;st.quizState=null;save();
      return finishSet(setKey,d);
    }
    const item=q.items[q.cursor],w=byId(item.id),cs=charsOf(w);
    const label=setKey==='set1'?'1세트 쪽지시험':'2세트 실전 쪽지시험';
    const top=`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label}${q.round>1?' · 재도전 '+q.round+'회차':''}</span><span class="jua">${q.cursor+1} / ${q.items.length}</span></div><div class="prog" style="margin:10px 0 14px"><div style="width:${(q.cursor+1)/q.items.length*100}%"></div></div>`;
    if(item.type==='read'){
      app.innerHTML=top+`<div class="card v25QuizCard"><div class="wordBig">${w.word}</div><p class="q">읽는 소리를 쓰세요</p><input id="v25ReadAns" class="heIn" style="max-width:340px;margin:0 auto;display:block;text-align:center" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><div id="v25ReadFb" class="hint"></div><button class="pri big" id="v25ReadCheck">확인</button></div>`;
      const check=function(){
        const inp=document.querySelector('#v25ReadAns'),v=inp.value.replace(/\s/g,'');if(!v)return toast('답을 써 주세요');
        const ok=v===w.read;if(!ok)markMiss(q,item);
        document.querySelector('#v25ReadFb').innerHTML=ok?'<span class="okMsg">정답!</span>':`<span class="badMsg">정답은 ${esc(w.read)}</span>`;
        document.querySelector('#v25ReadCheck').disabled=true;save();
        setTimeout(function(){q.cursor++;save();runSetQuiz(setKey)},ok?700:1500);
      };
      document.querySelector('#v25ReadCheck').onclick=check;
      document.querySelector('#v25ReadAns').onkeydown=function(e){if(e.key==='Enter')check()};
      document.querySelector('#v25ReadAns').focus();
    }else{
      const sz=cellSize(2);
      app.innerHTML=top+`<div class="card v25QuizCard"><div class="wordRead">${esc(w.read)}</div><p class="q">${esc(w.mean)}<br>한자로 직접 쓰세요.</p>
        <div class="writeClues">${cs.map(function(c){return `<span>[${esc(c.hun)} ${esc(c.eum)}]</span>`}).join('<b>+</b>')}</div>
        <div id="v25WritePad" class="row" style="justify-content:center;gap:10px"></div>
        <div class="hintButtons"><button class="ghost" id="v25Hint2">힌트 1 · 2획</button><button class="ghost" id="v25Hint4">힌트 2 · 4획</button><button class="sun" id="v25ShowAns">정답 확인</button></div>
        <div id="v25WriteHint" class="strokeHintPair"></div><div id="v25WriteAns" class="preAnswer"></div>
        <div id="v25Self" class="row" style="justify-content:center;margin-top:12px"></div></div>`;
      const p1=makePad(document.querySelector('#v25WritePad'),{cells:1,size:sz}),p2=makePad(document.querySelector('#v25WritePad'),{cells:1,size:sz});
      const showHint=function(n){
        const h=document.querySelector('#v25WriteHint');h.innerHTML=cs.map(function(c){return `<div class="strokeHintCell" data-c="${c.ch}"></div>`}).join('');
        h.querySelectorAll('[data-c]').forEach(function(el,k){renderStrokePrefix(el,cs[k].ch,n,Math.min(150,sz))});
      };
      document.querySelector('#v25Hint2').onclick=function(){showHint(2)};
      document.querySelector('#v25Hint4').onclick=function(){showHint(4)};
      document.querySelector('#v25ShowAns').onclick=function(){
        if(!p1.strokes()||!p2.strokes())return toast('두 글자를 먼저 써 주세요');
        document.querySelector('#v25WriteAns').innerHTML=`<div class="qword">${w.word}</div>`;
        document.querySelector('#v25Self').innerHTML='<button class="ok" id="v25SelfO">맞았어요</button><button class="no" id="v25SelfX">다시 볼래요</button>';
        document.querySelector('#v25SelfO').onclick=function(){q.cursor++;save();runSetQuiz(setKey)};
        document.querySelector('#v25SelfX').onclick=function(){markMiss(q,item);q.cursor++;save();runSetQuiz(setKey)};
      };
    }
  }

  function finishSet(setKey,d){
    if(setKey==='set1'){
      app.innerHTML='<div class="card routineDone"><h2>1세트 완료</h2><div class="score">복습 끝</div><p>이제 오늘의 2세트 · 실제 쪽지시험 대비로 넘어갑니다.</p><button class="pri big" id="v25GoSet2">2세트 시작</button><button class="ghost" id="v25GoHome">오늘 화면</button></div>';
      document.querySelector('#v25GoSet2').onclick=function(){startSet('set2')};
      document.querySelector('#v25GoHome').onclick=function(){go('home')};
    }else{
      const got=award500(today());
      app.innerHTML=`<div class="card routineDone"><h2>오늘 2세트 완료</h2><div class="score">${got?'+500P':'500P'}</div><p>1세트 복습과 2세트 실전 대비를 모두 끝냈습니다.</p><button class="pri big" id="v25DoneHome">오늘 화면</button></div>`;
      document.querySelector('#v25DoneHome').onclick=function(){go('home')};
    }
  }

  function runSurprise(id){
    ensureV25();
    const t=db.surpriseTests.find(function(x){return x.id===+id});if(!t)return go('home');
    if(t.status==='submitted'||t.status==='graded')return toast('이미 제출한 깜짝시험입니다');
    t.status='in_progress';t.cursor=t.cursor||0;t.answers=t.answers||[];
    if(t.cursor>=t.wordIds.length){t.status='submitted';t.submittedAt=Date.now();save();app.innerHTML='<div class="card routineDone"><h2>깜짝 쪽지시험 제출 완료</h2><p>정답은 지금 보여주지 않습니다. 부모님 채점 후 확인할 수 있어요.</p><button class="pri" id="v25SH">오늘 화면</button></div>';document.querySelector('#v25SH').onclick=function(){go('home')};return}
    const w=byId(t.wordIds[t.cursor]),sz=cellSize(2);
    app.innerHTML=`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">깜짝 쪽지시험</span><span class="jua">${t.cursor+1} / ${t.wordIds.length}</span></div>
      <div class="prog" style="margin:10px 0 14px"><div style="width:${(t.cursor+1)/t.wordIds.length*100}%"></div></div>
      <div class="card v25QuizCard"><div class="wordRead">${esc(w.read)}</div><p class="q">${esc(w.mean)}<br>힌트 없이 한자로 쓰세요.</p><div id="v25SPad" class="row" style="justify-content:center;gap:10px"></div><button class="pri big" id="v25SNext">${t.cursor<t.wordIds.length-1?'다음 문제':'제출하기'}</button></div>`;
    const p1=makePad(document.querySelector('#v25SPad'),{cells:1,size:sz}),p2=makePad(document.querySelector('#v25SPad'),{cells:1,size:sz});
    document.querySelector('#v25SNext').onclick=function(){
      if(!p1.strokes()||!p2.strokes())return toast('두 글자를 모두 써 주세요');
      t.answers[t.cursor]={id:w.id,img:joinImg([p1,p2],90)};t.cursor++;save();runSurprise(t.id);
    };
  }

  parent=function(){
    ensureV25();
    const pendingSurprise=db.surpriseTests.filter(function(x){return x.status==='submitted'}).length;
    const allowed=['five','surprise','grade','status','set'];if(!allowed.includes(ptab))ptab='five';
    app.innerHTML=`<div class="tabs">
      <button data-t="five">5일 계획</button><button data-t="surprise">깜짝시험${pendingSurprise?` (${pendingSurprise})`:''}</button>
      <button data-t="grade">기존 채점</button><button data-t="status">학습 현황</button><button data-t="set">설정</button>
      <button class="ghost" id="out" style="margin-left:auto">나가기</button></div><div id="pv"></div>`;
    app.querySelectorAll('[data-t]').forEach(function(b){b.classList.toggle('on',b.dataset.t===ptab);b.onclick=function(){ptab=b.dataset.t;parent()}});
    document.querySelector('#out').onclick=function(){parentOK=false;go('home')};
    const v=document.querySelector('#pv');
    if(ptab==='five')return pFive(v);
    if(ptab==='surprise')return pSurprise(v);
    if(ptab==='grade')return pGrade(v);
    if(ptab==='status')return pStatus(v);
    return pSet(v);
  };

  function pFive(v){
    ensureV25();
    const p=db.fiveDayPlan,active=activePlan(),seed=p||{};
    const selected=new Set((seed.set1WordIds||[]).map(Number));
    const endPage=Math.max(29,Math.min(52,+seed.set2EndPage||49));
    v.innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 style="margin:0">5일 학습 계획</h2><p class="muted" style="margin:5px 0 0">한 번 저장하면 <b>저장일 포함 5일(D1~D5)</b> 동안 같은 계획을 사용합니다. D6에는 새 계획을 설정합니다.</p></div>${active?`<span class="v25Day">현재 D${cycleDay(active)} / D5</span>`:'<span class="pill wait">새 계획 필요</span>'}</div>
      ${p?`<div class="v25PlanSummary"><span>${p.start} ~ ${p.end}</span><span>1세트 ${p.set1WordIds.length}단어</span><span>2세트 29쪽 → ${p.set2EndPage}쪽</span></div>`:''}
    </div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">① 1세트 · 이번 주 복습 단어</h3><p class="muted">적게 골라도 됩니다. <b>권장 3단어(약 6글자)</b>, 최대 ${MAX_SET1_WORDS}단어입니다. 선택한 단어를 5일 동안 반복합니다.</p><div class="row" style="justify-content:space-between"><b id="v25PickCount">${selected.size}단어 선택</b><button class="ghost" id="v25ClearPick">선택 지우기</button></div><div id="v25PickPages"></div></div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">② 2세트 · 실제 쪽지시험 범위</h3><p class="muted"><b>시작은 항상 29쪽</b>입니다. 부모는 현재 학원 진도의 <b>마지막 단어</b>만 정합니다. 이 범위에서 매일 최대 20단어를 골라 학습 → 실전시험으로 진행합니다.</p>
      <div class="rangeSet"><label>현재 진도 끝 페이지<select id="v25EndPage">${Array.from({length:24},function(_,i){const pg=29+i;return `<option value="${pg}" ${pg===endPage?'selected':''}>${pg}쪽</option>`}).join('')}</select></label><label>마지막 단어<select id="v25EndWord"></select></label></div><div id="v25RangePreview" class="scopePreview"></div></div>
    <div class="card" style="margin-top:14px"><button class="pri big" id="v25SavePlan">${active?'5일 계획 다시 저장':'5일 계획 시작'}</button><p class="muted" style="text-align:center;margin-bottom:0">다시 저장하면 오늘을 새 D1로 하여 5일이 다시 시작됩니다.</p></div>`;
    const pagesHost=document.querySelector('#v25PickPages');
    for(let pg=29;pg<=52;pg++){
      const words=uniqWords(ITEMS.filter(function(d){return d.detailPage===pg}));
      const det=document.createElement('details');det.className='v25Page';if(words.some(function(w){return selected.has(w.id)}))det.open=true;
      det.innerHTML=`<summary>${pg}쪽 · ${words.map(function(w){return w.word}).join(' · ')}</summary><div class="v25PickGrid">${words.map(function(w){return `<button class="v25Pick ${selected.has(w.id)?'on':''}" data-id="${w.id}"><span class="hz">${w.word}</span><small>${esc(w.read)}</small></button>`}).join('')}</div>`;
      pagesHost.appendChild(det);
    }
    const paintCount=function(){document.querySelector('#v25PickCount').textContent=selected.size+'단어 선택'};
    pagesHost.querySelectorAll('[data-id]').forEach(function(b){b.onclick=function(){
      const id=+b.dataset.id;
      if(selected.has(id)){selected.delete(id);b.classList.remove('on')}
      else{if(selected.size>=MAX_SET1_WORDS)return toast('1세트는 최대 '+MAX_SET1_WORDS+'단어까지 선택할 수 있어요');selected.add(id);b.classList.add('on')}
      paintCount();
    }});
    document.querySelector('#v25ClearPick').onclick=function(){selected.clear();pagesHost.querySelectorAll('[data-id]').forEach(function(b){b.classList.remove('on')});paintCount()};
    const fillEnd=function(){
      const pg=+document.querySelector('#v25EndPage').value,words=uniqWords(ITEMS.filter(function(d){return d.detailPage===pg})),sel=document.querySelector('#v25EndWord');
      sel.innerHTML=words.map(function(w){return `<option value="${w.id}" ${+seed.set2EndWordId===w.id?'selected':''}>${w.word} (${esc(w.read)})</option>`}).join('');
      if(!sel.value&&words.length)sel.value=words[words.length-1].id;
      previewRange();
    };
    const previewRange=function(){
      const pg=+document.querySelector('#v25EndPage').value,id=+document.querySelector('#v25EndWord').value;
      const temp={set2EndPage:pg,set2EndWordId:id},list=cumulativeWords(temp),last=list[list.length-1];
      document.querySelector('#v25RangePreview').innerHTML=`<b>29쪽 → ${last?last.detailPage:pg}쪽 · ${last?last.word:'-'}까지 · 누적 ${list.length}단어</b><div class="muted">매일 이 범위에서 최대 ${SET2_DAILY_WORDS}단어를 선정합니다.</div>`;
    };
    document.querySelector('#v25EndPage').onchange=fillEnd;document.querySelector('#v25EndWord').onchange=previewRange;fillEnd();
    document.querySelector('#v25SavePlan').onclick=function(){
      if(!selected.size)return toast('1세트 복습 단어를 1개 이상 선택해 주세요');
      const pg=+document.querySelector('#v25EndPage').value,id=+document.querySelector('#v25EndWord').value;if(!id)return toast('2세트 마지막 단어를 선택해 주세요');
      if(active&&!confirm('현재 5일 계획을 오늘부터 다시 시작할까요?'))return;
      const st=today();
      db.fiveDayPlan={start:st,end:isoAdd(st,FIVE_DAYS-1),set1WordIds:Array.from(selected),set2EndPage:pg,set2EndWordId:id,createdAt:Date.now()};
      save();toast('5일 계획을 저장했습니다');pFive(v);
    };
  }

  function pSurprise(v){
    ensureV25();
    const pool=manualPool(),tests=db.surpriseTests.slice().sort(function(a,b){return b.id-a.id});
    v.innerHTML=`<div class="card"><h2 style="margin-top:0">깜짝 쪽지시험 만들기</h2><p class="muted"><b>1세트·2세트에서 오늘 실제로 학습한 단어만</b> 출제할 수 있습니다. 이 시험은 500P와 두 세트 완료 여부에는 영향을 주지 않습니다.</p>
      ${pool.length?`<div id="v25ManualPool" class="v25PickGrid">${pool.map(function(w){return `<button class="v25Pick" data-id="${w.id}"><span class="hz">${w.word}</span><small>${esc(w.read)}</small></button>`}).join('')}</div><div class="row" style="justify-content:space-between;margin-top:12px"><b id="v25ManualCount">0문제 선택</b><button class="sun" id="v25MakeSurprise">선택한 단어로 깜짝시험 생성</button></div>`:'<p class="badMsg">오늘 1·2세트에서 학습을 시작한 단어가 아직 없습니다.</p>'}
    </div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">깜짝시험 기록</h3><div class="v25SurpriseList">${tests.length?tests.map(function(t){const score=t.status==='graded'?t.grades.filter(function(g){return g===true}).length+'/'+t.wordIds.length:'-';return `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0"><div><b>${t.date} · ${t.wordIds.length}문제</b><div class="muted">${t.status==='ready'?'학생 응시 전':t.status==='in_progress'?'응시 중':t.status==='submitted'?'채점 대기':'채점 완료 · '+score}</div></div>${t.status==='submitted'?`<button class="pri" data-grade="${t.id}">채점하기</button>`:''}</div>`}).join(''):'<p class="muted">아직 깜짝시험 기록이 없습니다.</p>'}</div></div>`;
    if(pool.length){
      const selected=new Set();
      v.querySelectorAll('#v25ManualPool [data-id]').forEach(function(b){b.onclick=function(){const id=+b.dataset.id;if(selected.has(id)){selected.delete(id);b.classList.remove('on')}else{selected.add(id);b.classList.add('on')}document.querySelector('#v25ManualCount').textContent=selected.size+'문제 선택'}});
      document.querySelector('#v25MakeSurprise').onclick=function(){
        if(!selected.size)return toast('출제할 단어를 1개 이상 선택해 주세요');
        db.surpriseTests.push({id:Date.now(),date:today(),wordIds:Array.from(selected),status:'ready',cursor:0,answers:[],grades:Array.from({length:selected.size},function(){return null}),createdAt:Date.now()});
        save();toast('학생 화면에 깜짝 쪽지시험을 보냈습니다');pSurprise(v);
      };
    }
    v.querySelectorAll('[data-grade]').forEach(function(b){b.onclick=function(){gradeSurprise(v,+b.dataset.grade)}});
  }

  function gradeSurprise(v,id){
    const t=db.surpriseTests.find(function(x){return x.id===id});if(!t)return pSurprise(v);
    t.grades=t.grades||Array.from({length:t.wordIds.length},function(){return null});
    v.innerHTML=`<div class="card"><div class="row" style="justify-content:space-between"><div><h2 style="margin:0">깜짝시험 채점</h2><p class="muted">${t.date} · ${t.wordIds.length}문제</p></div><button class="ghost" id="v25GradeBack">목록</button></div>
      <div id="v25GradeRows">${t.wordIds.map(function(id,k){const w=byId(id),a=t.answers[k];return `<div class="v25GradeRow"><b>${k+1}</b><div>${a?.img?`<img src="${a.img}" alt="${esc(w.read)} 답안">`:'<span class="muted">답안 없음</span>'}</div><div><div class="muted">${esc(w.read)} → 정답</div><div class="ans">${w.word}</div></div><div class="gbtn"><button data-k="${k}" data-g="1" class="${t.grades[k]===true?'selO':''}">O</button><button data-k="${k}" data-g="0" class="${t.grades[k]===false?'selX':''}">X</button></div></div>`}).join('')}</div>
      <button class="ok big" id="v25GradeFinish">채점 완료</button></div>`;
    document.querySelector('#v25GradeBack').onclick=function(){pSurprise(v)};
    v.querySelectorAll('[data-g]').forEach(function(b){b.onclick=function(){t.grades[+b.dataset.k]=b.dataset.g==='1';save();gradeSurprise(v,id)}});
    document.querySelector('#v25GradeFinish').onclick=function(){
      const left=t.grades.filter(function(g){return g===null}).length;if(left)return toast('아직 '+left+'문항이 채점되지 않았습니다');
      if(t.status!=='graded')t.wordIds.forEach(function(id,k){if(t.grades[k]===false){const w=byId(id);addWrong(w.id);addWrong(w.id+1)}});
      t.status='graded';t.gradedAt=Date.now();save();toast('깜짝시험 채점을 완료했습니다');pSurprise(v);
    };
  }

  window.__v25Debug={activePlan,cycleDay,set1Words,cumulativeWords,selectSet2,getDailyPlan,manualPool,award500};
  ensureV25();
})();
