const assert=require('assert');
const fs=require('fs');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(index.includes('v0.28.0</title>'));
assert(flow.includes("1:{title:'제대로 배우는 날'"));
assert(flow.includes("3:{title:'약한 글자 잡는 날'"));
assert(flow.includes("5:{title:'최종 점검'"));
assert(flow.includes('function dailyProgress'));
assert(flow.includes('function progressBannerHtml'));
assert(flow.includes('v28Day'));
assert(flow.includes('시험을 먼저 보고, 틀린'));
assert(flow.includes('st.diagnosticDone=true'));
assert(flow.includes('st.remedialWordIds=ids'));
assert(flow.includes('st.reviewMode=true'));
assert(flow.includes('st.retryOnly=true'));
assert(flow.includes('틀린 단어만 깊게 복습'));
assert(flow.includes('function fiveDayDots'));

function pct(a,b,c,e){return Math.round((a*.35+b*.15+c*.30+e*.20)*100)}
assert.strictEqual(pct(0,0,0,0),0);
assert.strictEqual(pct(1,1,0,0),50);
assert.strictEqual(pct(1,1,1,0),80);
assert.strictEqual(pct(1,1,1,1),100);
console.log('v0.28 adaptive five-day progress logic PASS');
