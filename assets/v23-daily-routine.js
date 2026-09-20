
(function(){
  function isoDate(d){return d.toLocaleDateString('sv-SE')}
  function mondayOf(date){
    const d=new Date(date||Date.now()),day=(d.getDay()+6)%7;
    d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;
  }
  function weekEnd(start){const d=new Date(start);d.setDate(d.getDate()+6);return d}
  function ensureRoutine(){
    db.routineDays=db.routineDays||{};
    if(!db.weeklyPlan && db.dailyScope?.wordIds?.length){
      const st=mondayOf();
      db.weeklyPlan={wordIds:db.dailyScope.wordIds.map(Number),start:isoDate(st),end:isoDate(weekEnd(st)),created:today()};
    }
    if(!db.quizProgress){
      db.quizProgress={endPage:49,endWordId:null,updated:today()};
    }
  }
  function weeklyWords(){ensureRoutine();return (db.weeklyPlan?.wordIds||[]).map(byId).filter(Boolean)}
  function weekLabel(){
    ensureRoutine();const p=db.weeklyPlan;
    if(!p)return '이번 주 학습 미지정';
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
    return {learn:!!r.learn,quiz:!!r.quiz};
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
    uniqWrong.slice(0,5).forEach(function(w){if(!out.some(function(x){return x.id===w.id}))out.push(w)});
    shuffle(recent).forEach(function(w){if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w)});
    rest.forEach(function(w){if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w)});
    return out.slice(0,Math.min(count,pool.length));
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
    if(first){
      const panel=document.createElement('div');panel.className='routinePanel';
      panel.innerHTML='<div class="routineTitle"><b>매일 2개 루틴</b><span>'+(status.learn&&status.quiz?'오늘 루틴 완료':'매일 반복')+'</span></div>'+
        '<div class="routineGrid">'+
        '<button class="routineBtn '+(status.learn?'done':'')+'" id="routineLearn"><b>① 학습모드</b><small>'+weekLabel()+'</small><em>'+(status.learn?'오늘 완료':'이번 주 같은 10단어 반복')+'</em></button>'+
        '<button class="routineBtn '+(status.quiz?'done':'')+'" id="routineQuiz"><b>② 쪽지시험 대비</b><small>'+progressLabel()+'</small><em>'+(status.quiz?'오늘 완료':'누적범위 매일 20문제')+'</em></button>'+
        '</div>';
      first.insertAdjacentElement('afterend',panel);
      const a=document.querySelector('#routineLearn'),b=document.querySelector('#routineQuiz');
      if(a)a.onclick=function(){const w=weeklyWords();if(w.length!==10)return toast('부모 모드에서 이번 주 10단어를 먼저 지정해 주세요');db.dailyScope={wordIds:w.map(function(x){return x.id}),source:'weekly-plan'};db.sess=null;save();startDay()};
      if(b)b.onclick=function(){dailyQuizReview()};
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
    const list=makeDailyReview(pool,20);
    let i=0,p1,p2,done=0;
    function draw(){
      if(i>=list.length){markRoutine('quiz');app.innerHTML='<div class="card routineDone"><h2>오늘 쪽지시험 대비 완료</h2><div class="score">'+list.length+'문제</div><p>'+progressLabel()+'</p><p class="muted">내일은 같은 누적 범위에서 문제를 다시 섞어 출제합니다.</p><button class="pri" id="routineHome">홈으로</button></div>';document.querySelector('#routineHome').onclick=function(){go('home')};return}
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
      document.querySelector('#rPrev').onclick=function(){i--;draw()};
      document.querySelector('#rNext').onclick=function(){if(!p1.strokes()||!p2.strokes())return toast('두 글자를 모두 써 주세요');i++;done++;draw()};
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
    const plan=db.weeklyPlan,wp=weeklyWords(),pool=cumulativeWords(),last=pool[pool.length-1];
    v.innerHTML='<div class="card"><h3 style="margin-top:0">① 이번 주 학습모드 · 주 1회 지정</h3>'+
      '<p class="muted">한 번 저장하면 7일 동안 같은 10단어를 매일 반복합니다. 다음 주에만 새 범위를 지정하면 됩니다.</p>'+
      '<div class="routineParentSummary"><b>'+(plan?weekLabel():'미지정')+'</b><span class="hz">'+wp.map(function(w){return w.word}).join(' · ')+'</span></div>'+
      '<button class="pri" id="goWeeklyPick">이번 주 10단어 선택/변경</button></div>'+
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
        old();
        if(db.dailyScope?.wordIds?.length===10){
          const st=mondayOf();
          db.weeklyPlan={wordIds:db.dailyScope.wordIds.map(Number),start:isoDate(st),end:isoDate(weekEnd(st)),created:today()};
          save();toast('이번 주 학습범위를 저장했습니다 · 매일 같은 10단어 반복');
        }
      };
    }
  };
})();