const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

global.window=global;
const words=Array.from({length:96},(_,i)=>({id:1+i*2,detailPage:29+Math.floor(i/4),word:'W'+(i+1)}));
global.ITEMS=words;
global.db={routineDays:{},weeklyPlan:null,quizProgress:null,dailyQuizPlans:{},wrong:{},points:{total:0,days:{}},dailyChecks:[],dailyScope:null};
global.byId=id=>words.find(w=>w.id===Number(id));
global.uniqWords=list=>{const seen=new Set();return list.filter(w=>w&&!seen.has(w.id)&&(seen.add(w.id),true));};
global.shuffle=list=>list.slice();
global.today=()=> '2026-09-21';
global.save=()=>{};
global.toast=()=>{};
global.wordsInAssignedScope=()=>[];
global.dailyScopeLabel=()=> '';
global.home=()=>{};
global.finishDay=()=>{};
global.parent=()=>{};
global.pDailyRange=()=>{};
global.app={querySelector:()=>null};
global.document={querySelector:()=>null};
global.go=()=>{};
global.startDay=()=>{};
global.dailyCheck=()=>{};
global.charsOf=()=>[];
global.cellSize=()=>100;
global.makePad=()=>({strokes:()=>1});
global.renderStrokePrefix=()=>{};
global.ptab='routine';

vm.runInThisContext(fs.readFileSync('assets/v23-daily-routine.js','utf8'),{filename:'assets/v23-daily-routine.js'});
const d=global.__routineDebug;
assert(d,'routine debug hooks missing');

db.weeklyPlan={wordIds:words.slice(0,10).map(w=>w.id),start:'2026-09-21',end:'2026-09-27'};
assert.strictEqual(d.weeklyWords().length,10,'current week must keep the same 10 words');
db.weeklyPlan={wordIds:words.slice(0,10).map(w=>w.id),start:'2026-09-14',end:'2026-09-20'};
assert.strictEqual(d.weeklyWords().length,0,'expired week must require a new weekly plan');

db.quizProgress={endPage:49,endWordId:null};
assert.strictEqual(d.cumulativeWords().length,84,'29-49 full range must contain 84 words');
const p49=words.filter(w=>w.detailPage===49);
db.quizProgress={endPage:49,endWordId:p49[2].id};
assert.strictEqual(d.cumulativeWords().length,83,'29 through the third word of page 49 must contain 83 words');

db.quizProgress={endPage:49,endWordId:null};
db.wrong={};
words.slice(0,12).forEach(w=>db.wrong[w.id]=3);
const pool=d.cumulativeWords();
const picked=d.makeDailyReview(pool,20);
assert.strictEqual(picked.length,20,'daily review must select 20 words');
assert.strictEqual(new Set(picked.map(w=>w.id)).size,20,'daily review must not duplicate words');
const wrongIds=new Set(words.slice(0,12).map(w=>w.id));
const recentIds=new Set(pool.slice(-12).map(w=>w.id));
assert(picked.filter(w=>wrongIds.has(w.id)).length>=8,'wrong words must get first priority');
assert(picked.filter(w=>recentIds.has(w.id)).length>=4,'recent progress must be represented');
assert(picked.some(w=>!wrongIds.has(w.id)&&!recentIds.has(w.id)),'older cumulative range must also be represented');

db.routineDays['2026-09-21']={learn:true,quiz:false};
db.points.days={};
let st=d.routineToday();
assert.strictEqual(st.learnCore,true);
assert.strictEqual(st.learn,false,'500P confirmation must remain before learning track is complete');
db.points.days['2026-09-21']=500;
st=d.routineToday();
assert.strictEqual(st.learn,true,'learning track completes after 500P confirmation');

db.points.days={};
db.dailyQuizPlans={};
const plan1=d.getDailyQuizPlan();
const ids1=plan1.wordIds.slice();
plan1.cursor=7;
const plan2=d.getDailyQuizPlan();
assert.deepStrictEqual(plan2.wordIds,ids1,'same-day 20-word set must stay stable');
assert.strictEqual(plan2.cursor,7,'same-day cursor must be resumable');

console.log('routine logic PASS', {weekly:10,cumulative49:84,daily:picked.length,resume:plan2.cursor});
