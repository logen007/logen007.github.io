import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindAsciiReveals} from '../src/ui/ascii-reveal.js';

// Deterministic DOM/canvas boundary, not browser rendering or a visual baseline.
function fixture(options={}){
  const events=()=>({listeners:new Map(),addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);},removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);},emit(name){for(const fn of [...this.listeners.get(name)||[]])fn();}});
  const layers=[],targets=[],frames=new Map(),observed=new Set();let mutations,intersections,id=0,reads=0,painted=0;
  const reduced={...events(),matches:Boolean(options.reduced)},forced={...events(),matches:false};
  const style={backgroundColor:'rgb(255, 255, 255)',color:'rgb(0, 0, 0)',font:'400 32px sans-serif',borderRadius:'18px',objectFit:'cover'};
  const win={...events(),navigator:{hardwareConcurrency:options.slow?2:8,connection:{saveData:Boolean(options.saveData)}},location:{pathname:'/courses',search:''},innerHeight:900,performance:{now:()=>0},NodeFilter:{SHOW_TEXT:4},
    matchMedia:query=>query.includes('reduced')?reduced:forced,getComputedStyle:()=>style,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    IntersectionObserver:class{constructor(fn){intersections=fn;}observe(node){observed.add(node);}unobserve(node){observed.delete(node);}disconnect(){observed.clear();}},
    MutationObserver:class{constructor(fn){mutations=fn;}observe(){}disconnect(){mutations=()=>{};}}};
  const doc={...events(),defaultView:win,hidden:false,fonts:{status:'loaded'},documentElement:{},body:{append(canvas){layers.push(canvas);}},
    createElement(){
      const canvas={style:{},setAttribute(name,value){this[name]=value;},remove(){const at=layers.indexOf(this);if(at>=0)layers.splice(at,1);},
        getContext(){return {
          drawImage(){},fillRect(){},clearRect(){},fillText(){painted++;},
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
  return {win,doc,reduced,forced,layers,observed,initial,cleanup,frames,target,
    visible:element=>intersections([{target:element,isIntersecting:true}]),
    discover:element=>mutations([{addedNodes:[element]}]),
    mutate:records=>mutations(records),
    step:time=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));},
    get reads(){return reads;},get painted(){return painted;}};
}
{
  const f=fixture();f.visible(f.initial);assert.equal(f.layers.length,1);assert.equal(f.layers[0]['aria-hidden'],'true');assert.equal(f.initial.isConnected,true,'Real content is never removed or hidden');assert.ok(f.painted>0);
  f.step(0);f.step(400);assert.equal(f.layers.length,1,'The reveal remains noticeable beyond the old 360ms cutoff');f.step(800);assert.equal(f.layers.length,0);assert.equal(f.frames.size,0,'One short decode stops its frame loop');
  const same=f.target();f.discover(same);f.visible(same);assert.equal(f.layers.length,0,'Same route/content does not replay on ordinary rerenders');f.cleanup();
}
for(const options of [{reduced:true},{slow:true},{saveData:true},{tainted:true}]){
  const f=fixture(options);assert.doesNotThrow(()=>f.visible(f.initial));assert.equal(f.layers.length,0,'Unsupported/inaccessible images retain normal content');f.cleanup();
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
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/\.ascii-reveal-layer \{[^}]*pointer-events:none; user-select:none/);
const login=readFileSync(new URL('../src/views/login.js',import.meta.url),'utf8'),courses=readFileSync(new URL('../src/courses/views.js',import.meta.url),'utf8');
assert.match(login,/id="landing-title" data-ascii-reveal="text"/);assert.match(courses,/<img data-ascii-reveal="image" class="course-cover/);assert.match(courses,/<h1 data-ascii-reveal="text"/);
console.log('ASCII reveal: real-content geometry, image failures, one-shot replay, reduced motion, visibility, scroll and cleanup passed with isolated DOM/canvas doubles.');
