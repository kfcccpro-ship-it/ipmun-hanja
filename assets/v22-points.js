
(function(){
  const DAILY_POINT = 500;

  function ensureRewardState(){
    db.points = db.points || {total:0, days:{}};
    db.points.days = db.points.days || {};
    db.dailyChecks = db.dailyChecks || [];
  }
  function todayPoint(){
    ensureRewardState();
    return db.points.days[today()] || 0;
  }
  function findTodayCheck(){
    ensureRewardState();
    const t = today();
    return db.dailyChecks.find(function(x){ return x.date===t; }) || null;
  }
  function makeCheck(words, date){
    ensureRewardState();
    let c = db.dailyChecks.find(function(x){ return x.date===date; });
    if(c) return c;
    c = {
      id: Date.now(),
      date: date,
      wordIds: words.map(function(w){return w.id;}),
      passedIds: [],
      remainingIds: words.map(function(w){return w.id;}),
      attempts: [],
      status: 'ready',
      pointAwarded: false
    };
    db.dailyChecks.push(c);
    save();
    return c;
  }
  function award(check){
    ensureRewardState();
    if(db.points.days[check.date]){
      check.pointAwarded = true;
      check.status = 'passed';
      check.remainingIds = [];
      save();
      return false;
    }
    db.points.days[check.date] = DAILY_POINT;
    db.points.total = (db.points.total || 0) + DAILY_POINT;
    check.pointAwarded = true;
    check.status = 'passed';
    check.remainingIds = [];
    save();
    return true;
  }

  window.ensureRewardState = ensureRewardState;
  window.dailyPoint = todayPoint;

  const baseHome = home;
  home = function(){
    ensureRewardState();
    baseHome();
    const hero = app.querySelector('.card');
    if(hero){
      const box = document.createElement('div');
      box.className = 'pointSummary';
      box.innerHTML =
        '<span class="pointCoin">P</span>' +
        '<div><b>' + (db.points.total||0) + 'P</b><small>오늘 ' + todayPoint() + 'P</small></div>';
      hero.querySelector('.row')?.appendChild(box);
    }
    const c = findTodayCheck();
    if(c && c.status!=='passed'){
      const path = app.querySelector('.path');
      if(path){
        const card = document.createElement('div');
        card.className = 'card rewardStatus';
        const stateText = c.status==='pending'
          ? '부모님 채점 대기'
          : c.status==='retry'
            ? '틀린 ' + c.remainingIds.length + '단어 다시 도전'
            : '10단어 학습 후 최종 확인';
        const btnText = c.status==='pending' ? '채점 대기' : (c.status==='retry' ? '다시 도전' : '확인시험 시작');
        card.innerHTML =
          '<div><span class="pointCoin">P</span><b>오늘 500P 확인시험</b><small>' + stateText + '</small></div>' +
          '<button class="' + (c.status==='pending'?'ghost':'sun') + '" id="dailyCheckBtn" ' + (c.status==='pending'?'disabled':'') + '>' + btnText + '</button>';
        path.parentNode.insertBefore(card,path);
        const b = document.querySelector('#dailyCheckBtn');
        if(b && !b.disabled) b.onclick = function(){ dailyCheck(); };
      }
    }
  };

  const baseFinishDay = finishDay;
  finishDay = function(){
    const ss = db.sess;
    if(!ss) return baseFinishDay();
    const words = sessionWords(ss);
    if(words.length!==10) return baseFinishDay();

    const ids = words.flatMap(function(w){return [w.id,w.id+1];});
    ids.forEach(function(id){ if(!db.learned.includes(id)) db.learned.push(id); });
    db.days[ss.date] = Array.from(new Set((db.days[ss.date]||[]).concat(ids)));
    const maxIx = Math.max.apply(null, words.map(function(w){return WL.findIndex(function(x){return x.id===w.id;});}));
    if(maxIx>=0) db.wordNext = Math.max(db.wordNext,maxIx+1);
    db.focus[ss.date] = {ms:ss.activeMs||0,awayN:ss.awayN||0};
    db.sess = null;

    ensureRewardState();
    if(db.points.days[ss.date]){
      save();
      app.innerHTML =
        '<div class="card rewardLaunch"><span class="pointCoin bigCoin">P</span>' +
        '<h2>10단어 학습 완료</h2><div class="rewardAmount">오늘 500P 지급 완료</div>' +
        '<p>오늘은 이미 500포인트를 받았습니다. 하루 최대 500P입니다.</p>' +
        '<button class="pri big" id="rewardHome">홈으로</button></div>';
      document.querySelector('#rewardHome').onclick = function(){go('home');};
      return;
    }

    makeCheck(words,ss.date);
    save();
    app.innerHTML =
      '<div class="card rewardLaunch"><span class="pointCoin bigCoin">P</span>' +
      '<h2>10단어 학습 완료</h2><div class="rewardAmount">500P 도전</div>' +
      '<p>마지막 <b>10단어 확인시험</b>을 전부 통과하면 오늘의 500포인트를 받습니다.</p>' +
      '<p class="muted">이 시험은 학원 쪽지시험과 별도입니다. 틀린 단어는 다시 도전합니다.</p>' +
      '<button class="sun big" id="goDailyCheck">500P 확인시험 시작</button></div>';
    document.querySelector('#goDailyCheck').onclick = function(){dailyCheck();};
  };

  window.dailyCheck = function(){
    ensureRewardState();
    const check = findTodayCheck();
    if(!check || check.status==='passed') return go('home');
    if(check.status==='pending'){
      toast('부모님 채점을 기다리고 있어요');
      return go('home');
    }

    const ids = (check.remainingIds && check.remainingIds.length ? check.remainingIds : check.wordIds).slice();
    const list = shuffle(ids.map(byId).filter(Boolean));
    let i = 0;
    const answers = new Array(list.length).fill(null);
    let p1 = null, p2 = null;

    function draw(){
      if(i>=list.length) return review();
      const w = list[i], cs = charsOf(w), size = cellSize(2);
      app.innerHTML =
        '<div class="examHead"><div><span class="stepTag" style="margin:0">오늘 500P 확인시험</span>' +
        '<span class="jua examNo">' + (i+1) + ' / ' + list.length + '</span></div>' +
        '<span class="pointPill">전부 통과 = 500P</span></div>' +
        '<div class="prog" style="margin:10px 0 14px"><div style="width:' + ((i+1)/list.length*100) + '%"></div></div>' +
        '<div class="card rewardExam">' +
          '<div class="jua examPrompt">' + w.read + '</div>' +
          '<div class="writeClues">' + cs.map(function(c){return '<span>['+c.hun+' '+c.eum+']</span>';}).join('<b>+</b>') + '</div>' +
          '<p class="muted" style="text-align:center">' + w.mean + '</p>' +
          '<div class="row" id="rewardPad" style="justify-content:center;gap:10px"></div>' +
          '<div class="row" style="justify-content:center;margin-top:12px">' +
            '<button class="ghost" id="rUndo">한 획 되돌리기</button><button class="ghost" id="rClear">지우기</button>' +
          '</div>' +
        '</div>' +
        '<div class="examNav"><button class="ghost" id="rPrev" ' + (i?'':'disabled') + '>◀ 이전</button>' +
        '<span class="examAnswered">' + answers.filter(Boolean).length + '/' + list.length + ' 작성</span>' +
        '<button class="pri" id="rNext">' + (i<list.length-1?'다음 ▶':'답안 확인') + '</button></div>';

      const host = document.querySelector('#rewardPad');
      p1 = makePad(host,{cells:1,size:size});
      p2 = makePad(host,{cells:1,size:size});
      const old = answers[i];
      if(old){
        if(old.raw1) p1.load(old.raw1);
        if(old.raw2) p2.load(old.raw2);
      }
      document.querySelector('#rUndo').onclick = function(){ p2.strokes()?p2.undo():p1.undo(); };
      document.querySelector('#rClear').onclick = function(){p1.clear();p2.clear();};
      document.querySelector('#rPrev').onclick = function(){keep();i--;draw();};
      document.querySelector('#rNext').onclick = function(){
        if(!p1.strokes() || !p2.strokes()) return toast('두 글자를 모두 써 주세요');
        keep();
        if(i<list.length-1){i++;draw();} else review();
      };
    }

    function keep(){
      const w = list[i];
      answers[i] = {
        id:w.id,
        raw1:p1.raw(),
        raw2:p2.raw(),
        img:joinImg([p1,p2],90)
      };
    }

    function review(){
      const done = answers.filter(Boolean).length;
      app.innerHTML =
        '<div class="card examReview"><span class="pointCoin bigCoin">P</span>' +
        '<h2>500P 확인시험 답안 확인</h2><div class="score">' + done + ' / ' + list.length + ' 작성</div>' +
        '<p class="muted">제출 후 부모님이 O/X로 채점합니다. 모든 10단어가 O가 되어야 500P가 지급됩니다.</p>' +
        '<div class="row" style="justify-content:center;margin-top:16px">' +
          '<button class="ghost" id="backReward">마지막 문제</button>' +
          '<button class="ok" id="submitReward" ' + (done===list.length?'':'disabled') + '>부모님께 채점 요청</button>' +
        '</div></div>';
      document.querySelector('#backReward').onclick = function(){i=list.length-1;draw();};
      document.querySelector('#submitReward').onclick = function(){
        if(answers.filter(Boolean).length!==list.length) return toast('모든 문제를 작성해 주세요');
        check.attempts.push({
          id:Date.now(),
          date:today(),
          items:answers.map(function(a){return {id:a.id,img:a.img};}),
          grades:answers.map(function(){return null;}),
          status:'pending'
        });
        check.status='pending';
        save();
        app.innerHTML =
          '<div class="card" style="text-align:center"><span class="pointCoin bigCoin">P</span>' +
          '<h2>채점 요청 완료</h2><p>부모님이 전부 O로 채점하면 <b>500P</b>가 자동 지급됩니다.</p>' +
          '<button class="pri" id="rewardDoneHome">홈으로</button></div>';
        document.querySelector('#rewardDoneHome').onclick=function(){go('home');};
      };
    }

    draw();
  };

  function renderRewardGrade(v){
    ensureRewardState();
    const pending = db.dailyChecks.slice().reverse().find(function(c){return c.status==='pending';});
    if(!pending){
      const recent = db.dailyChecks.slice().reverse().slice(0,7);
      v.innerHTML =
        '<div class="card"><h3 style="margin-top:0">500P 확인시험</h3>' +
        (recent.length
          ? '<table><tr><th>날짜</th><th>상태</th><th>포인트</th></tr>' +
            recent.map(function(c){
              const st=c.status==='passed'?'완전 통과':c.status==='retry'?'재도전 필요':c.status==='pending'?'채점 대기':'학습 완료';
              return '<tr><td>'+c.date+'</td><td>'+st+'</td><td>'+(db.points.days[c.date]||0)+'P</td></tr>';
            }).join('') + '</table>'
          : '<p class="muted">아직 500P 확인시험 기록이 없습니다.</p>') +
        '</div>';
      return;
    }
    const attempt = pending.attempts[pending.attempts.length-1];
    const tally = function(){return attempt.grades.filter(function(g){return g===true;}).length;};
    v.innerHTML =
      '<div class="card rewardGrade"><div class="row gradeTop" style="justify-content:space-between">' +
      '<div><h3 style="margin:0">500P 확인시험 · '+pending.date+'</h3><span class="muted">전부 O = 500P 지급</span></div>' +
      '<div class="row"><button class="ghost" id="rewardAllO">남은 문항 모두 O</button><span class="score" id="rewardScore">'+tally()+'/'+attempt.items.length+'</span></div></div>' +
      '<div id="rewardRows"></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="ok" id="finishRewardGrade">채점 완료</button></div></div>';

    const rows=document.querySelector('#rewardRows');
    attempt.items.forEach(function(it,k){
      const w=byId(it.id),row=document.createElement('div');
      row.className='gradeRow';
      row.innerHTML =
        '<b class="jua">'+(k+1)+'</b>' +
        '<div class="gradeImgWrap"><img src="'+it.img+'" alt="500P 확인시험 답안"><span class="ansOverlay hz">'+w.word+'</span></div>' +
        '<div><div class="muted">'+w.read+' → 정답</div><div class="ans" style="font-size:32px">'+w.word+'</div></div>' +
        '<div class="gbtn"><button data-g="1">O</button><button data-g="0">X</button></div>';
      const paint=function(){
        const bs=row.querySelectorAll('.gbtn button');
        bs[0].className=attempt.grades[k]===true?'selO':'';
        bs[1].className=attempt.grades[k]===false?'selX':'';
      };
      row.querySelectorAll('.gbtn button').forEach(function(b){
        b.onclick=function(){
          attempt.grades[k]=b.dataset.g==='1';
          paint();
          document.querySelector('#rewardScore').textContent=tally()+'/'+attempt.items.length;
          save();
        };
      });
      paint();rows.appendChild(row);
    });

    document.querySelector('#rewardAllO').onclick=function(){
      attempt.grades=attempt.grades.map(function(g){return g===null?true:g;});
      save();pGrade(document.querySelector('#pv'));
    };
    document.querySelector('#finishRewardGrade').onclick=function(){
      const left=attempt.grades.filter(function(g){return g===null;}).length;
      if(left) return toast('아직 '+left+'문항을 채점하지 않았습니다');
      const passIds=[],failIds=[];
      attempt.items.forEach(function(it,k){
        if(attempt.grades[k]===true)passIds.push(it.id);else failIds.push(it.id);
      });
      pending.passedIds=Array.from(new Set((pending.passedIds||[]).concat(passIds)));
      attempt.status='graded';
      if(failIds.length){
        pending.remainingIds=failIds;
        pending.status='retry';
        failIds.forEach(function(id){addWrong(id);addWrong(id+1);});
        save();
        toast('틀린 '+failIds.length+'단어를 다시 도전합니다');
      }else{
        pending.remainingIds=[];
        const rewarded=award(pending);
        toast(rewarded?'완전 통과 · 500P 지급!':'완전 통과');
      }
      parent();
    };
  }

  const basePGrade = pGrade;
  pGrade = function(v){
    v.innerHTML='<div id="rewardGradeWrap"></div><div id="legacyGradeWrap" style="margin-top:14px"></div>';
    renderRewardGrade(document.querySelector('#rewardGradeWrap'));
    basePGrade(document.querySelector('#legacyGradeWrap'));
  };

  const baseRecord = record;
  record = function(){
    ensureRewardState();
    baseRecord();
    const h=app.querySelector('h2');
    if(h){
      const box=document.createElement('div');
      box.className='card pointRecord';
      box.innerHTML='<div class="pointCoin bigCoin">P</div><div><span class="muted">누적 포인트</span><div class="score">'+(db.points.total||0)+'P</div><small>하루 최대 500P · 10단어 완전 통과</small></div>';
      h.insertAdjacentElement('afterend',box);
    }
  };
})();