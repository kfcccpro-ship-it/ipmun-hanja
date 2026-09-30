const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');

assert(index.includes('v0.28.1</title>'));
assert(index.includes('const placed=[],gap='));
assert(index.includes('Math.hypot(q.x-x,q.y-y)<gap'));
assert(index.includes('window.innerHeight*.70'));

assert(flow.includes('function runFiveWrite'));
assert(flow.includes('1~3칸은 숫자 획순 따라쓰기'));
assert(flow.includes('4~5칸은 혼자 쓰기'));
assert(flow.includes('if(k<3)attachTraceGuide'));
assert(flow.includes('replayStrokeOrderMini'));
assert(flow.includes("let n=2,delayDone=false"));
assert(flow.includes('한 획 되돌리기'));
assert(flow.includes('이 칸 모두 지우기'));

const a=flow.indexOf('function runStudy(setKey)');
const b=flow.indexOf('function buildQuizItems',a);
const study=flow.slice(a,b);
assert(study.includes('Math.min(+st.studyPhase||0,4)'));
assert(study.includes('const charIndex=Math.floor(phase/2),isStroke=phase%2===0'));
assert(study.includes('return runFiveWrite'));
assert(study.includes('연예·아이돌·무대 예시'));
assert(study.includes('드라마·방송 대사처럼 소리 내어 읽기'));
assert(study.includes('charMemoryHtml(c,w)'));

assert(flow.includes('.wordBig{font-size:clamp(112px,22vw,190px)!important}'));
assert(flow.includes('.strokeHubChar b{font-size:78px!important}'));
console.log('v0.26 stroke-first five-write learning regression PASS');
