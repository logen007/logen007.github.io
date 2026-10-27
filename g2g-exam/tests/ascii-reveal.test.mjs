import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindAsciiReveals} from '../src/ui/ascii-reveal.js';
import {paintAsciiBlock,prepareAsciiGraphics} from '../src/ui/ascii-snapshot.js';

// Deterministic DOM/canvas boundary, not browser rendering or a visual baseline.
function fixture(options={}){
  const events=()=>({listeners:new Map(),addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);},removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);},emit(name){for(const fn of [...this.listeners.get(name)||[]])fn();}});
  const layers=[],targets=[],frames=new Map(),observed=new Set(),paintedGlyphs=[],cleared=[];let mutations,intersections,id=0,reads=0,painted=0;
  const reduced={...events(),matches:Boolean(options.reduced)},forced={...events(),matches:false};
  const style={backgroundColor:'rgb(255, 255, 255)',color:'rgb(0, 0, 0)',font:'400 32px sans-serif',borderRadius:'18px',objectFit:'cover'};
  const win={...events(),navigator:{hardwareConcurrency:options.slow?2:8,connection:{saveData:Boolean(options.saveData)}},location:{pathname:'/courses',search:''},innerHeight:900,performance:{now:()=>0},NodeFilter:{SHOW_TEXT:4},
    matchMedia:query=>query.includes('reduced')?reduced:forced,getComputedStyle:()=>style,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    IntersectionObserver:class{constructor(fn){intersections=fn;}observe(node){observed.add(node);}unobserve(node){observed.delete(node);}disconnect(){observed.clear();}},
    MutationObserver:class{constructor(fn){mutations=fn;}observe(){}disconnect(){mutations=()=>{};}}};
  const doc={...events(),defaultView:win,hidden:false,fonts:{status:'loaded'},documentElement:{dataset:{asciiEnabled:options.disabled?'off':'on'}},body:{append(canvas){layers.push(canvas);}},
    createElement(){
      const canvas={style:{},setAttribute(name,value){this[name]=value;},remove(){const at=layers.indexOf(this);if(at>=0)layers.splice(at,1);},
        getContext(){return {
          save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(){},fillRect(){},clearRect(...args){cleared.push(args);},fillText(value){painted++;paintedGlyphs.push(value);},
          getImageData(){reads++;if(options.tainted)throw Error('Tainted image');return {data:Uint8ClampedArray.from({length:canvas.width*canvas.height*4},(_,i)=>[128,64,32,255][i%4])};},
        };},
      };
      return canvas;
    },
    createTreeWalker(element){let done=false;return {nextNode(){if(done)return null;done=true;return {textContent:'Hi',parentElement:element};}};},
    createRange(){return {setStart(){},setEnd(){},getBoundingClientRect:()=>({left:0,top:0,width:20,height:32})};}};
  const root={ownerDocument:doc,nodeType:1,matches:()=>false,querySelectorAll:()=>targets};
  function target(extra={}){const element={...events(),ownerDocument:doc,nodeType:1,tagName:'IMG',src:'/cover.jpg',currentSrc:'/cover.jpg',complete:true,naturalWidth:640,naturalHeight:320,isConnected:true,textContent:'Hi',parentElement:null,matches:()=>true,querySelectorAll:()=>[],closest:()=>null,contains(node){return node===this;},getBoundingClientRect:()=>({left:0,top:0,bottom:160,width:320,height:160}),...extra};targets.push(element);return element;}
  const initial=target(options.text?{tagName:'H1'}:{}),cleanup=bindAsciiReveals(root);
  return {win,doc,reduced,forced,layers,observed,initial,cleanup,frames,target,cleared,
    visible:element=>intersections([{target:element,isIntersecting:true}]),
    discover:element=>mutations([{addedNodes:[element]}]),
    mutate:records=>mutations(records),
    step:time=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));},
    get reads(){return reads;},get painted(){return painted;},get glyphs(){return paintedGlyphs;}};
}
{
  const f=fixture();f.initial.tagName='SECTION';
  const hole={getBoundingClientRect:()=>({left:20,top:30,width:80,height:44})};
  f.initial.querySelectorAll=selector=>selector.includes('[role=alert]')?[hole]:[];
  f.visible(f.initial);assert.equal(f.layers.length,1,'Card body receives a single content layer');
  assert.ok(f.cleared.some(args=>JSON.stringify(args)==='[18,28,84,48]'),'Alerts get transparent holes instead of being visually hidden');
  const nested=f.target({parentElement:{closest:()=>f.initial}});f.discover(nested);assert.equal(f.observed.has(nested),false,'Nested titles/covers do not create duplicate layers over a card');f.cleanup();
}
{
  const images=[],timers=new Map();let next=0,received;
  const svg={closest:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({width:120,height:90}),cloneNode:()=>({style:{setProperty(){}},setAttribute(){},querySelectorAll:()=>[]})};
  const win={setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),getComputedStyle:()=>({getPropertyValue:()=>''}),Image:class{constructor(){images.push(this);}},XMLSerializer:class{serializeToString(){return '<svg/>';}}};
  const element={querySelectorAll:()=>[svg]},cancel=prepareAsciiGraphics(element,win,value=>received=value);
  cancel();assert.equal(images[0].onload,null);assert.equal(timers.size,0,'Cancelled chart preparation leaves no timer/load listener');assert.equal(received,undefined);
  prepareAsciiGraphics(element,win,value=>received=value);images.at(-1).onerror();assert.deepEqual(received,[],'Failed SVG decode falls back without blocking content');
  prepareAsciiGraphics(element,win,value=>received=value);images.at(-1).onload();assert.equal(received[0].element,svg,'Decoded chart is tied to its real DOM geometry');
}
{
  const calls=[],box={left:10,top:20},bar={tagName:'SPAN',closest:()=>null,getBoundingClientRect:()=>({left:30,top:50,width:12,height:80})};
  const ctx={fillRect:(...args)=>calls.push(['bar',...args]),drawImage:(...args)=>calls.push(['svg',...args])};
  const svg={getBoundingClientRect:()=>({left:50,top:60,width:100,height:100})},image={};
  paintAsciiBlock({querySelectorAll:()=>[bar]},ctx,box,[{element:svg,image}],{getComputedStyle:()=>({backgroundColor:'rgb(20, 150, 80)'})},'button');
  assert.deepEqual(calls,[['bar',20,30,12,80],['svg',image,40,40,100,100]],'Actual bar geometry and decoded SVG graphics enter the content raster');
  bar.closest=()=>({});calls.length=0;
  paintAsciiBlock({querySelectorAll:()=>[bar]},ctx,box,[],{},'button');assert.equal(calls.length,0,'Excluded controls are not sampled');
  let ready=false;prepareAsciiGraphics({querySelectorAll:()=>[]},{},()=>{ready=true;});assert.equal(ready,true,'Text-only content starts without async delay');
}
{
  const f=fixture();f.visible(f.initial);assert.equal(f.layers.length,1);assert.equal(f.layers[0]['aria-hidden'],'true');assert.equal(f.initial.isConnected,true,'Real content is never removed or hidden');assert.ok(f.painted>0);
  f.step(0);const firstGlyphs=f.glyphs.slice(-10),reads=f.reads;f.step(120);
  assert.notDeepEqual(f.glyphs.slice(-10),firstGlyphs,'Glyphs actually animate instead of a static ASCII wipe');assert.equal(f.reads,reads,'Animated glyphs reuse the sampled source without extra pixel reads');
  f.step(800);assert.equal(f.layers.length,1,'The decode remains visible beyond the old 640ms cutoff');f.step(1200);assert.equal(f.layers.length,0);assert.equal(f.frames.size,0,'One short decode stops its frame loop');
  const same=f.target();f.discover(same);f.visible(same);assert.equal(f.layers.length,0,'Same route/content does not replay on ordinary rerenders');f.cleanup();
}
for(const options of [{reduced:true},{slow:true},{saveData:true},{tainted:true}]){
  const f=fixture(options);assert.doesNotThrow(()=>f.visible(f.initial));assert.equal(f.layers.length,0,'Unsupported/inaccessible images retain normal content');f.cleanup();
}
{
  const f=fixture({disabled:true});f.visible(f.initial);
  assert.equal(f.layers.length,0,'Saved global off preference prevents initial ASCII reveal');
  f.win.emit('g2g-ascii-preference');
  f.doc.documentElement.dataset.asciiEnabled='on';f.win.emit('g2g-ascii-preference');
  assert.equal(f.observed.has(f.initial),true,'Enabling re-observes existing nodes skipped while off');
  f.visible(f.initial);assert.equal(f.layers.length,1,'Existing content runs without a reload or a new DOM node');
  f.doc.documentElement.dataset.asciiEnabled='off';f.win.emit('g2g-ascii-preference');
  assert.equal(f.layers.length,0,'Turning ASCII off immediately cancels active decorative layers');assert.equal(f.frames.size,0);
  f.doc.documentElement.dataset.asciiEnabled='on';f.win.emit('g2g-ascii-preference');f.visible(f.initial);
  assert.equal(f.layers.length,1,'Off/on resets seen identities so previously revealed cards run again');
  const repeated=f.target();f.discover(repeated);f.visible(repeated);
  assert.equal(f.layers.length,1,'Ordinary rerenders still do not replay the same card');
  f.win.emit('g2g-ascii-preference');assert.equal(f.layers.length,1,'Repeated enabled notifications do not restart an active session');
  f.cleanup();assert.equal(f.win.listeners.get('g2g-ascii-preference').size,0,'Preference listener is disposed');
}
{
  const f=fixture({text:true});f.visible(f.initial);assert.equal(f.layers.length,1,'Featured text uses its actual text geometry');f.reduced.matches=true;f.reduced.emit('change');assert.equal(f.layers.length,0);f.cleanup();
}
{
  const f=fixture();f.initial.complete=false;f.visible(f.initial);assert.equal(f.layers.length,0,'Wait for the real image load without hiding it');f.initial.emit('error');assert.equal(f.frames.size,0);f.cleanup();assert.equal(f.initial.listeners.get('load').size,0);
}
{
  const f=fixture();f.visible(f.initial);f.win.emit('scroll');assert.equal(f.layers.length,0,'A viewport change removes fixed overlays immediately');f.cleanup();assert.equal(f.frames.size,0);assert.equal(f.observed.size,0);
}
{
  const f=fixture();f.visible(f.initial);
  const second=f.target({src:'/second.jpg',currentSrc:'/second.jpg'}),third=f.target({src:'/third.jpg',currentSrc:'/third.jpg'});
  for(const item of [second,third]){f.discover(item);f.visible(item);}assert.equal(f.layers.length,2,'Visible grid work is capped, remaining content renders normally');
  f.doc.hidden=true;f.doc.emit('visibilitychange');assert.equal(f.layers.length,0);f.cleanup();
}
{
  const f=fixture();const blocked=f.target({closest:()=>({})});f.discover(blocked);assert.equal(f.observed.has(blocked),false,'Exam/editor/table scope is excluded');f.cleanup();
}
{
  const f=fixture({text:true});f.doc.fonts.status='loading';f.visible(f.initial);assert.equal(f.layers.length,1,'Current fallback font can reveal while the webfont loads');
  for(let i=0;i<6;i++){
    const heading=f.target({tagName:'H2',id:'panel-'+i,textContent:'Dashboard '+i,getBoundingClientRect:()=>({left:0,top:0,bottom:28,width:160,height:28})});
    f.discover(heading);f.visible(heading);
  }
  assert.equal(f.layers.length,7,'Small dashboard headings are not silently discarded by the image concurrency cap');f.cleanup();
}
{
  const f=fixture({text:true});f.initial.id='dashboard-growth';f.visible(f.initial);
  f.mutate([{addedNodes:[],target:f.initial}]);assert.equal(f.layers.length,0,'Fresh polling data cancels the stale overlay immediately');
  const updated=f.target({tagName:'H2',id:'dashboard-growth',textContent:'42 học viên'});f.discover(updated);f.visible(updated);
  assert.equal(f.layers.length,0,'Stable heading identities do not replay on changed background values');f.cleanup();
}
{
  const f=fixture({text:true});f.initial.getAttribute=()=> 'exam:one';f.visible(f.initial);
  const sameTitle=f.target({tagName:'H3',getAttribute:()=> 'exam:two'});f.discover(sameTitle);f.visible(sameTitle);
  assert.equal(f.layers.length,2,'Separate exam IDs still reveal when their displayed title/content is identical');f.cleanup();
}
{
  const f=fixture({text:true});f.visible(f.initial);
  for(let i=0;i<12;i++){
    const heading=f.target({tagName:'H3',id:'exam-'+i,getBoundingClientRect:()=>({left:0,top:0,bottom:28,width:160,height:28})});
    f.discover(heading);f.visible(heading);
  }
  assert.equal(f.layers.length,12,'Simultaneous work remains bounded');
  f.step(0);f.step(1200);assert.equal(f.layers.length,1,'Overflow targets are queued and reveal after capacity is released, not silently discarded');
  f.step(1232);f.step(2400);assert.equal(f.layers.length,0);assert.equal(f.frames.size,0);f.cleanup();
}
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/\.ascii-reveal-layer \{[^}]*pointer-events:none; user-select:none/);
const login=readFileSync(new URL('../src/views/login.js',import.meta.url),'utf8'),courses=readFileSync(new URL('../src/courses/views.js',import.meta.url),'utf8');
assert.match(login,/id="landing-title" data-ascii-reveal="text"/);assert.match(courses,/<img data-ascii-reveal="image" class="course-cover/);assert.match(courses,/<h1 data-ascii-reveal="text"/);
console.log('ASCII reveal: real-content geometry, image failures, one-shot replay, reduced motion, visibility, scroll and cleanup passed with isolated DOM/canvas doubles.');

for(const type of ['INPUT','BUTTON','SELECT','SPAN']){
  const f=fixture();const control=f.target({tagName:type,id:'control-'+type,value:'Value',placeholder:'Search',getAttribute:name=>name==='role'&&type==='SPAN'?'status':null});f.discover(control);assert.ok(f.observed.has(control),type+' is eligible');f.visible(control);assert.equal(f.layers.length,1,type+' receives ASCII decoration');f.win.emit('focusin');assert.equal(f.layers.length,0,'Focus immediately clears decoration');f.cleanup();
}
