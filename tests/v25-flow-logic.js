const assert=require('assert');

function isoAdd(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
function active(p,date){return !!(p&&p.start<=date&&date<=p.end)}
function cycle(p,date){return active(p,date)?daysBetween(p.start,date)+1:0}
function cumulative(words,p){
  let list=words.filter(w=>w.page>=29&&w.page<=p.endPage);
  const ix=list.findIndex(w=>w.id===p.endWordId);
  return ix>=0?list.slice(0,ix+1):list;
}
function award(points,daily,date){
  if(!daily.set1.quizDone||!daily.set2.quizDone||points.days[date])return false;
  points.days[date]=500;points.total+=500;return true;
}

const p={start:'2026-09-26',end:isoAdd('2026-09-26',4)};
assert.strictEqual(p.end,'2026-09-30');
assert.strictEqual(active(p,'2026-09-26'),true);
assert.strictEqual(cycle(p,'2026-09-26'),1);
assert.strictEqual(cycle(p,'2026-09-30'),5);
assert.strictEqual(active(p,'2026-10-01'),false);

const words=[];let id=1;for(let page=29;page<=52;page++)for(let k=0;k<4;k++)words.push({id:id++,page});
assert.strictEqual(cumulative(words,{endPage:49,endWordId:84}).length,84);
assert.strictEqual(cumulative(words,{endPage:49,endWordId:83}).length,83);

const points={total:0,days:{}},daily={set1:{quizDone:true},set2:{quizDone:true}};
assert.strictEqual(award(points,daily,'2026-09-26'),true);
assert.strictEqual(points.total,500);
assert.strictEqual(award(points,daily,'2026-09-26'),false);
assert.strictEqual(points.total,500);

console.log('v0.25 five-day flow logic PASS');
