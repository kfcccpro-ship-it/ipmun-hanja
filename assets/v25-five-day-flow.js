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
    db.v28=db.v28||{};
    db.skillProfile=db.skillProfile||{chars:{},words:{}};
    db.skillProfile.chars=db.skillProfile.chars||{};
    db.skillProfile.words=db.skillProfile.words||{};
    db.skillToday=db.skillToday||{};
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
  function selectSet2(pool,count=SET2_DAILY_WORDS,day=cycleDay(activePlan())){
    pool=uniqWords(pool);
    if(!pool.length)return [];
    const poolIds=new Set(pool.map(function(w){return w.id}));
    const oldWrong=uniqWords(Object.entries(db.wrong||{}).sort(function(a,b){return b[1]-a[1]})
      .map(function(x){return baseWord(+x[0])})
      .filter(function(w){return w&&poolIds.has(w.id)}));
    const tracked=weakWords(pool).filter(function(w){return wordWeakScore(w)>0});
    const wrong=uniqWords(tracked.concat(oldWrong));
    const recent=pool.slice(-Math.min(14,pool.length));
    const quota={
      1:{wrong:4,recent:10},
      2:{wrong:6,recent:8},
      3:{wrong:10,recent:6},
      4:{wrong:8,recent:4},
      5:{wrong:10,recent:2}
    }[Math.max(1,Math.min(5,+day||1))];
    const out=[];
    wrong.slice(0,Math.min(quota.wrong,count)).forEach(function(w){if(!out.some(function(x){return x.id===w.id}))out.push(w)});
    let recentN=0;
    shuffle(recent).forEach(function(w){
      if(out.length<count&&recentN<quota.recent&&!out.some(function(x){return x.id===w.id})){out.push(w);recentN++}
    });
    shuffle(pool).forEach(function(w){if(out.length<count&&!out.some(function(x){return x.id===w.id}))out.push(w)});
    return out.slice(0,Math.min(count,pool.length));
  }
  function normalizeV28Plan(d){
    if(!d||d.v28Adaptive)return d;
    const st=d.set2;
    if(st){
      st.diagnosticDone=!!st.diagnosticDone||!!st.quizDone;
      st.remedialWordIds=st.remedialWordIds||[];
      st.reviewMode=!!st.reviewMode;
      st.retryOnly=!!st.retryOnly;
      if(!st.quizDone&&!st.quizState&&!st.studyIndex&&!st.studyPhase&&!st.learnDone)st.learnDone=true;
    }
    d.v28Adaptive=true;
    return d;
  }
  function getDailyPlan(create=true,date=today()){
    ensureV25();
    const p=activePlan(date);
    if(!p)return null;
    const key=planKey(p);
    let d=db.dailySetPlans[date];
    if((!d||d.planKey!==key)&&create){
      const day=cycleDay(p,date);
      const s1=set1Words(p),s2=selectSet2(cumulativeWords(p),SET2_DAILY_WORDS,day);
      d={
        date,planKey:key,
        set1:{wordIds:s1.map(function(w){return w.id}),studyIndex:0,studyPhase:0,learnDone:false,quizDone:false,quizState:null},
        set2:{wordIds:s2.map(function(w){return w.id}),studyIndex:0,studyPhase:0,learnDone:true,quizDone:false,quizState:null,diagnosticDone:false,remedialWordIds:[],reviewMode:false,retryOnly:false},
        v28Adaptive:true,createdAt:Date.now()
      };
      db.dailySetPlans[date]=d;
      save();
    }else if(d&&d.planKey===key&&!d.v28Adaptive){
      normalizeV28Plan(d);save();
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

  function dayMission(day){
    return ({
      1:{title:'제대로 배우는 날',icon:'🌱',desc:'새 범위는 천천히 배우고, 2세트는 시험으로 아는 것부터 확인해요.'},
      2:{title:'기억에서 꺼내는 날',icon:'🧠',desc:'어제 배운 것을 스스로 떠올리고, 틀린 것만 다시 깊게 공부해요.'},
      3:{title:'약한 글자 잡는 날',icon:'🎯',desc:'오답이 많았던 글자와 획수·획순을 더 자주 만나게 해요.'},
      4:{title:'실전 예행연습',icon:'⏱️',desc:'학원 시험처럼 먼저 풀고, 막힌 단어만 바로 보충해요.'},
      5:{title:'최종 점검',icon:'🏁',desc:'이번 5일 학습을 마무리하며 약한 단어를 끝까지 다시 확인해요.'}
    })[Math.max(1,Math.min(5,+day||1))];
  }
  function quizFraction(st){
    if(!st)return 0;
    if(st.quizDone)return 1;
    const q=st.quizState;
    return q&&q.items?.length?Math.max(0,Math.min(1,(q.cursor||0)/q.items.length)):0;
  }
  function studyFraction(st,ids){
    if(!st)return 0;
    if(st.learnDone&&!st.reviewMode)return 1;
    const n=Math.max(1,(ids||st.wordIds||[]).length);
    return Math.max(0,Math.min(1,((st.studyIndex||0)+(st.studyPhase||0)/5)/n));
  }
  function dailyProgress(d){
    if(!d)return{pct:0,doneStages:0,current:'부모 설정 필요'};
    const s1=d.set1,s2=d.set2;
    const a=studyFraction(s1,s1.wordIds),b=s1.quizDone?1:quizFraction(s1);
    const c=s2.diagnosticDone?1:quizFraction(s2);
    let e=0;
    if(s2.quizDone)e=1;
    else if(s2.diagnosticDone){
      if(!s2.remedialWordIds?.length)e=1;
      else if(s2.reviewMode||!s2.learnDone)e=studyFraction(s2,s2.remedialWordIds)*.65;
      else e=.65+quizFraction(s2)*.35;
    }
    const pct=Math.round((a*.35+b*.15+c*.30+e*.20)*100);
    const doneStages=[s1.learnDone,s1.quizDone,!!s2.diagnosticDone,s2.quizDone].filter(Boolean).length;
    let current='1세트 학습';
    if(s1.learnDone&&!s1.quizDone)current='1세트 쪽지시험';
    else if(s1.quizDone&&!s2.diagnosticDone)current='2세트 실전 진단';
    else if(s2.diagnosticDone&&!s2.quizDone)current=s2.remedialWordIds?.length?'틀린 단어 집중 복습':'2세트 마무리';
    else if(s2.quizDone)current='오늘 학습 완료';
    return{pct,doneStages,current};
  }
  function progressBannerHtml(d){
    if(!d)return'';
    const p=activePlan(),day=cycleDay(p),m=dayMission(day),pr=dailyProgress(d);
    const stages=[
      ['1세트 학습',d.set1.learnDone],
      ['1세트 시험',d.set1.quizDone],
      ['2세트 실전',!!d.set2.diagnosticDone],
      ['오늘 완료',d.set2.quizDone]
    ];
    return `<div class="v28Progress">
      <div class="v28ProgressTop"><span class="v28Day">D${day}/5</span><div><b>${m.icon} ${m.title}</b><small>${m.desc}</small></div><strong>${pr.pct}%</strong></div>
      <div class="v28Bar"><i style="width:${pr.pct}%"></i></div>
      <div class="v28StageRow">${stages.map(function(x){return `<span class="${x[1]?'done':''}">${x[1]?'✓ ':''}${x[0]}</span>`}).join('')}</div>
      <div class="v28Current">지금: <b>${pr.current}</b> · ${pr.doneStages}/4 큰 단계 완료</div>
    </div>`;
  }
  function set2StatusText(st){
    if(st.quizDone)return '완료';
    if(!st.diagnosticDone)return st.quizState?'실전 진단 진행 중':'시험 먼저 보기 · 아는 것부터 확인';
    if(st.remedialWordIds?.length){
      if(st.reviewMode||!st.learnDone)return '틀린 '+st.remedialWordIds.length+'단어만 깊게 복습 중';
      return '집중 복습 완료 · 틀린 문제 다시 확인';
    }
    return '실전 진단 통과';
  }
  function set2ButtonText(st){
    if(st.quizDone)return '오늘 2세트 완료';
    if(!st.diagnosticDone)return st.quizState?'2세트 실전 이어하기':'2세트 실전시험 먼저 보기';
    if(st.reviewMode||!st.learnDone)return st.studyIndex?'틀린 단어 복습 이어하기':'틀린 단어 집중 복습';
    return '틀린 문제 다시 확인';
  }
  function fiveDayDots(p){
    if(!p)return'';
    let out='';
    for(let i=0;i<5;i++){
      const dt=isoAdd(p.start,i),x=db.dailySetPlans[dt],done=!!(x&&x.set1?.quizDone&&x.set2?.quizDone),cur=dt===today();
      out+=`<span class="${done?'done':''} ${cur?'cur':''}">D${i+1} ${done?'✓':cur?'●':'○'}</span>`;
    }
    return out;
  }

  function skillRecord(scope,key){
    ensureV25();
    const root=scope==='char'?db.skillProfile.chars:db.skillProfile.words;
    root[key]=root[key]||{hun:0,eum:0,strokeCount:0,strokeOrder:0,read:0,meaning:0,writing:0,help:0,last:null};
    return root[key];
  }
  function noteSkill(scope,key,type){
    const r=skillRecord(scope,key);
    r[type]=(r[type]||0)+1;r.last=today();
    db.skillToday[today()]=db.skillToday[today()]||{hun:0,eum:0,strokeCount:0,strokeOrder:0,read:0,meaning:0,writing:0,help:0};
    db.skillToday[today()][type]=(db.skillToday[today()][type]||0)+1;
    save();
  }
  function noteCharGap(c,type){if(c)noteSkill('char',c.ch,type)}
  function noteWordGap(w,type){if(w)noteSkill('word',String(w.id),type)}
  function skillScore(r){if(!r)return 0;return ['hun','eum','strokeCount','strokeOrder','read','meaning','writing','help'].reduce(function(a,k){return a+(+r[k]||0)},0)}
  function wordWeakScore(w){
    if(!w)return 0;
    let n=skillScore(db.skillProfile?.words?.[String(w.id)]);
    charsOf(w).forEach(function(c){n+=skillScore(db.skillProfile?.chars?.[c.ch])});
    return n;
  }
  function weakWords(pool){
    return uniqWords((pool||[]).filter(Boolean)).sort(function(a,b){return wordWeakScore(b)-wordWeakScore(a)});
  }
  function gapLabel(k){
    return ({hun:'훈',eum:'음',strokeCount:'획수',strokeOrder:'획순',read:'읽기',meaning:'뜻',writing:'쓰기',help:'모르겠어요'})[k]||k;
  }
  function todayGapSummary(date=today()){
    ensureV25();
    const x=db.skillToday[date]||{},pairs=Object.entries(x).filter(function(z){return +z[1]>0}).sort(function(a,b){return b[1]-a[1]});
    return {total:pairs.reduce(function(a,z){return a+(+z[1]||0)},0),top:pairs[0]?gapLabel(pairs[0][0]):'없음',pairs:pairs};
  }
  function quickWordPool(){
    const d=getDailyPlan(false),ids=[];
    manualPool().forEach(function(w){if(!ids.includes(w.id))ids.push(w.id)});
    if(d){[...(d.set1?.wordIds||[]),...(d.set2?.wordIds||[])].forEach(function(id){if(!ids.includes(id))ids.push(id)})}
    return ids.map(byId).filter(Boolean);
  }
  function createSurprise(wordIds){
    const ids=[...new Set((wordIds||[]).map(Number).filter(Boolean))];
    if(!ids.length)return false;
    db.surpriseTests.push({id:Date.now(),date:today(),wordIds:ids,status:'ready',cursor:0,answers:[],grades:Array.from({length:ids.length},function(){return null}),createdAt:Date.now()});
    save();return true;
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
    .v251CharCard{text-align:center}.v251SingleStroke{display:grid;justify-items:center;margin:8px auto 0;max-width:430px}.v251WordContext{display:grid;justify-items:center;gap:2px;margin-bottom:8px}.v251WordContext .hz{font-size:34px}.v251WordContext b{font-family:'Jua';font-size:24px}.v251WordContext small{color:var(--sub);font-size:15px}.v251CharMeta{font-family:'Jua';font-size:26px;margin-top:10px}.v251Combine{display:grid;grid-template-columns:auto auto auto auto minmax(150px,auto);gap:12px;align-items:center;justify-content:center;text-align:center;margin:10px 0 18px}.v251Combine>div{display:grid;gap:4px}.v251Combine b{font-size:52px}.v251Combine span{font-family:'Jua';font-size:18px}.v251Combine strong{font-family:'Jua';font-size:30px;color:var(--sub)}.v251Combine .result{padding-left:8px;border-left:2px solid var(--line)}.v251Combine .result b{color:var(--seal)}
    .v25QuizCard{text-align:center}.v25QuizCard .wordRead{font-size:52px}
    .v25Surprise{border:3px solid #E8B85D;background:#FFF8E4}
    .v25SurpriseList{display:grid;gap:10px}
    .v25GradeRow{display:grid;grid-template-columns:42px minmax(150px,1fr) minmax(180px,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
    .v25GradeRow img{max-width:220px;width:100%;background:#fff;border:1px solid var(--line);border-radius:8px}
    @media(max-width:760px){.v25Cards{grid-template-columns:1fr}.v25PickGrid{grid-template-columns:repeat(2,1fr)}.v25GradeRow{grid-template-columns:34px 1fr}.v25GradeRow .gbtn{grid-column:1/-1}.v25GradeRow img{max-width:100%}.v251Combine{grid-template-columns:1fr auto 1fr}.v251Combine>strong:nth-of-type(2){display:none}.v251Combine .result{grid-column:1/-1;border-left:0;border-top:2px solid var(--line);padding:10px 0 0}}
  `;
  style.textContent+=`
    /* v0.26: 약한 획수·획순을 위해 한자 표시를 기존 대비 약 1.5배 확대 */
    .wordBig{font-size:clamp(112px,22vw,190px)!important}
    .qword{font-size:clamp(112px,20vw,150px)!important}
    .word{font-size:66px!important}.ans{font-size:50px!important}
    .today{font-size:42px!important}.strokeHubChar b{font-size:78px!important}
    .strokeHubChar{min-height:170px!important}.v25Pick .hz{font-size:34px!important}
    .v25PlanSummary .hz{font-size:28px!important}.v25StudyWord{font-size:84px!important}
    .v251Combine b{font-size:72px!important}
    .strokeNum{width:30px!important;height:30px!important;font-size:16px!important}
    .strokeNum.current{transform:translate(-50%,-50%) scale(1.25)!important;-webkit-transform:translate(-50%,-50%) scale(1.25)!important}
    .v26StrokeCard{padding-left:16px;padding-right:16px}.v26HeroChar{font-size:72px;line-height:1}
    .v251CharMeta{display:flex!important;justify-content:center;align-items:center;gap:18px;flex-wrap:wrap;font-size:30px!important}
    .v26StrokeRule{max-width:760px;margin:12px auto;padding:13px 16px;border-radius:14px;background:#FFF8E4;border:2px solid #EED89B;font-family:'Jua';font-size:20px;line-height:1.5;text-align:center}
    .v26CharLearn{max-width:760px;margin:14px auto;display:grid;gap:10px}.v26MemoryLine{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;background:var(--paper);padding:12px 14px;border-radius:14px;text-align:left}
    .v26MemoryLine>.hz{font-size:72px;line-height:1}.v26MemoryLine strong{font-family:'Jua';font-size:25px}.v26MemoryLine span{font-size:18px}
    .v26ShapeTip{padding:10px 12px;border-left:6px solid var(--sky);background:var(--paper);border-radius:0 12px 12px 0;text-align:left;font-size:17px}
    .v26ExampleBox{padding:11px;background:var(--paper);border-radius:14px}.v26ExampleBox>b{font-family:'Jua';font-size:20px}.v26TermChips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px}
    .v26TermChips span{display:grid;justify-items:center;padding:8px 11px;background:var(--card);border:1px solid var(--line);border-radius:10px}.v26TermChips i{font-style:normal;font-size:34px}.v26TermChips small{font-size:13px;color:var(--sub)}
    .v26FiveWrite .note5{gap:16px!important}.v26WriteTitle{display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap}.v26WriteTitle>.hz{font-size:90px;line-height:1}.v26WriteTitle>div{display:grid;gap:4px}.v26WriteTitle b{font-family:'Jua';font-size:31px}.v26WriteTitle small{font-size:16px;color:var(--sub)}
    .v26FiveWrite .pad .num{font-size:20px!important}.v26FiveWrite .cnt{font-size:22px!important}
    .v26WordHero{font-size:clamp(112px,20vw,170px);text-align:center;line-height:1}.v26Meaning{max-width:760px;margin:14px auto;padding:14px 16px;border-radius:14px;background:var(--paper);text-align:center}.v26Meaning>b{font-family:'Jua';font-size:24px}.v26Meaning p{margin:7px 0 0;font-size:19px;line-height:1.5}
    .v26Examples{max-width:800px;margin:0 auto}.v26Examples .ex{font-size:19px;line-height:1.55;padding:12px 14px}.v26Examples .ex small{font-size:17px}
    .v26Dialogue{margin:12px 0;padding:14px 16px;border:2px solid #EED89B;border-radius:14px;background:#FFF8E4}.v26Dialogue small{display:block;font-family:'Jua';color:var(--sub);font-size:17px;margin-bottom:6px}.v26Dialogue b{display:block;font-size:21px;line-height:1.55}
    @media(max-width:600px){.strokeNum{width:27px!important;height:27px!important;font-size:14px!important}.v26MemoryLine{grid-template-columns:1fr;text-align:center}.v26MemoryLine>.hz{font-size:64px}.v251Combine b{font-size:58px!important}.v26WriteTitle>.hz{font-size:72px}}
  `;
  style.textContent+=`
    .v27VoiceBox{max-width:760px;margin:12px auto;padding:12px 14px;border:2px solid #BFD4F3;border-radius:14px;background:#F4F8FF;display:grid;gap:8px;text-align:center}.v27VoiceBox b{font-family:'Jua';font-size:23px}.v27VoiceBox small{display:block;color:var(--sub);font-size:14px;margin-top:3px}.v27VoiceStatus{min-height:26px;font-family:'Jua';font-size:17px;color:var(--sub)}
    .v27RecallCard{max-width:780px;margin-left:auto;margin-right:auto}.v27RecallChar{font-size:120px;text-align:center;line-height:1}.v27RecallFields{display:grid;grid-template-columns:1fr 1fr 160px;gap:12px;margin:16px 0}.v27RecallFields.two{grid-template-columns:1fr 1.5fr}.v27RecallFields label{display:grid;gap:5px}.v27RecallFields label>span{font-family:'Jua';font-size:18px}.v27RecallFields input{width:100%;font-size:25px;padding:13px 14px}.v27RecallFields input.bad{border-color:var(--seal);background:#FDECEA}
    .v27WordRecall{max-width:760px;margin:16px auto;padding:14px 16px;background:var(--paper);border:2px solid var(--line);border-radius:14px}.v27WordRecall h3{margin:0 0 4px;text-align:center}.v27StrokeCounts{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:10px 0}.v27StrokeCounts span{font-family:'Jua';font-size:19px;padding:7px 11px;border-radius:10px;background:var(--paper);border:2px solid var(--line)}.v27StrokeCounts span.ok{border-color:var(--leaf);color:var(--leaf)}.v27StrokeCounts span.bad{border-color:var(--seal);color:var(--seal)}
    @media(max-width:650px){.v27RecallFields,.v27RecallFields.two{grid-template-columns:1fr}.v27RecallChar{font-size:92px}.v27VoiceBox .row{justify-content:center}}
  `;
  style.textContent+=`
    .v28Progress{position:sticky;top:72px;z-index:16;margin:0 0 14px;padding:12px 14px;border:2px solid var(--sky);border-radius:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);box-shadow:0 5px 16px rgba(27,42,68,.08)}
    .v28ProgressTop{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.v28ProgressTop>div{display:grid;gap:1px}.v28ProgressTop b{font-family:'Jua';font-size:20px}.v28ProgressTop small{color:var(--sub);font-size:14px;line-height:1.35}.v28ProgressTop>strong{font-family:'Jua';font-size:28px;color:var(--sky)}
    .v28Day{font-family:'Jua';font-size:18px;padding:7px 9px;border-radius:10px;background:var(--ink);color:#fff}.v28Bar{height:12px;margin:9px 0 8px;background:var(--line);border-radius:99px;overflow:hidden}.v28Bar i{display:block;height:100%;background:var(--sky);border-radius:99px;transition:width .25s}
    .v28StageRow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.v28StageRow span{font-family:'Jua';font-size:14px;text-align:center;padding:5px 4px;border-radius:8px;background:var(--paper);color:var(--sub)}.v28StageRow span.done{background:#EAF7EF;color:#2E7D4F}.v28Current{text-align:center;font-size:14px;margin-top:7px;color:var(--sub)}
    .v28Mission{margin-top:12px;padding:11px 13px;border-radius:13px;background:#FFF8E4;border:1px solid #EED89B}.v28Mission b{font-family:'Jua';font-size:19px}.v28Mission p{margin:4px 0 0}
    .v28Adaptive{border:3px solid var(--sun);background:#FFF9E9}.v28Adaptive .score{font-size:46px}
    .v28Week{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}.v28Week span{font-family:'Jua';padding:7px 10px;border-radius:999px;background:var(--paper);border:1px solid var(--line)}.v28Week span.done{background:#EAF7EF;color:#2E7D4F}.v28Week span.cur{outline:3px solid var(--sky)}
    @media(max-width:700px){.v28Progress{top:62px}.v28ProgressTop{grid-template-columns:auto 1fr}.v28ProgressTop>strong{grid-column:1/-1;text-align:right;margin-top:-34px}.v28ProgressTop small{display:none}.v28StageRow{grid-template-columns:1fr 1fr}}
  `;
  style.textContent+=`
    .v28RecallActions{gap:10px;flex-wrap:wrap}.v28DontKnow{border-style:dashed!important;color:var(--seal)!important}
    .v28WeakGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v28WeakCard{padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--paper)}
    .v28WeakCard h4{margin:0 0 8px;font-family:'Jua';font-size:20px}.v28SkillTags{display:flex;gap:6px;flex-wrap:wrap}.v28SkillTags span{padding:5px 8px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:13px}
    .v28QuickTests{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.v28QuickTests button{min-height:70px}
    @media(max-width:700px){.v28RecallActions>*{flex:1 1 100%}.v28WeakGrid{grid-template-columns:1fr}.v28QuickTests{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  home=function(){
    ensureV25();
    const p=activePlan(),d=p?getDailyPlan(true):null,day=cycleDay(p),mission=dayMission(day),s1=p?set1Words(p):[],pool=p?cumulativeWords(p):[];
    const pending=db.surpriseTests.filter(function(x){return x.date===today()&&(x.status==='ready'||x.status==='in_progress')}).sort(function(a,b){return b.id-a.id})[0];
    const done=!!(d&&d.set1.quizDone&&d.set2.quizDone);
    app.innerHTML=`
      ${d?progressBannerHtml(d):''}
      <div class="card v25Hero">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:14px">
          <div><div class="v25Kicker">학원 수업·쪽지시험 대비</div><h1 style="margin:5px 0 6px">오늘도 한자 공부 시작!</h1>
          <p class="muted" style="margin:0"><b>1세트는 깊게 반복</b>하고, <b>2세트는 시험부터</b> 본 뒤 틀린 단어만 다시 공부합니다.</p></div>
          <div style="text-align:right">${p?`<span class="v25Day">D${day} / D5</span><div class="muted" style="margin-top:6px">${p.start} ~ ${p.end}</div>`:'<span class="pill wait">부모 설정 필요</span>'}</div>
        </div>
        ${p?`<div class="v28Mission"><b>${mission.icon} D${day} · ${mission.title}</b><p>${mission.desc}</p></div>`:''}
        ${done?`<p class="okMsg" style="margin:12px 0 0">오늘 학습 완료 · 500P ${db.points.days[today()]?'적립 완료':'적립 확인 중'}</p>`:''}
      </div>
      ${pending?`<div class="card v25Surprise" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><h2 style="margin:0">깜짝 쪽지시험 도착</h2><p style="margin:5px 0 0">${pending.wordIds.length}문제 · 오늘 공부한 단어에서 부모님이 직접 골랐어요.</p></div><span class="big">📝</span></div><button class="sun big" id="v25SurpriseStart">지금 시험 보기</button></div>`:''}
      ${p?`<div class="v25Cards">
        <div class="card v25Set"><span class="num">1</span><h2>① 깊게 복습하는 세트</h2><p class="muted">부모가 고른 ${s1.length}단어를 5일 동안 반복합니다. 획순·훈·음·획수·5번 쓰기를 끝까지 합니다.</p>
          <div class="v25PlanSummary">${s1.map(function(w){return `<span class="hz">${w.word}</span>`}).join('')}</div>
          <div class="v25Status ${d.set1.quizDone?'done':''}">${statusText(d.set1,d.set1.wordIds.length)}</div>
          <button class="pri big" id="v25Set1">${d.set1.quizDone?'오늘 1세트 완료':d.set1.learnDone?'1세트 쪽지시험 보기':d.set1.studyIndex?'1세트 이어하기':'1세트 학습 시작'}</button>
        </div>
        <div class="card v25Set ${d.set1.quizDone?'':'v25Locked'}"><span class="num">2</span><h2>② 실제 시험 대비 세트</h2><p class="muted">29쪽부터 현재 진도까지 누적 ${pool.length}단어. 오늘 ${d.set2.wordIds.length}단어는 <b>시험을 먼저 보고, 틀린 단어만 깊게 복습</b>합니다.</p>
          <div class="v25Status ${d.set2.quizDone?'done':''}">${d.set1.quizDone?set2StatusText(d.set2):'1세트 완료 후 열립니다'}</div>
          <button class="pri big" id="v25Set2" ${d.set1.quizDone?'':'disabled'}>${set2ButtonText(d.set2)}</button>
        </div>
      </div>`:`<div class="card" style="margin-top:14px;text-align:center"><h2>5일 학습 계획이 없습니다</h2><p class="muted">부모 모드에서 ① 복습 단어와 ② 현재 학원 진도 끝을 한 번 정하면 5일 동안 그대로 사용합니다.</p><button class="sun big" id="v25ParentSetup">부모 모드에서 설정</button></div>`}
      <div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><b class="jua" style="font-size:20px">오늘 보상</b><div class="muted">1세트와 2세트를 끝까지 완료하면 하루 500P</div></div><div class="score">${db.points.total||0}P</div></div></div>
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

  function normRecall(s){return String(s==null?'':s).toLowerCase().replace(/[\s.,·!?'"“”‘’()\[\]{}:;\-_/]/g,'')}
  function speakKo(text,statusEl){
    if(!('speechSynthesis' in window)){if(statusEl)statusEl.textContent='이 기기에서는 음성 듣기를 지원하지 않아요.';return false}
    try{
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(String(text||''));u.lang='ko-KR';u.rate=.78;u.pitch=1.03;
      const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
      const ko=voices.find(function(v){return /^ko(-|_)/i.test(v.lang||'')});if(ko)u.voice=ko;
      u.onstart=function(){if(statusEl)statusEl.textContent='잘 듣고 그대로 따라 말해 보세요.'};
      u.onend=function(){if(statusEl)statusEl.textContent='이제 마이크 버튼을 눌러 따라 말해도 좋아요.'};
      u.onerror=function(){if(statusEl)statusEl.textContent='음성을 재생하지 못했어요. 화면의 한글을 소리 내어 읽어 주세요.'};
      window.speechSynthesis.speak(u);return true;
    }catch(_){if(statusEl)statusEl.textContent='음성을 재생하지 못했어요.';return false}
  }
  function listenKo(expected,statusEl){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){if(statusEl)statusEl.textContent='이 iPad/브라우저는 마이크 따라 말하기 인식을 지원하지 않아요. 듣기 후 직접 소리 내어 따라 말해 주세요.';return}
    try{
      const r=new SR();r.lang='ko-KR';r.interimResults=false;r.maxAlternatives=3;let got=false;
      r.onstart=function(){if(statusEl)statusEl.textContent='듣고 있어요… 또박또박 말해 보세요.'};
      r.onresult=function(e){
        got=true;const alts=[];for(let i=0;i<e.results[0].length;i++)alts.push(e.results[0][i].transcript||'');
        const exp=normRecall(expected),ok=alts.some(function(x){const a=normRecall(x);return a===exp||a.includes(exp)||(a.length>=2&&exp.includes(a))});
        if(statusEl)statusEl.innerHTML=ok?'<span class="okMsg">잘했어요! “'+esc(alts[0])+'”라고 들렸어요.</span>':'<span class="badMsg">“'+esc(alts[0]||'')+'”라고 들렸어요. 한 번 더 따라 말해 보세요.</span>';
      };
      r.onerror=function(e){if(statusEl)statusEl.textContent=e.error==='not-allowed'?'마이크 사용 권한이 필요해요. 브라우저에서 마이크를 허용해 주세요.':'마이크 인식이 잘 되지 않았어요. 다시 눌러 말해 보세요.'};
      r.onend=function(){if(!got&&statusEl&&!statusEl.textContent)statusEl.textContent='말소리를 듣지 못했어요. 다시 해 보세요.'};
      r.start();
    }catch(_){if(statusEl)statusEl.textContent='마이크를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.'}
  }
  function bindVoice(listenSel,repeatSel,statusSel,speakText,expectedText){
    const a=document.querySelector(listenSel),b=document.querySelector(repeatSel),s=document.querySelector(statusSel);
    if(a)a.onclick=function(){speakKo(speakText,s)};
    if(b)b.onclick=function(){listenKo(expectedText,s)};
  }
  function voiceBoxHtml(prefix,title){
    return `<div class="v27VoiceBox"><div><b>${esc(title)}</b><small>듣고 → 그대로 따라 말해 보세요. 음성은 저장하지 않습니다.</small></div><div class="row" style="justify-content:center"><button class="sun" id="${prefix}Listen">🔊 듣기</button><button class="ghost" id="${prefix}Repeat">🎤 따라 말하기</button></div><div class="v27VoiceStatus" id="${prefix}Status"></div></div>`;
  }
  function charRecallGate(setKey,st,w,c,charIndex,label){
    app.innerHTML=progressBannerHtml(getDailyPlan(false))+`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label} · ${charIndex===0?'첫':'둘째'} 글자 확인</span><span class="jua">${st.studyIndex+1}단어 · ${charIndex+1}/2글자</span></div>
      <div class="card v27RecallCard" style="margin-top:12px">
        <div class="v27RecallChar hz">${c.ch}</div><h2 style="text-align:center;margin:8px 0">5번 쓰기 전 · 훈·음·획수 확인</h2>
        <p class="muted" style="text-align:center">어떤 글자인지 먼저 알고 쓰도록, 음·뜻(훈)·획수를 모두 맞혀야 5번 쓰기로 넘어갑니다.</p>
        ${voiceBoxHtml('v27RecallVoice','['+c.hun+' '+c.eum+']')}
        <div class="v27RecallFields">
          <label><span>음 · 소리</span><input id="v27CharEum" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="예: ${esc(c.eum)}"></label>
          <label><span>뜻 · 훈</span><input id="v27CharHun" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="예: ${esc(c.hun.split('/')[0])}"></label>
          <label><span>총 획수</span><input id="v27CharHoek" inputmode="numeric" pattern="[0-9]*" placeholder="몇 획?"></label>
        </div>
        <div id="v27RecallFb" class="hint" style="text-align:center"></div>
        <div class="row v28RecallActions" style="justify-content:space-between"><button class="ghost" id="v27RecallHome">오늘 화면</button><button class="ghost v28DontKnow" id="v28CharDontKnow">모르겠어요 · 획순 다시 보기</button><button class="pri" id="v27RecallCheck">음·뜻·획수 확인</button></div>
      </div>`;
    const voiceLabel=c.hun.split('/')[0]+' '+c.eum;
    bindVoice('#v27RecallVoiceListen','#v27RecallVoiceRepeat','#v27RecallVoiceStatus',voiceLabel,voiceLabel);
    document.querySelector('#v27RecallHome').onclick=function(){go('home')};
    document.querySelector('#v28CharDontKnow').onclick=function(){
      noteCharGap(c,'help');
      document.querySelector('#v27RecallFb').innerHTML=`<span class="badMsg">괜찮아요. 정답은 [${esc(c.hun)} ${esc(c.eum)}] · ${c.hoek}획이에요. 획순부터 다시 보고 와요.</span>`;
      st.studyPhase=charIndex*2;save();setTimeout(function(){runStudy(setKey)},700);
    };
    document.querySelector('#v27RecallCheck').onclick=function(){
      const e=normRecall(document.querySelector('#v27CharEum').value),h=normRecall(document.querySelector('#v27CharHun').value),n=+document.querySelector('#v27CharHoek').value;
      const okE=e===normRecall(c.eum),okH=c.hun.split('/').some(function(x){return h===normRecall(x)}),okN=n===+c.hoek;
      document.querySelector('#v27CharEum').classList.toggle('bad',!okE);document.querySelector('#v27CharHun').classList.toggle('bad',!okH);document.querySelector('#v27CharHoek').classList.toggle('bad',!okN);
      if(!okE)noteCharGap(c,'eum');if(!okH)noteCharGap(c,'hun');if(!okN)noteCharGap(c,'strokeCount');
      if(!(okE&&okH&&okN)){document.querySelector('#v27RecallFb').innerHTML='<span class="badMsg">'+[!okE?'음':null,!okH?'뜻':null,!okN?'획수':null].filter(Boolean).join(' · ')+'을 다시 확인해 보세요.</span>';return}
      document.querySelector('#v27RecallFb').innerHTML='<span class="okMsg">정답! 음·뜻·획수를 모두 기억했어요.</span>';
      st.studyPhase++;save();setTimeout(function(){runStudy(setKey)},650);
    };
  }

  function termReading(term){
    return Array.from(term||'').map(function(ch){return CHAR_INFO[ch]?.eum||''}).join('');
  }
  function charWordExamples(c,w){
    const info=CHAR_INFO[c.ch]||{},seen=new Set(),out=[];
    [w.word,...(info.referenceTerms||[])].forEach(function(term){
      if(!term||seen.has(term)||!term.includes(c.ch))return;
      const chars=Array.from(term);
      if(chars.length<2||chars.length>4||!chars.every(function(ch){return CHAR_INFO[ch]?.eum}))return;
      seen.add(term);out.push({term:term,read:termReading(term),main:term===w.word});
    });
    return out.slice(0,4);
  }
  function charMemoryHtml(c,w){
    const ex=charWordExamples(c,w),info=CHAR_INFO[c.ch]||{};
    return `<div class="v26CharLearn">
      <div class="v26MemoryLine"><b class="hz">${c.ch}</b><span><strong>[${esc(c.hun)} ${esc(c.eum)}]</strong><br>${esc(c.hun)}의 뜻을 가진 글자예요. <b>${w.word}(${esc(w.read)})</b>에 들어가요.</span></div>
      ${c.cmp?`<div class="v26ShapeTip"><b>모양 기억</b> · ${esc(c.cmp)}</div>`:''}
      ${ex.length?`<div class="v26ExampleBox"><b>이 글자가 들어간 낱말</b><div class="v26TermChips">${ex.map(function(x){return `<span><i class="hz">${x.term}</i><small>${esc(x.read)}${x.main?' · 오늘 단어':''}</small></span>`}).join('')}</div></div>`:''}
      ${info.semanticSenses?.length?`<div class="muted" style="text-align:center">뜻 느낌 · ${info.semanticSenses.slice(0,3).map(esc).join(' · ')}</div>`:''}
    </div>`;
  }
  function v26WriteCellSize(){
    const w=Math.min(window.innerWidth||800,980);
    return Math.min(215,Math.max(155,Math.floor((w-82)/3)));
  }
  function runFiveWrite(setKey,st,w,c,charIndex,label){
    const cs=v26WriteCellSize();
    app.innerHTML=progressBannerHtml(getDailyPlan(false))+`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label} · ${charIndex===0?'첫':'둘째'} 글자 5번 쓰기</span><span class="jua">${st.studyIndex+1}단어 · ${charIndex+1}/2글자</span></div>
      <div class="card v26FiveWrite" style="margin-top:12px">
        <div class="v26WriteTitle"><span class="hz">${c.ch}</span><div><b>[${esc(c.hun)} ${esc(c.eum)}]</b><small>총 ${c.hoek}획 · 1~3칸은 숫자 획순 따라쓰기 · 4~5칸은 혼자 쓰기</small></div></div>
        ${voiceBoxHtml('v27WriteVoice','['+c.hun+' '+c.eum+']')}
        <div class="note5" id="v26WriteGrid"></div>
        <div id="v26WriteFeedback" class="writeFeedback" aria-live="polite"></div>
        <div class="row" style="justify-content:space-between;margin-top:10px;gap:10px">
          <span class="cnt" id="v26WriteCount"></span>
          <div class="row"><button class="ghost" id="v26Undo">한 획 되돌리기</button><button class="ghost" id="v26Clear">이 칸 모두 지우기</button></div>
        </div>
        <div id="v26WriteDone" style="text-align:center"></div>
        <div class="row" style="justify-content:flex-start;margin-top:12px"><button class="ghost" id="v26WriteHome">오늘 화면</button></div>
      </div>`;
    const voiceLabel=c.hun.split('/')[0]+' '+c.eum;
    bindVoice('#v27WriteVoiceListen','#v27WriteVoiceRepeat','#v27WriteVoiceStatus',voiceLabel,voiceLabel);
    const pads=[];let cur=0,tick=null,counting=false,feedbackTimer=null,cycle=0,overMarked=false;
    const countEl=document.querySelector('#v26WriteCount');
    const stat=function(){const p=pads[cur];countEl.textContent=cur>=5?'5 / 5칸 완료':(cur+1)+' / 5 · '+(p?p.strokes():0)+'/'+c.hoek+'획'};
    const setCur=function(){overMarked=false;pads.forEach(function(p,i){p.lock(i!==cur);p.el.classList.toggle('active',i===cur)});stat()};
    const clearFeedback=function(){clearTimeout(feedbackTimer);feedbackTimer=null;const f=document.querySelector('#v26WriteFeedback');if(f){f.classList.remove('show');f.innerHTML=''}};
    const cancelT=function(){cycle++;clearInterval(tick);tick=null;counting=false;clearFeedback();const p=pads[cur],o=p&&p.el.querySelector('.cd'),rr=p&&p.el.querySelector('.postStrokeReplay');if(o)o.remove();if(rr)rr.remove()};
    const guidedFeedback=function(p,index,token,done){
      if(index>2){done();return}
      const f=document.querySelector('#v26WriteFeedback');
      if(f){f.innerHTML=`<span class="simpleHunEum">[${esc(c.hun)} ${esc(c.eum)}] · ${c.hoek}획</span>`;f.classList.add('show')}
      feedbackTimer=setTimeout(clearFeedback,2000);
      replayStrokeOrderMini(p,c.ch,c.hoek,function(){if(token===cycle)done()});
    };
    const finish=function(){
      countEl.textContent='5 / 5칸 완료';
      document.querySelector('#v26Clear').style.display='none';document.querySelector('#v26Undo').style.display='none';
      db.notes[today()]=db.notes[today()]||{};db.notes[today()][c.id]=joinImg(pads,72,1,1,c.ch);
      st.studyPhase++;save();
      runStudy(setKey);
    };
    const startTimer=function(){
      if(counting||cur>=5)return;
      counting=true;const p=pads[cur],doneIndex=cur,token=++cycle;let n=2,delayDone=false,replayDone=doneIndex>2;
      const o=document.createElement('div');o.className='cd';o.textContent=n;p.el.appendChild(o);
      const maybe=function(){
        if(token!==cycle||!delayDone||!replayDone)return;
        clearInterval(tick);tick=null;counting=false;clearFeedback();if(o&&o.isConnected)o.remove();
        p.el.classList.add('done');cur++;if(cur<5)setCur();else finish();
      };
      if(doneIndex<3)guidedFeedback(p,doneIndex,token,function(){replayDone=true;maybe()});
      tick=setInterval(function(){
        if(!alive(p.el))return cancelT();
        if(--n>0){o.textContent=n;return}
        clearInterval(tick);tick=null;delayDone=true;if(o&&o.isConnected)o.textContent='✓';maybe();
      },1000);
    };
    for(let k=0;k<5;k++){
      const p=makePad(document.querySelector('#v26WriteGrid'),{cells:1,size:cs,trace:'',alpha:0,
        onDown:function(){if(k===cur)cancelT()},
        onChange:function(){if(k!==cur)return;const n=pads[cur].strokes();stat();pads[cur].el.classList.toggle('over',n>c.hoek);if(n>c.hoek&&!overMarked){overMarked=true;noteCharGap(c,'strokeCount')}if(n===c.hoek)startTimer();else cancelT()}
      });
      const b=document.createElement('div');b.className='num';b.textContent=k+1;p.el.appendChild(b);
      if(k<3)attachTraceGuide(p,c.ch,cs,k);
      pads.push(p);
    }
    setCur();
    document.querySelector('#v26Undo').onclick=function(){if(cur<5){cancelT();pads[cur].undo();stat()}};
    document.querySelector('#v26Clear').onclick=function(){if(cur<5){cancelT();pads[cur].clear();stat()}};
    document.querySelector('#v26WriteHome').onclick=function(){cancelT();go('home')};
  }

  function startSet(setKey){
    const d=getDailyPlan(true);if(!d)return toast('부모 모드에서 5일 계획을 먼저 설정해 주세요');
    const st=d[setKey];
    if(setKey==='set2'&&!d.set1.quizDone)return toast('1세트를 먼저 완료해 주세요');
    if(st.quizDone)return toast('오늘 이 세트는 완료했습니다');
    if(setKey==='set2'){
      if(!st.diagnosticDone)return runSetQuiz('set2');
      if(st.reviewMode||!st.learnDone)return runStudy('set2');
      return runSetQuiz('set2');
    }
    if(st.learnDone)return runSetQuiz(setKey);
    runStudy(setKey);
  }

  function runStudy(setKey){
    const d=getDailyPlan(true),st=d&&d[setKey];if(!st)return go('home');
    const sourceIds=(setKey==='set2'&&st.remedialWordIds?.length&&st.reviewMode)?st.remedialWordIds:st.wordIds;
    const words=sourceIds.map(byId).filter(Boolean);
    let i=Math.max(0,Math.min(+st.studyIndex||0,words.length));
    if(i>=words.length){st.learnDone=true;st.studyPhase=0;if(setKey==='set2'&&st.remedialWordIds?.length){st.reviewMode=false;st.retryOnly=true}save();return runSetQuiz(setKey)}
    const w=words[i],cs=charsOf(w),phase=Math.max(0,Math.min(+st.studyPhase||0,4));
    const label=setKey==='set1'?'1세트 · 이번 주 복습':'2세트 · 실제 시험 대비';
    const progress=Math.round(((i+(phase/5))/Math.max(1,words.length))*100);

    if(phase<4){
      const charIndex=Math.floor(phase/2),isStroke=phase%2===0,c=cs[charIndex],charLabel=charIndex===0?'첫 글자':'둘째 글자';
      if(!isStroke)return runFiveWrite(setKey,st,w,c,charIndex,label);
      const size=Math.min(620,Math.max(410,Math.min(window.innerWidth-46,window.innerHeight*.68)));
      const voiceLabel=c.hun.split('/')[0]+' '+c.eum;
      app.innerHTML=progressBannerHtml(d)+`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label} · ${charLabel} 큰글씨 획순</span><span class="jua">${i+1} / ${words.length}단어 · ${charIndex+1}/2글자</span></div>
        <div class="prog" style="margin:10px 0 14px"><div style="width:${progress}%"></div></div>
        <div class="card v251CharCard v26StrokeCard">
          <div class="v251SingleStroke" id="v251SingleStroke"></div>
          <div class="v251CharMeta"><span class="hz v26HeroChar">${c.ch}</span><span>[${esc(c.hun)} ${esc(c.eum)}] · <b>${c.hoek}획</b></span></div>
          <div class="v26StrokeRule"><b>1 → 2 → 3… 숫자를 눈으로 따라가며</b> 펜을 공중에서 같이 움직여 보세요. 획순 자동재생이 끝나야 5번 쓰기로 넘어갑니다.</div>
          ${voiceBoxHtml('v27CharVoice','['+c.hun+' '+c.eum+']')}
          ${charMemoryHtml(c,w)}
          <div class="row" style="justify-content:space-between;margin-top:14px"><button class="ghost" id="v251StudyHome">오늘 화면</button><button class="pri" id="v251CharNext" disabled>획순 자동 재생 중…</button></div>
        </div>`;
      bindVoice('#v27CharVoiceListen','#v27CharVoiceRepeat','#v27CharVoiceStatus',voiceLabel,voiceLabel);
      const nextBtn=document.querySelector('#v251CharNext');
      mountStrokeLesson(document.querySelector('#v251SingleStroke'),c.ch,c.hoek,{size:size,auto:true,onFirstComplete:function(){
        if(!nextBtn||!document.body.contains(nextBtn))return;
        nextBtn.disabled=false;nextBtn.textContent=charLabel+' 획순 완료 → 훈·음·획수 쓰기';
      }});
      document.querySelector('#v251StudyHome').onclick=function(){go('home')};
      nextBtn.onclick=function(){if(nextBtn.disabled)return;charRecallGate(setKey,st,w,c,charIndex,label)};
      return;
    }

    const size=Math.min(230,Math.max(170,Math.floor((Math.min(window.innerWidth,820)-90)/2)));
    const star=w.star||('연예·방송에서 '+w.read+'이라는 말을 찾아보세요.');
    app.innerHTML=progressBannerHtml(d)+`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label} · 두 글자 단어 쓰임</span><span class="jua">${i+1} / ${words.length}단어 · 5/5</span></div>
      <div class="prog" style="margin:10px 0 14px"><div style="width:${Math.round(((i+1)/words.length)*100)}%"></div></div>
      <div class="card v251WordCard v26WordUsage">
        <div class="v26WordHero hz">${w.word}</div><div class="wordRead">${esc(w.read)}</div>
        ${voiceBoxHtml('v27WordVoice',w.read)}
        <div class="v251Combine">
          <div><b class="hz">${cs[0].ch}</b><span>[${esc(cs[0].hun)} ${esc(cs[0].eum)}]</span></div><strong>+</strong>
          <div><b class="hz">${cs[1].ch}</b><span>[${esc(cs[1].hun)} ${esc(cs[1].eum)}]</span></div><strong>→</strong>
          <div class="result"><b class="hz">${w.word}</b><span>${esc(w.read)}</span></div>
        </div>
        <div class="v26Meaning"><b>이 단어는 이렇게 써요</b><p>뜻: ${esc(w.mean)}<br>이 뜻을 나타낼 때 <strong>${esc(w.read)}</strong>이라고 말하거나 써요.</p></div>
        <div class="v26Examples">
          <div class="ex" style="border-color:var(--ink)"><small>교재 예문</small>${w.sent}</div>
          <div class="ex"><small>초등 4학년 생활 예시</small>${w.nat}</div>
          <div class="ex star entertainmentEx"><small>연예·아이돌·무대 예시</small>${star}</div>
          <div class="v26Dialogue"><small>드라마·방송 대사처럼 소리 내어 읽기</small><b>“${star}”</b><button class="ghost" id="v27LineListen" style="margin-top:8px">🔊 대사 듣기</button></div>
        </div>
        <div class="v27WordRecall">
          <h3>단어 기억 확인</h3><p class="muted">읽는 소리(음), 뜻, 두 글자의 획수를 모두 맞혀야 다음 단어로 넘어갑니다.</p>
          <div class="v27RecallFields two">
            <label><span>음 · 읽는 소리</span><input id="v27WordRead" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="읽는 소리"></label>
            <label><span>뜻</span><input id="v27WordMean" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="위에서 배운 뜻"></label>
          </div>
        </div>
        <p class="muted" style="text-align:center">두 글자를 각각 <b>정확한 획수</b>로 써 보세요. 각 쓰기 칸의 지우개로 잘못 쓴 획만 지울 수 있어요.</p>
        <div id="v251StudyPad" class="row" style="justify-content:center;gap:12px"></div>
        <div class="v27StrokeCounts"><span id="v27Count0">${cs[0].ch} · 0/${cs[0].hoek}획</span><span id="v27Count1">${cs[1].ch} · 0/${cs[1].hoek}획</span></div>
        <div id="v27WordFb" class="hint" style="text-align:center"></div>
        <div class="row v28RecallActions" style="justify-content:space-between;margin-top:14px"><button class="ghost" id="v251StudyHome">오늘 화면</button><button class="ghost v28DontKnow" id="v28WordDontKnow">모르겠어요 · 다시 배우기</button><button class="pri" id="v251StudyNext">${i<words.length-1?'음·뜻·획수 확인 → 다음 단어':'음·뜻·획수 확인 → 쪽지시험'}</button></div>
      </div>`;
    bindVoice('#v27WordVoiceListen','#v27WordVoiceRepeat','#v27WordVoiceStatus',w.read+'. '+w.mean,w.read);
    document.querySelector('#v27LineListen').onclick=function(){speakKo(star,document.querySelector('#v27WordVoiceStatus'))};
    let pad1,pad2;
    const updateCounts=function(){
      if(!pad1||!pad2)return;
      const n1=pad1.strokes(),n2=pad2.strokes();
      const e0=document.querySelector('#v27Count0'),e1=document.querySelector('#v27Count1');
      e0.textContent=cs[0].ch+' · '+n1+'/'+cs[0].hoek+'획';e1.textContent=cs[1].ch+' · '+n2+'/'+cs[1].hoek+'획';
      e0.classList.toggle('bad',n1>cs[0].hoek);e1.classList.toggle('bad',n2>cs[1].hoek);
      e0.classList.toggle('ok',n1===cs[0].hoek);e1.classList.toggle('ok',n2===cs[1].hoek);
    };
    pad1=makePad(document.querySelector('#v251StudyPad'),{cells:1,size:size,onChange:updateCounts});
    pad2=makePad(document.querySelector('#v251StudyPad'),{cells:1,size:size,onChange:updateCounts});
    updateCounts();
    document.querySelector('#v251StudyHome').onclick=function(){go('home')};
    const wordDontKnow=document.querySelector('#v28WordDontKnow');if(wordDontKnow)wordDontKnow.onclick=function(){noteWordGap(w,'help');noteWordGap(w,'writing');st.studyPhase=0;save();runStudy(setKey)};
    document.querySelector('#v251StudyNext').onclick=function(){
      const readOk=normRecall(document.querySelector('#v27WordRead').value)===normRecall(w.read);
      const meanOk=normRecall(document.querySelector('#v27WordMean').value)===normRecall(w.mean);
      const strokeOk1=pad1.strokes()===+cs[0].hoek,strokeOk2=pad2.strokes()===+cs[1].hoek;
      document.querySelector('#v27WordRead').classList.toggle('bad',!readOk);document.querySelector('#v27WordMean').classList.toggle('bad',!meanOk);
      if(!readOk)noteWordGap(w,'read');if(!meanOk)noteWordGap(w,'meaning');if(!strokeOk1)noteCharGap(cs[0],'strokeCount');if(!strokeOk2)noteCharGap(cs[1],'strokeCount');if(!(strokeOk1&&strokeOk2))noteWordGap(w,'writing');
      if(!(readOk&&meanOk&&strokeOk1&&strokeOk2)){
        document.querySelector('#v27WordFb').innerHTML='<span class="badMsg">'+[!readOk?'음':null,!meanOk?'뜻':null,!(strokeOk1&&strokeOk2)?'획수':null].filter(Boolean).join(' · ')+'을 다시 확인해 보세요.</span>';return;
      }
      recordLearned(setKey,w);st.studyIndex=i+1;st.studyPhase=0;
      if(st.studyIndex>=words.length){
        st.learnDone=true;
        if(setKey==='set2'&&st.remedialWordIds?.length){st.reviewMode=false;st.retryOnly=true}
      }
      save();
      document.querySelector('#v27WordFb').innerHTML='<span class="okMsg">정답! 음·뜻·획수를 모두 맞혔어요.</span>';
      setTimeout(function(){if(st.learnDone)return runSetQuiz(setKey);runStudy(setKey)},650);
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
    if(setKey==='set1'&&!st.learnDone)return runStudy(setKey);
    if(setKey==='set2'&&st.diagnosticDone&&(st.reviewMode||!st.learnDone))return runStudy(setKey);
    const useRemedial=setKey==='set2'&&st.diagnosticDone&&st.retryOnly&&st.remedialWordIds?.length;
    const words=(useRemedial?st.remedialWordIds:st.wordIds).map(byId).filter(Boolean),q=ensureQuizState(setKey,st,words);
    if(q.cursor>=q.items.length){
      if(setKey==='set2'&&!st.diagnosticDone){
        st.diagnosticDone=true;
        if(q.misses.length){
          const ids=[];q.misses.forEach(function(x){if(!ids.includes(x.id))ids.push(x.id)});
          st.remedialWordIds=ids;st.quizState=null;st.learnDone=false;st.reviewMode=true;st.retryOnly=false;st.studyIndex=0;st.studyPhase=0;save();
          app.innerHTML=progressBannerHtml(d)+`<div class="card routineDone v28Adaptive"><h2>시험에서 다시 볼 단어를 찾았어요</h2><div class="score">${ids.length}단어</div><p>20단어를 모두 다시 쓰지 않습니다. <b>틀린 ${ids.length}단어만</b> 획순·훈·음·획수·5번 쓰기로 집중 복습합니다.</p><button class="pri big" id="v28DeepReview">틀린 단어만 깊게 복습</button></div>`;
          document.querySelector('#v28DeepReview').onclick=function(){runStudy('set2')};return;
        }
        st.quizDone=true;st.retryOnly=false;st.quizState=null;save();return finishSet(setKey,d);
      }
      if(q.misses.length){
        const seen=new Set(),again=q.misses.filter(function(x){const k=x.type+':'+x.id;if(seen.has(k))return false;seen.add(k);return true});
        q.items=again;q.cursor=0;q.misses=[];q.round++;save();
        app.innerHTML=progressBannerHtml(d)+`<div class="card routineDone"><h2>틀린 문제만 다시!</h2><div class="score">${again.length}문제</div><p>깊게 복습한 뒤, 틀렸던 문제만 다시 확인합니다. 전부 맞으면 오늘 세트가 끝나요.</p><button class="pri" id="v25Retry">다시 도전</button></div>`;
        document.querySelector('#v25Retry').onclick=function(){runSetQuiz(setKey)};return;
      }
      st.quizDone=true;st.quizState=null;st.retryOnly=false;st.reviewMode=false;save();
      return finishSet(setKey,d);
    }
    const item=q.items[q.cursor],w=byId(item.id),cs=charsOf(w);
    const label=setKey==='set1'?'1세트 쪽지시험':(!st.diagnosticDone?'2세트 실전 진단':'2세트 복습 확인');
    const top=progressBannerHtml(d)+`<div class="row" style="justify-content:space-between"><span class="stepTag" style="margin:0">${label}${q.round>1?' · 재도전 '+q.round+'회차':''}</span><span class="jua">${q.cursor+1} / ${q.items.length}</span></div><div class="prog" style="margin:10px 0 14px"><div style="width:${(q.cursor+1)/q.items.length*100}%"></div></div>`;
    if(item.type==='read'){
      app.innerHTML=top+`<div class="card v25QuizCard"><div class="wordBig">${w.word}</div><p class="q">읽는 소리를 쓰세요</p><input id="v25ReadAns" class="heIn" style="max-width:340px;margin:0 auto;display:block;text-align:center" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><div id="v25ReadFb" class="hint"></div><button class="pri big" id="v25ReadCheck">확인</button></div>`;
      const check=function(){
        const inp=document.querySelector('#v25ReadAns'),v=inp.value.replace(/\s/g,'');if(!v)return toast('답을 써 주세요');
        const ok=v===w.read;if(!ok)markMiss(q,item);
        document.querySelector('#v25ReadFb').innerHTML=ok?'<span class="okMsg">정답!</span>':`<span class="badMsg">정답은 ${esc(w.read)}</span>`;
        document.querySelector('#v25ReadCheck').disabled=true;save();
        setTimeout(function(){q.cursor++;save();runSetQuiz(setKey)},ok?700:1200);
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
      app.innerHTML=progressBannerHtml(d)+'<div class="card routineDone"><h2>1세트 완료</h2><div class="score">복습 끝</div><p>깊게 배운 복습 세트를 끝냈어요. 이제 2세트는 <b>시험을 먼저</b> 보고, 틀린 것만 다시 공부합니다.</p><button class="pri big" id="v25GoSet2">2세트 실전 시작</button><button class="ghost" id="v25GoHome">오늘 화면</button></div>';
      document.querySelector('#v25GoSet2').onclick=function(){startSet('set2')};
      document.querySelector('#v25GoHome').onclick=function(){go('home')};
    }else{
      const got=award500(today()),p=activePlan(),day=cycleDay(p),learned=manualPool().length,rem=d.set2.remedialWordIds?.length||0;
      app.innerHTML=progressBannerHtml(d)+`<div class="card routineDone"><h2>오늘 학습 완료</h2><div class="score">${got?'+500P':'500P'}</div>
        <p><b>D${day}/5</b>를 끝까지 완료했어요. 오늘 ${learned}단어를 공부했고, 2세트에서 다시 볼 단어 ${rem}개도 끝까지 해결했습니다.</p>
        <div class="v28Week">${fiveDayDots(p)}</div>
        <p class="okMsg" style="margin-top:16px">${day<5?'내일은 오늘 헷갈린 단어가 자동으로 더 자주 나와요.':'5일 학습 완료! 학원 쪽지시험 전에 최종 점검만 하면 됩니다.'}</p>
        <button class="pri big" id="v25DoneHome">오늘 화면으로</button></div>`;
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
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">② 2세트 · 실제 쪽지시험 범위</h3><p class="muted"><b>시작은 항상 29쪽</b>입니다. 부모는 현재 학원 진도의 <b>마지막 단어</b>만 정합니다. 이 범위에서 매일 최대 20단어를 골라 <b>실전시험을 먼저</b> 봅니다. 틀린 단어만 깊게 복습한 뒤 다시 확인합니다.</p>
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
      document.querySelector('#v25RangePreview').innerHTML=`<b>29쪽 → ${last?last.detailPage:pg}쪽 · ${last?last.word:'-'}까지 · 누적 ${list.length}단어</b><div class="muted">매일 이 범위에서 최대 ${SET2_DAILY_WORDS}단어를 선정하고, 실전시험 → 틀린 단어 집중복습 순서로 진행합니다.</div>`;
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

  window.__v25Debug={activePlan,cycleDay,set1Words,cumulativeWords,selectSet2,getDailyPlan,manualPool,award500,dayMission,dailyProgress,set2StatusText};
  ensureV25();
})();
