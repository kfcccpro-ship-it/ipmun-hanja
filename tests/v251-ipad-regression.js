const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');

assert(index.includes("layer.style.width=size+'px'"));
assert(index.includes("layer.style.left='50%'"));
assert(index.includes("layer.style.transform='translate(-50%,-50%)'"));
assert(index.includes("const ox=Math.max(edge,Math.min(size-edge"));
assert(index.includes("v0.26.0</title>"));

const a=flow.indexOf('function runStudy(setKey)');
const b=flow.indexOf('function buildQuizItems',a);
assert(a>=0&&b>a);
const runStudy=flow.slice(a,b);
assert(runStudy.includes('studyPhase'));
assert(runStudy.includes('const charIndex=Math.floor(phase/2)'));
assert(runStudy.includes('onFirstComplete:function()'));
assert.strictEqual((runStudy.match(/mountStrokeLesson\(/g)||[]).length,1);
assert(!runStudy.includes('cs.forEach(function(c,k){mountStrokeLesson'));
assert(runStudy.includes("st.studyPhase=phase+1"));
assert(runStudy.includes("st.studyPhase=0"));
assert(flow.includes('studyPhase:0'));

console.log('iPad stroke + sequential study regression PASS');
