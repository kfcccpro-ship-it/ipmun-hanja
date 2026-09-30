const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');

assert(index.includes('v0.28.1</title>'));
assert(flow.includes('db.skillProfile=db.skillProfile||{chars:{},words:{}}'));
assert(flow.includes('function noteCharGap'));
assert(flow.includes('function noteWordGap'));
assert(flow.includes('function wordWeakScore'));
assert(flow.includes('function todayGapSummary'));
assert(flow.includes('모르겠어요 · 획순 다시 보기'));
assert(flow.includes('모르겠어요 · 다시 배우기'));
assert(flow.includes('id="v28ReadDontKnow"'));
assert(flow.includes('id="v28WriteDontKnow"'));
assert(flow.includes("noteWordGap(w,'strokeOrder')"));
assert(flow.includes("noteWordGap(w,'writing')"));
assert(flow.includes("data-t=\"weak\""));
assert(flow.includes('function pWeak'));
assert(flow.includes('약한 부분 지도'));
assert(flow.includes('id="v28QuickToday"'));
assert(flow.includes('id="v28QuickWeak"'));
assert(flow.includes('id="v28QuickRandom"'));
assert(flow.includes('function createSurprise'));
assert(flow.includes('v28AchievementGrid'));

function score(r){return ['hun','eum','strokeCount','strokeOrder','read','meaning','writing','help'].reduce((a,k)=>a+(+r[k]||0),0)}
assert.strictEqual(score({hun:1,eum:2,strokeCount:1}),4);
assert.strictEqual(score({writing:3,help:1}),4);

console.log('v0.28.1 mastery taxonomy + quick surprise regression PASS');
