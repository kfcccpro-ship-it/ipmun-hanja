const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const src=fs.readFileSync('assets/v30-exam.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/v30-exam.css','utf8');
assert(html.includes('v0.30.0</title>'));
assert(html.includes('assets/v30-exam.js?v=0.30.0'));
assert(css.includes('@media(orientation:portrait)'));
const items=[
 {id:1,detailPage:29,word:'加工',read:'가공',mean:'손질함',ch:'加',hun:'더할',eum:'가',bu:'力',hoek:5},
 {id:2,detailPage:29,word:'加工',read:'가공',mean:'손질함',ch:'工',hun:'장인',eum:'공',bu:'工',hoek:3},
 {id:3,detailPage:29,word:'可能',read:'가능',mean:'할 수 있음',ch:'可',hun:'옳을',eum:'가',bu:'口',hoek:5},
 {id:4,detailPage:29,word:'可能',read:'가능',mean:'할 수 있음',ch:'能',hun:'능할',eum:'능',bu:'月',hoek:10},
 {id:5,detailPage:30,word:'決定',read:'결정',mean:'정함',ch:'決',hun:'결단할',eum:'결',bu:'水',hoek:7},
 {id:6,detailPage:30,word:'決定',read:'결정',mean:'정함',ch:'定',hun:'정할',eum:'정',bu:'宀',hoek:8}
];
const context={
 window:{},ITEMS:items,db:{},console,
 uniqWords:a=>a.filter((x,i)=>a.findIndex(y=>y.word===x.word)===i),
 byId:n=>items.find(x=>x.id===n),
 charsOf:w=>items.filter(x=>x.word===w.word),
 save:()=>{},toast:()=>{},today:()=> '2026-10-31',
 Math,Date
};
vm.createContext(context);vm.runInContext(src,context);
const api=context.window.__hanjaExam30;
const all={start:29,end:30,lastId:6,count:20,types:['radical']};
const q=api.produce(all);
assert(q.length>0);
for(const it of q){
 assert(it.type==='radical');
 assert(it.options.includes(it.correct));
 assert(it.options.length>=2&&it.options.length<=4);
 assert.strictEqual(new Set(it.options).size,it.options.length);
}
const onlyFirst=api.pool({start:29,end:29,lastId:2});
assert.strictEqual(onlyFirst.length,1);
const filtered=api.produce({start:29,end:29,lastId:2,count:5,types:['radical']});
assert(filtered.every(x=>x.options.length===2));
const mixed=api.produce({start:29,end:30,lastId:6,count:20,types:['write','read','hun','eum','reverseHun','reverseEum','stroke','meaning','reverseMeaning','radical']});
assert(mixed.length===20);
assert(mixed.some(x=>x.type==='radical'));
assert(mixed.some(x=>x.type==='write'));
assert(mixed.every(x=>x.correct.length>0));
console.log('v0.30 textbook range, radial MCQ (2-4), 10 types, and 20-question mixture PASS');
