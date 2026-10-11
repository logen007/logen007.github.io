import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/ui/boot-layout.js',import.meta.url),'utf8');
const storage=new Map();
const context={window:{scrollY:0},location:{pathname:'/vi.html',search:'?tab=exams'},innerWidth:390,innerHeight:800,
  sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
  document:{getElementById:()=>null,createRange:()=>({selectNodeContents(){},getClientRects:()=>[{left:30,top:130,width:280,height:24}]})},
  getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',backgroundColor:'rgb(255, 255, 255)',borderTopWidth:'1px',borderRadius:'24px'})};
vm.runInNewContext(source,context);
const {valid,capture,clear}=context.window.G2GBootLayout;
assert.doesNotMatch(readFileSync(new URL('../vi.html',import.meta.url),'utf8'),/<header/);
const header={hidden:false,matches:selector=>selector.includes('.thanh-dau'),getBoundingClientRect(){throw new Error('Header must not be captured');}};
capture({querySelector:()=>null,getBoundingClientRect:()=>({left:0,top:0}),children:[header]});
assert.equal(storage.size,0);
const snapshot={path:'/vi.html?tab=exams',width:390,time:100,shapes:[{kind:'line',x:12,y:100,w:200,h:16,r:4}]};
assert.equal(valid(snapshot,390,snapshot.path,110),true);
assert.equal(valid(snapshot,400,snapshot.path,110),false);
assert.equal(valid(snapshot,390,'/vi.html?tab=grades',110),false);
assert.equal(valid(snapshot,390,snapshot.path,3600100),false);
assert.equal(valid({...snapshot,shapes:[{...snapshot.shapes[0],w:Infinity}]},390,snapshot.path,110),false);
assert.equal(valid({...snapshot,shapes:[{...snapshot.shapes[0],kind:'<script>'}]},390,snapshot.path,110),false);
const card={hidden:false,matches:()=>false,getBoundingClientRect:()=>({left:20,top:100,width:350,height:200}),
  childNodes:[{nodeType:3,textContent:'Private student name and answer'}]};
capture({querySelector:()=>null,getBoundingClientRect:()=>({left:0,top:0}),children:[card]});
const saved=JSON.parse([...storage.values()][0]);
assert.equal(saved.shapes[0].w,350);
assert.equal(saved.shapes[0].h,200);
assert.equal(saved.shapes[1].w,280);
assert.equal(saved.shapes[1].y,134.8);
assert.doesNotMatch(JSON.stringify(saved),/Private|student|answer|textContent|innerHTML/);
assert.equal(saved.path,'/vi.html?tab=exams');
clear();assert.equal(storage.size,0);
context.sessionStorage.setItem=()=>{throw new Error('Storage unavailable');};
assert.doesNotThrow(()=>capture({querySelector:()=>null,getBoundingClientRect:()=>({left:0,top:0}),children:[card]}));
console.log('Boot layout: measured dimensions, route/viewport/expiry isolation, privacy and unavailable storage passed.');
