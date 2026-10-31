import assert from 'node:assert/strict';
import {bindAsciiReveals} from '../src/ui/ascii-reveal.js';
import {collectAsciiTargets,asciiContentUnits,asciiExclusion} from '../src/ui/ascii-policy.js';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/automatic',pretendToBeVisual:true});
const {window:win}=dom,doc=win.document,root=doc.querySelector('#app'),frames=new Map(),drawn=[];
let now=0,frameId=0,failCanvas=false,intersections;
Object.defineProperty(win.performance,'now',{value:()=>now});
win.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
win.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};win.cancelAnimationFrame=id=>frames.delete(id);
win.IntersectionObserver=class{constructor(callback){intersections=callback;}observe(){}unobserve(){}disconnect(){}};
const rect={left:10,top:10,bottom:42,right:510,width:500,height:32};
win.Element.prototype.getBoundingClientRect=function(){return this.closest('[hidden]')?{...rect,width:0,height:0}:this.getAttribute('data-offscreen')==='yes'?{...rect,top:2000,bottom:2032}:rect;};
win.Range.prototype.getBoundingClientRect=()=>rect;
win.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return {
  save(){},restore(){},beginPath(){},rect(){},clip(){},arc(){},stroke(){},fill(){},strokeRect(){},drawImage(){},fillRect(){},clearRect(){},fillText(text){drawn.push(text);},
  getImageData(){if(failCanvas)throw Error('synthetic capture failure');return {data:new Uint8ClampedArray(canvas.width*canvas.height*4).fill(255)};},
};};
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
const step=time=>{now=time;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(time);};
// Deliberately no project classes, opt-ins, IDs on content, or known page templates.
root.innerHTML='<div>Unmarked opening text <em>inline word</em></div><custom-tile><b>Arbitrary custom content</b><small>7</small></custom-tile><p>Ordinary paragraph</p><table><thead><tr><th>Unknown column</th></tr></thead><tbody><tr><td>Unknown fee</td></tr></tbody></table><button>Action</button><input placeholder="New field"><select><option>New dropdown</option></select><section><h2>New section</h2><p>Nested body</p></section><div contenteditable="true">Editor secret</div><div role="alert">Urgent secret</div><div class="exam-paper">Answer secret</div>';
const targets=collectAsciiTargets(root);
for(const unit of asciiContentUnits(root).filter(unit=>!asciiExclusion(unit)))assert.ok(targets.some(target=>target===unit||target.contains(unit)),'Every independently enumerated content unit has an owner');
const stop=bindAsciiReveals(root);
let report=stop.coverage();assert.equal(report.uncovered,0);assert.equal(report.pending,0);assert.equal(report.fallback,0);assert.equal(report.covered,12,'All twelve ordinary text/control units in the fixture participate');assert.ok(report.excluded>=3);
assert.ok(drawn.includes('Unmarked'));assert.ok(drawn.includes('Arbitrary'));assert.ok(drawn.includes('Unknown'));
assert.ok(!drawn.includes('secret'),'Protected content is never rasterized');
step(1200);
assert.equal(stop.coverage().uncovered,0,'Completion retains per-unit coverage evidence');
// A genuinely new child in a completed surface must not inherit an old covered flag.
const section=root.querySelector('section'),fresh=doc.createElement('div');fresh.textContent='Fresh asynchronous content';section.append(fresh);
assert.equal(stop.coverage().uncovered,1,'Audit catches a new unit before discovery rather than trusting an ancestor');
await flush();report=stop.coverage();assert.equal(report.uncovered,0);assert.equal(report.pending,0);assert.ok(drawn.includes('Fresh'),'A newly inserted unmarked child receives its own first reveal');
step(2400);
const empty=doc.createElement('div');root.append(empty);await flush();empty.append('Text inserted into an existing empty wrapper');await flush();
assert.equal(stop.coverage().uncovered,0);assert.ok(drawn.includes('inserted'),'Text-node additions are discovered without an element/class change');
step(3600);
const beforePolling=drawn.length,value=empty.firstChild;value.data='Existing readable polling update';await flush();assert.equal(stop.coverage().uncovered,0);assert.equal(drawn.length,beforePolling,'Readable character-data updates do not trigger a fresh reveal');
// Runtime fallback is explicitly reported, never counted as successful coverage.
failCanvas=true;const failed=doc.createElement('p');failed.textContent='Capture failure';root.append(failed);await flush();
report=stop.coverage();assert.equal(report.fallback,1);assert.equal(report.uncovered,0);assert.equal(report.reasons['snapshot-unavailable'],1);failCanvas=false;
// Saved OFF applies globally, including new automatically discovered content.
doc.documentElement.dataset.asciiEnabled='off';win.dispatchEvent(new win.Event('g2g-ascii-preference'));
const disabled=doc.createElement('div');disabled.textContent='New disabled content';root.append(disabled);await flush();
report=stop.coverage();assert.equal(report.uncovered,0);assert.ok(report.reasons['preference-or-accessibility']>=1);
stop();
doc.documentElement.dataset.asciiEnabled='on';doc.body.innerHTML='<main><div>Main content</div></main><div role="dialog"><h2>Floating dialog</h2><button>Close</button></div>';
const stopBody=bindAsciiReveals(doc.body);await flush();
assert.equal(stopBody.coverage().covered,3,'The shared document mount includes floating dialogs outside the app');
assert.equal(stopBody.coverage().uncovered,0);
assert.equal(doc.querySelectorAll('.ascii-reveal-layer').length,3,'Engine-owned canvases never recursively animate themselves');
stopBody();doc.body.innerHTML='<p>Loaded in a background tab</p>';
Object.defineProperty(doc,'hidden',{configurable:true,value:true});
const stopHidden=bindAsciiReveals(doc.body);assert.equal(stopHidden.coverage().pending,1,'Background-loaded content awaits its first visible appearance');
Object.defineProperty(doc,'hidden',{configurable:true,value:false});doc.dispatchEvent(new win.Event('visibilitychange'));await flush();
assert.equal(stopHidden.coverage().covered,1,'Foregrounding discovers content that has never had a visible reveal');
stopHidden();doc.body.innerHTML='<section><h2>Visible title</h2><p data-offscreen="yes">Below fold</p></section>';
const stopFold=bindAsciiReveals(doc.body);step(now+1200);
const below=doc.querySelector('p');below.removeAttribute('data-offscreen');
assert.equal(stopFold.coverage().pending,1,'Offscreen descendants cannot inherit completed coverage from a viewport-clipped parent');
intersections([{target:below,isIntersecting:true}]);assert.equal(stopFold.coverage().pending,0);assert.ok(drawn.includes('Below'));
stopFold();doc.body.innerHTML='<input type="checkbox"><input type="checkbox" checked><input type="radio" checked><input type="range" value="0"><input type="color" value="#ffcc00"><progress value="0" max="100"></progress><meter value="0" max="100"></meter>';
const stopNative=bindAsciiReveals(doc.body);assert.equal(stopNative.coverage().covered,7,'Native controls and zero-valued indicators have render adapters');assert.equal(stopNative.coverage().uncovered,0);assert.equal(stopNative.coverage().fallback,0);
stopNative();dom.window.close();
console.log('Automatic ASCII coverage: unmarked text/custom elements/tables/controls, new async children/text nodes, protected regions, honest capture failures and OFF preference passed on real DOM.');
