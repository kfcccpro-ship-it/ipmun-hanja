class DrawingPad{
  constructor(canvas,initial=[],opts={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.opts=Object.assign({expectedStrokes:null,onChange:null,allowMouse:true,locked:false},opts);this.strokes=JSON.parse(JSON.stringify(initial||[]));this.current=null;this.active=false;this.activePointer=null;this.pendingResize=0;this.resize();this.bind();this.redraw();}
  setLocked(v){this.opts.locked=!!v;this.canvas.setAttribute('aria-disabled',this.opts.locked?'true':'false')}
  resize(){const r=this.canvas.getBoundingClientRect();if(r.width<8||r.height<8)return;const dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.floor(r.width*dpr));this.canvas.height=Math.max(1,Math.floor(r.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);this.cssW=r.width;this.cssH=r.height;this.redraw();}
  bind(){this.canvas.addEventListener('contextmenu',e=>e.preventDefault());this.canvas.addEventListener('selectstart',e=>e.preventDefault());this.canvas.addEventListener('dragstart',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{if(this.opts.locked){e.preventDefault();return}if(e.pointerType==='touch'){e.preventDefault();notePointer(e);return}if(e.pointerType==='mouse'&&!this.opts.allowMouse)return;if(e.pointerType==='mouse'&&e.button!==0)return;if(this.active)return;e.preventDefault();notePointer(e);try{this.canvas.setPointerCapture?.(e.pointerId)}catch(_){};this.active=true;this.activePointer=e.pointerId;this.current=[];this.strokes.push(this.current);const added=this.addPoint(e,true);if(added)this.drawDot(added)});
    this.canvas.addEventListener('pointermove',e=>{if(this.opts.locked)return;if(e.pointerType==='touch'){if(this.active)e.preventDefault();return}if(!this.active||e.pointerId!==this.activePointer)return;e.preventDefault();this.addEvent(e)});
    const end=e=>{if(!this.active||e.pointerId!==this.activePointer)return;e.preventDefault();this.active=false;this.activePointer=null;this.current=null;try{this.canvas.releasePointerCapture?.(e.pointerId)}catch(_){};this.notify()};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('lostpointercapture',e=>{if(this.active&&e.pointerId===this.activePointer){this.active=false;this.activePointer=null;this.current=null;this.notify()}});if(window.ResizeObserver){this.ro=new ResizeObserver(()=>{cancelAnimationFrame(this.pendingResize);this.pendingResize=requestAnimationFrame(()=>this.resize())});this.ro.observe(this.canvas)}}
  eventList(e){if(typeof e.getCoalescedEvents==='function'){try{const xs=e.getCoalescedEvents();if(xs&&xs.length){PEN_TELEMETRY.coalescedSupported=true;return xs}}catch(_){}}return [e]}
  addEvent(e){const list=this.eventList(e);for(const ev of list){notePointer(ev,list.length>1);const prev=this.current?.length?this.current[this.current.length-1]:null;const p=this.addPoint(ev,false);if(p&&prev)this.drawSegment(prev,p)}}
  addPoint(e,start){const r=this.canvas.getBoundingClientRect();const pressure=(e.pointerType==='pen'&&Number.isFinite(e.pressure)&&e.pressure>0)?e.pressure:.5;const p={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,pressure,pt:e.pointerType||'unknown',t:Date.now()};if(!start&&this.current?.length){const q=this.current[this.current.length-1];if(Math.hypot(p.x-q.x,p.y-q.y)<.0012)return null}this.current.push(p);return p}
  widthFor(p,pt){if(pt==='mouse')return 3.2;const t=penTuning();const v=Math.pow(Math.max(.08,Math.min(1,p||.5)),t.gamma);return t.minWidth+(t.maxWidth-t.minWidth)*v}
  prep(){const c=this.ctx;c.lineCap='round';c.lineJoin='round';c.strokeStyle='#111827';c.fillStyle='#111827'}
  drawDot(p){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight;if(!w||!h)return;this.prep();const r=this.widthFor(p.pressure,p.pt)/2;this.ctx.beginPath();this.ctx.arc(p.x*w,p.y*h,r,0,Math.PI*2);this.ctx.fill()}
  drawSegment(a,b){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight;if(!w||!h)return;this.prep();const c=this.ctx;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.lineWidth=this.widthFor((a.pressure+b.pressure)/2,b.pt||a.pt);c.stroke()}
  redraw(){const w=this.cssW||this.canvas.clientWidth,h=this.cssH||this.canvas.clientHeight,c=this.ctx;if(!w||!h)return;c.clearRect(0,0,w,h);for(const st of this.strokes){if(!st.length)continue;if(st.length===1){this.drawDot(st[0]);continue}for(let i=1;i<st.length;i++)this.drawSegment(st[i-1],st[i])}}
  notify(){this.opts.onChange?.(this)}
  clear(){if(this.opts.locked)return;this.strokes=[];this.current=null;this.active=false;this.activePointer=null;this.redraw();this.notify()}
  undo(){if(this.opts.locked)return;if(this.strokes.length){this.strokes.pop();this.redraw();this.notify()}}
  strokeCount(){return this.strokes.filter(st=>st&&st.length).length}
  data(){return this.strokes.filter(st=>st.length).map(st=>st.map(p=>({x:+p.x.toFixed(4),y:+p.y.toFixed(4),pressure:+(p.pressure||.5).toFixed(3),pt:p.pt||undefined})))}
}
const pads=new Map();
function makePad(canvas,initial=[],opts={}){const p=new DrawingPad(canvas,initial,opts);pads.set(canvas.id,p);return p}

/* Apple Pencil이 캔버스 경계를 조금 벗어나도 Safari의 텍스트/블록 선택으로 넘어가지 않게 한다. */
document.addEventListener('selectstart',e=>{const t=e.target;if(t?.closest?.('.penSafeZone')&&!t.closest('input,textarea,select'))e.preventDefault()},true);
document.addEventListener('dragstart',e=>{const t=e.target;if(t?.closest?.('.penSafeZone'))e.preventDefault()},true);
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='pen')return;const t=e.target;if(t?.closest?.('.penSafeZone')&&!t.closest('canvas,button,input,textarea,select,a'))e.preventDefault()},true);
