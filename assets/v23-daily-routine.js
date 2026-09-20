
(function(){
  function isoDate(d){return d.toLocaleDateString('sv-SE')}
  function mondayOf(date){
    const d=new Date(date||Date.now()),day=(d.getDay()+6)%7;
    d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;
  }
  function weekEnd(start){const d=new Date(start);d.setDate(d.getDate()+6);return d}
  function ensureRoutine(){
    db.routineDays=db.routineDays||{};
    db.dailyQuizPlans=db.dailyQuizPlans||{};
    if(!db.weeklyPlan && db.dailyScope?.wordIds?.length){
      const st=mondayOf();
      db.weeklyPlan={wordIds:db.dailyScope.wordIds.map(Number),start:isoDate(st),end:isoDate(weekEnd(st)),created:today()};
    }
    if(!db.quizProgress){
      db.quizProgress={endPage:49,endWordId:null,updated:today()};
    }
  }
  function isCurrentWeekPlan(p){
    if(!p||!p.start||!p.end)return false;
    const t=today();
    return p.start<=t&&t<=p.end;
  }
  function weeklyWords(){
    ensureRoutine();const p=db.weeklyPlan;
    if(!isCurrentWeekPlan(p))return[];
    return (p.wordIds||[]).map(byId).filter(Boolean);
  }
  function weekLabel(){
    ensureRoutine();const p=db.weeklyPlan;
    if(!p)return '이번 주 학습 미지정';
    if(!isCurrentWeekPlan(p))return '새 주간 범위 필요 · 이전 범위 '+p.end+' 종료';
    return p.start+' ~ '+p.end+' · '+weeklyWords().length+'단어';
  }
  function cumulativeWords(){
    ensureRoutine();const p=db.quizProgress||{},endPage=Math.max(29,Math.min(52,+p.endPage||49));
    let list=uniqWords(ITEMS.filter(function(d){return d.detailPage>=29&&d.detailPage<=endPage}));
    if(p.endWordId){
      const ix=list.findIndex(function(w){return w.id===+p.endWordId});
      if(ix>=0)list=list.slice(0,ix+1);
    }
    return list;
  }
  function progressLabel(){
    const list=cumulativeWords(),last=list[list.length-1];
    return '29쪽 → '+(last?last.detailPage:'-')+'쪽'+(last?' · '+last.word+'까지':'')+' · 누적 '+list.length+'단어';
  }
  function routineToday(){
    ensureRoutine();
    const r=db.routineDays[today()]||{};
    const learnCore=!!r.learn;
    const rewarded=!!(db.points&&db.points.days&&db.points.days[today()]);
    return {learn:learnCore&&rewarded,learnCore:learnCore,quiz:!!r.quiz};
  }
  function markRoutine(kind){
    ensureRoutine();const t=today();
    db.routineDays[t]=db.routineDays[t]||{};
    db.routineDays[t][kind]=true;save();
  }
  function makeDailyReview(pool,count){
    pool=uniqWords(pool);if(!pool.length)return[];
    const wrongWords=Object.entries(db.wrong||{}).sort(function(a,b){return b[1]-a[1]})
      .map(function(x){const d=byId(+x[0]);return d&&byId(d.id%2===0?d.id-1:d.id)})
      .filter(Boolean);
    const uniqWrong=uniqWords(wrongWords).filter(function(w){return pool.some(function(p){return p.id===w.id})});
    const recent=pool.slice(-Math.min(12,pool.length));
    const rest=shuffle(pool.filter(function(w){return !uniqWrong.some(function(x){return x.id===w.id}) && !recent.some(function(x){return x.id===w.id})}));
    const out=[];
    uniqWrong.slice(0,Math.min(8,count)).forEach(function(w){if(!out.some(function(x){return x.id===w.id}))out.push(w)});
    let recentAdded=0;
    shuffle(recent).forEach(function(w){
      if(out.length<count&&recentAdded<8&&!out.some(function(x){return x.id===w.id})){out.push(w);recentAdded++}
    });
    rest.forEach(function(w){if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w)});
    shuffle(pool).forEach(function(w){if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w)});
    return out.slice(0,Math.min(count,pool.length));
  }
  function quizProgressKey(){
    ensureRoutine();const p=db.quizProgress||{};
    return String(p.endPage||49)+':'+String(p.endWordId||'');
  }
  function getDailyQuizPlan(){
    ensureRoutine();
    const t=today(),pool=cumulativeWords(),key=quizProgressKey();
    let plan=db.dailyQuizPlans[t];
    const poolIds=new Set(pool.map(function(w){return w.id}));
    const valid=plan&&plan.progressKey===key&&Array.isArray(plan.wordIds)&&plan.wordIds.length&&plan.wordIds.every(function(id){return poolIds.has(+id)});
    if(!valid){
      const list=makeDailyReview(pool,20);
      plan={progressKey:key,wordIds:list.map(function(w){return w.id}),cursor:0,completed:false,createdAt:Date.now()};
      db.dailyQuizPlans[t]=plan;
      save();
    }
    return plan;
  }

  window.weeklyWords=weeklyWords;
  window.cumulativeQuizWords=cumulativeWords;
  window.quizProgressLabel=progressLabel;

  const oldWordsInAssignedScope=wordsInAssignedScope;
  wordsInAssignedScope=function(scope){
    ensureRoutine();
    if((!scope||scope===db.dailyScope) && db.weeklyPlan?.wordIds?.length)return weeklyWords();
    return oldWordsInAssignedScope(scope);
  };
  const oldDailyScopeLabel=dailyScopeLabel;
  dailyScopeLabel=function(scope){
    ensureRoutine();
    if((!scope||scope===db.dailyScope) && db.weeklyPlan?.wordIds?.length)return '주간 반복 · '+weekLabel();
    return oldDailyScopeLabel(scope);
  };

  const oldHome=home;
  home=function(){
    ensureRoutine();oldHome();
    const status=routineToday(),first=app.querySelector('.card');
    const learnState=status.learn?'오늘 완료':(status.learnCore?'500P 확인시험 남음':(weeklyWords().length===10?'이번 주 같은 10단어 반복':'부모님 주간 설정 필요'));
    if(first){
      const panel=document.createElement('div');panel.className='routinePanel';
      panel.innerHTML='<div class="routineTitle"><b>매일 2개 루틴</b><span>'+(status.learn&&status.quiz?'오늘 루틴 완료':'매일 반복')+'</span></div>'+
        '<div class="routineGrid">'+
        '<button class="routineBtn '+(status.learn?'done':'')+'" id="routineLearn"><b>① 학습모드</b><small>'+weekLabel()+'</small><em>'+learnState+'</em></button>'+
        '<button class="routineBtn '+(status.quiz?'done':'')+'" id="routineQuiz"><b>② 쪽지시험 대비</b><small>'+progressLabel()+'</small><em>'+(status.quiz?'오늘 완료':'누적범위 매일 20문제')+'</em></button>'+
        '</div>';
      first.insertAdjacentElement('afterend',panel);
      const a=document.querySelector('#routineLearn'),b=document.querySelector('#routineQuiz');
      if(a)a.onclick=function(){
        if(status.learn)return toast('오늘 학습모드는 완료했습니다');
        if(status.learnCore){
          const c=(db.dailyChecks||[]).find(function(x){return x.date===today()&&x.status!=='passed'});
          if(c&&typeof dailyCheck==='function')return dailyCheck();
        }
        const w=weeklyWords();
        if(w.length!==10)return toast('부모 모드에서 이번 주 10단어를 먼저 지정해 주세요');
        db.dailyScope={wordIds:w.map(function(x){return x.id}),source:'weekly-plan'};db.sess=null;save();startDay();
      };
      if(b)b.onclick=function(){if(status.quiz)return toast('오늘 쪽지시험 대비는 완료했습니다');dailyQuizReview()};
    }
  };

  const oldFinishDay=finishDay;
  finishDay=function(){
    const ss=db.sess;
    if(ss&&weeklyWords().length===10)markRoutine('learn');
    oldFinishDay();
  };

  window.dailyQuizReview=function(){
    ensureRoutine();
    const pool=cumulativeWords();
    if(pool.length<10)return toast('쪽지시험 누적 범위를 먼저 지정해 주세요');
    const plan=getDailyQuizPlan();
    const list=(plan.wordIds||[]).map(byId).filter(Boolean);
    if(!list.length)return toast('오늘 출제할 누적 범위가 없습니다');
    let i=Math.max(0,Math.min(+plan.cursor||0,list.length)),p1,p2;
    function showDone(){
      app.innerHTML='<div class="card routineDone"><h2>오늘 쪽지시험 대비 완료</h2><div class="score">'+list.length+'문제</div><p>'+progressLabel()+'</p><p class="muted">오늘 선정된 문제는 완료 전까지 그대로 유지되고, 내일 새로 섞어 출제합니다.</p><button class="pri" id="routineHome">홈으로</button></div>';
      document.querySelector('#routineHome').onclick=function(){go('home')};
    }
    if(plan.completed||routineToday().quiz){
      if(!routineToday().quiz)markRoutine('quiz');
      plan.completed=true;plan.cursor=list.length;save();showDone();return;
    }
    function draw(){
      if(i>=list.length){
        plan.cursor=list.length;plan.completed=true;save();markRoutine('quiz');showDone();return;
      }
      const w=list[i],cs=charsOf(w),size=cellSize(2);
      app.innerHTML='<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">매일 쪽지시험 대비</span><span class="jua">'+(i+1)+' / '+list.length+'</span></div>'+
        '<div class="prog" style="margin:10px 0 14px"><div style="width:'+((i+1)/list.length*100)+'%"></div></div>'+
        '<div class="card preStudyCard"><div class="wordRead" style="font-size:54px">'+w.read+'</div>'+
        '<div class="writeClues">'+cs.map(function(c){return '<span>['+c.hun+' '+c.eum+']</span>'}).join('<b>+</b>')+'</div>'+
        '<p class="muted" style="text-align:center">'+w.mean+'</p><div id="routinePad" class="row" style="justify-content:center;gap:10px"></div>'+
        '<div class="hintButtons"><button class="ghost" id="rh1">힌트 1 · 2획</button><button class="ghost" id="rh2">힌트 2 · 4획</button><button class="sun" id="rAns">정답 보기</button></div>'+
        '<div id="routineHint" class="strokeHintPair"></div><div id="routineAns" class="preAnswer"></div></div>'+
        '<div class="row" style="justify-content:space-between;margin-top:14px"><button class="ghost" id="rPrev" '+(i?'':'disabled')+'>이전</button><button class="pri" id="rNext">'+(i<list.length-1?'다음':'오늘 대비 완료')+'</button></div>';
      const host=document.querySelector('#routinePad');p1=makePad(host,{cells:1,size:size});p2=makePad(host,{cells:1,size:size});
      const showHint=function(n){const h=document.querySelector('#routineHint');h.innerHTML=cs.map(function(c){return '<div class="strokeHintCell" data-hchar="'+c.ch+'"></div>'}).join('');h.querySelectorAll('[data-hchar]').forEach(function(el,k){renderStrokePrefix(el,cs[k].ch,n,Math.min(150,size))})};
      document.querySelector('#rh1').onclick=function(){showHint(2)};document.querySelector('#rh2').onclick=function(){showHint(4)};
      document.querySelector('#rAns').onclick=function(){document.querySelector('#routineAns').innerHTML='<div class="qword">'+w.word+'</div>'};
      document.querySelector('#rPrev').onclick=function(){if(i>0){i--;plan.cursor=i;save();draw()}};
      document.querySelector('#rNext').onclick=function(){
        if(!p1.strokes()||!p2.strokes())return toast('두 글자를 모두 써 주세요');
        i++;plan.cursor=i;save();draw();
      };
    }
    draw();
  };
  const oldParent=parent;
  parent=function(){
    ensureRoutine();oldParent();
    const tabs=app.querySelector('.tabs');
    if(tabs&&!tabs.querySelector('[data-t="routine"]')){
      const b=document.createElement('button');b.dataset.t='routine';b.textContent='매일 루틴';tabs.insertBefore(b,tabs.firstChild);
      b.onclick=function(){ptab='routine';parent()};
    }
    if(ptab==='routine'){
      app.querySelectorAll('[data-t]').forEach(function(b){b.classList.toggle('on',b.dataset.t==='routine')});
      pRoutine(document.querySelector('#pv'));
    }
  };

  function pRoutine(v){
    ensureRoutine();
    const plan=db.weeklyPlan,currentPlan=isCurrentWeekPlan(plan),wp=weeklyWords(),pool=cumulativeWords(),last=pool[pool.length-1];
    v.innerHTML='<div class="card"><h3 style="margin-top:0">부모 설정은 2개만 확인하면 됩니다</h3><p class="muted" style="margin-bottom:0">① 이번 주 10단어를 한 번 지정하고 ② 학원 진도가 나갈 때 누적 진도의 끝만 바꿉니다.</p></div>'+
      '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">① 이번 주 학습모드 · 주 1회 지정</h3>'+
      '<p class="muted">한 번 저장하면 7일 동안 같은 10단어를 매일 반복합니다. 다음 주에만 새 범위를 지정하면 됩니다.</p>'+
      '<div class="routineParentSummary"><b>'+(plan?weekLabel():'미지정')+'</b><span class="hz">'+wp.map(function(w){return w.word}).join(' · ')+'</span></div>'+
      '<button class="pri" id="goWeeklyPick">'+(currentPlan?'이번 주 10단어 선택/변경':'이번 주 10단어 지정')+'</button></div>'+
      '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">② 쪽지시험 누적 진도</h3>'+
      '<p class="muted"><b>시작은 항상 교재 29쪽</b>입니다. 부모는 현재 학원 진도의 <b>마지막 단어만</b> 지정합니다. 예: 현재 49쪽까지 진도 → 29쪽부터 49쪽의 지정 단어까지 전부 시험 대비 범위.</p>'+
      '<div class="rangeSet"><label>현재 진도 끝 페이지 <select id="progPage">'+Array.from({length:24},function(_,i){const p=29+i;return '<option value="'+p+'" '+(p===(db.quizProgress?.endPage||49)?'selected':'')+'>'+p+'쪽</option>'}).join('')+'</select></label>'+
      '<label>마지막 단어 <select id="progWord"></select></label></div>'+
      '<div id="progPreview" class="scopePreview"></div><button class="sun" id="saveProgress">누적 진도 저장</button></div>';
    function fill(){
      const p=+document.querySelector('#progPage').value,words=uniqWords(ITEMS.filter(function(d){return d.detailPage===p})),sel=document.querySelector('#progWord'),wanted=db.quizProgress?.endWordId;
      sel.innerHTML=words.map(function(w){return '<option value="'+w.id+'" '+(w.id===wanted?'selected':'')+'>'+w.word+' ('+w.read+')</option>'}).join('');
      preview();
    }
    function preview(){
      const p=+document.querySelector('#progPage').value,id=+document.querySelector('#progWord').value||null;
      let list=uniqWords(ITEMS.filter(function(d){return d.detailPage>=29&&d.detailPage<=p}));
      if(id){const ix=list.findIndex(function(w){return w.id===id});if(ix>=0)list=list.slice(0,ix+1)}
      document.querySelector('#progPreview').innerHTML='<b>29쪽부터 누적 '+list.length+'단어</b><div>'+p+'쪽 '+((byId(id)||{}).word||'마지막 단어')+'까지</div>';
    }
    document.querySelector('#progPage').onchange=fill;document.querySelector('#progWord').onchange=preview;fill();
    document.querySelector('#saveProgress').onclick=function(){
      const p=+document.querySelector('#progPage').value,id=+document.querySelector('#progWord').value||null;
      db.quizProgress={endPage:p,endWordId:id,updated:today()};save();toast('쪽지시험 누적 진도를 저장했습니다');pRoutine(v);
    };
    document.querySelector('#goWeeklyPick').onclick=function(){ptab='dailyRange';parent()};
  }

  const oldPDaily=window.pDailyRange;
  window.pDailyRange=function(v){
    oldPDaily(v);
    const h=v.querySelector('h3');if(h)h.textContent='이번 주 학습 10단어 · 주 1회 지정';
    const p=v.querySelector('p.muted');if(p)p.textContent='교재 29~52쪽에서 이번 주에 매일 반복할 10단어를 고릅니다. 저장한 범위는 7일 동안 유지합니다.';
    const saveBtn=v.querySelector('#saveDailyPick');
    if(saveBtn){
      saveBtn.textContent='이번 주 10단어 저장';
      const old=saveBtn.onclick;
      saveBtn.onclick=function(){
        const before=(db.weeklyPlan?.wordIds||[]).map(Number).join(',');
        old();
        if(db.dailyScope?.wordIds?.length===10){
          const st=mondayOf(),nextIds=db.dailyScope.wordIds.map(Number),changed=before!==nextIds.join(',');
          db.weeklyPlan={wordIds:nextIds,start:isoDate(st),end:isoDate(weekEnd(st)),created:today()};
          if(changed){
            const t=today();
            if(db.routineDays&&db.routineDays[t])db.routineDays[t].learn=false;
            if(Array.isArray(db.dailyChecks)&&!(db.points&&db.points.days&&db.points.days[t])){
              db.dailyChecks=db.dailyChecks.filter(function(x){return !(x.date===t&&x.status!=='passed')});
            }
          }
          save();toast('이번 주 학습범위를 저장했습니다 · 매일 같은 10단어 반복');
        }
      };
    }
  };
  window.__routineDebug={
    isCurrentWeekPlan:isCurrentWeekPlan,
    weeklyWords:weeklyWords,
    cumulativeWords:cumulativeWords,
    makeDailyReview:makeDailyReview,
    routineToday:routineToday,
    getDailyQuizPlan:getDailyQuizPlan
  };
})();