const assert=require('assert');
const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const flow=fs.readFileSync('assets/v25-five-day-flow.js','utf8');

assert(index.includes('v0.27.0</title>'));
assert(index.includes("er.className='padEraserMini'"));
assert(index.includes('const eraseAt=p=>'));
assert(index.includes('setEraser(v){setEraser(v)}'));
assert(index.includes("er.textContent=eraserMode?'✏️ 쓰기':'🧽 획 지우개'"));

assert(flow.includes('function speakKo'));
assert(flow.includes('window.SpeechRecognition||window.webkitSpeechRecognition'));
assert(flow.includes('🎤 따라 말하기'));
assert(flow.includes('음성은 저장하지 않습니다.'));
assert(flow.includes('function charRecallGate'));
assert(flow.includes('음·뜻·획수를 모두 기억했어요.'));
assert(flow.includes('st.writeCheckpoint[checkpointKey]=true'));
assert(flow.includes("pad1.strokes()===+cs[0].hoek"));
assert(flow.includes("pad2.strokes()===+cs[1].hoek"));
assert(flow.includes("normRecall(document.querySelector('#v27WordRead').value)===normRecall(w.read)"));
assert(flow.includes("normRecall(document.querySelector('#v27WordMean').value)===normRecall(w.mean)"));
assert(flow.includes('🔊 대사 듣기'));

console.log('v0.27 voice + recall gate + universal stroke eraser regression PASS');
