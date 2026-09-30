const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');

assert(index.includes('v0.28.1</title>'));

// Legacy learning path: know the character first, then five-write.
const buildA=index.indexOf('function buildSteps');
const buildB=index.indexOf('const STEP_NAME',buildA);
const build=index.slice(buildA,buildB);
assert(build.includes("st.push({t:'learn',c,k});st.push({t:'he',c,k});st.push({t:'write',c,k})"));
assert(index.includes("획순 확인 완료 → 훈·음·획수 쓰기"));
assert(index.includes('<div class="stepTag">훈·음·획수 쓰기</div>'));
assert(index.includes('훈·음·획수 확인 → 5번 쓰기'));

// The red over-stroke banner is a real button and clears through the same clearInk path.
assert(index.includes("overClear.className='overClearBtn'"));
assert(index.includes("overClear.textContent='획수가 많아요 · 이 칸 지우기'"));
assert(index.includes('overClear.onclick=e=>'));
assert(index.includes('setEraser(false);clearInk()'));
assert(index.includes('clear(){clearInk()}'));
assert(index.includes('.pad.over .overClearBtn{display:block}'));

// Five-day primary flow: stroke -> recall gate -> five-write.
const studyA=flow.indexOf('function runStudy(setKey)');
const studyB=flow.indexOf('function buildQuizItems',studyA);
const study=flow.slice(studyA,studyB);
assert(study.includes("nextBtn.textContent=charLabel+' 획순 완료 → 훈·음·획수 쓰기'"));
assert(study.includes('nextBtn.onclick=function(){if(nextBtn.disabled)return;charRecallGate(setKey,st,w,c,charIndex,label)}'));

const writeA=flow.indexOf('function runFiveWrite');
const writeB=flow.indexOf('function startSet',writeA);
const five=flow.slice(writeA,writeB);
assert(!five.includes('return charRecallGate'));
assert(five.includes('st.studyPhase++;save();'));
assert(five.includes('runStudy(setKey);'));
assert(flow.includes('5번 쓰기 전 · 훈·음·획수 확인'));

console.log('v0.27.1 pre-write recall + clickable over-clear regression PASS');
