import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindExamQuestionSidebar} from '../src/ui/exam-question-sidebar.js';

class Element{
  constructor(dataset={},textContent=''){
    this.dataset=dataset;this.textContent=textContent;this.attrs={};this.events=new Map();
    const classes=new Set();this.classList={contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)};
  }
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of this.events.get(type)||[])fn(event);}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  closest(selector){return selector==='[data-question-jump]'?this.link||null:this.target||this;}
  matches(selector){return selector==='.cau-thi'&&this.card;}
}
const view=new Element();
let mobile=false,reducedMotion=false;
Object.assign(view,{scrollY:0,innerHeight:700,matchMedia:query=>({matches:query==='(max-width:680px)'?mobile:reducedMotion})});
let next=0;const frames=new Map(),timers=new Map();
view.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};
view.cancelAnimationFrame=id=>frames.delete(id);
view.setTimeout=fn=>{timers.set(++next,fn);return next;};view.clearTimeout=id=>timers.delete(id);
view.scrollTo=options=>{view.lastScroll=options;view.scrollY=options.top;};
const flush=()=>{for(const [id,fn] of frames){frames.delete(id);fn();}};
const toggle=new Element(),number=new Element(),sidebar=new Element(),root=new Element();
const links=['q1','heading','gap','table'].map((id,i)=>new Element({questionJump:id},String([1,9,20,25][i])));
const targets=[100,500,800,1200].map((top,i)=>{
  const node=new Element({q:links[i].dataset.questionJump});node.top=top;node.card=i===0;
  node.getBoundingClientRect=()=>({top:node.top-view.scrollY,bottom:node.top-view.scrollY+44,height:44});return node;
});
// Letter controls have no .cau-thi wrapper. The gap select itself can be hidden.
const controls=targets.map((target,i)=>{if(!i)return target;const control=new Element({q:target.dataset.q});control.target=target;return control;});
sidebar.querySelector=s=>s.includes('-toggle')?toggle:number;
sidebar.querySelectorAll=()=>links;sidebar.contains=node=>links.includes(node);
root.querySelector=s=>s==='[data-exam-question-sidebar]'?sidebar:null;
root.querySelectorAll=()=>controls;
root.ownerDocument={documentElement:{scrollHeight:5000}};
const click=link=>{link.link=link;sidebar.emit('click',{target:link,preventDefault(){},stopPropagation(){}});};
let cleanup=bindExamQuestionSidebar(root,view);
assert.equal(number.textContent,'1');
for(const i of [1,2,3]){
  click(links[i]);
  assert.equal(view.lastScroll.top,targets[i].top-96);
  assert.equal(view.lastScroll.behavior,'smooth');
  assert.equal(number.textContent,links[i].textContent);
  assert.equal(links[i].attrs['aria-current'],'true');
  view.emit('scroll');flush();
  assert.equal(number.textContent,links[i].textContent,'Smooth scrolling preserves the chosen number');
  view.emit('scrollend');flush();
  assert.equal(number.textContent,links[i].textContent);
}
view.scrollY=targets[1].top-96;view.emit('wheel');view.emit('scroll');flush();
assert.equal(number.textContent,'9','Manual scroll uses the real sidebar number');
targets[1].top+=650;view.emit('resize');flush();
assert.equal(number.textContent,'20','Layout updates reconsider the visible question');
toggle.emit('click');
assert.equal(sidebar.classList.contains('is-open'),true);
click(links[0]);
assert.equal(sidebar.classList.contains('is-open'),true,'Desktop question jumps keep the sidebar open');
assert.equal(toggle.attrs['aria-expanded'],'true');
assert.match(toggle.attrs['aria-label'],/^Đóng danh sách câu hỏi, câu 1$/);
mobile=true;
click(links[1]);
assert.equal(sidebar.classList.contains('is-open'),false,'Mobile question jumps still close the sidebar');
assert.equal(toggle.attrs['aria-expanded'],'false');
assert.match(toggle.attrs['aria-label'],/^Mở danh sách câu hỏi, câu 9$/);
cleanup();
for(const listeners of view.events.values())assert.equal(listeners.size,0);
assert.equal(frames.size,0);assert.equal(timers.size,0);
cleanup=bindExamQuestionSidebar(root,view);
assert.equal(view.events.get('scroll').size,1,'Rebinding has exactly one active scroll listener');
cleanup();
// A real DOM-like number strip: roll through intermediate integers, retarget and clean up.
root.ownerDocument.createElement=()=>{
  const node=new Element();node.style={};node.children=[];
  node.appendChild=child=>node.children.push(child);return node;
};
number.replaceChildren=(...children)=>{number.children=children;};
number.textContent='1';view.scrollY=0;mobile=false;
const advance=time=>{for(const [id,fn]of [...frames]){frames.delete(id);fn(time);}};
cleanup=bindExamQuestionSidebar(root,view);
click(links[1]);advance(0);advance(100);
assert.equal(number.children[0].className,'exam-question-number-track');
assert.ok(Number(number.children[0].children[0].textContent)>1);
assert.ok(Number(number.children[0].children[0].textContent)<9);
assert.match(number.children[0].style.transform,/translateY\(-/,'Increasing numbers slide up');
advance(240);assert.equal(number.textContent,'9');
click(links[0]);advance(300);advance(400);
assert.ok(Number(number.children[0].children[0].textContent)<9,'Decreasing numbers move back through smaller values');
click(links[2]);advance(420);advance(660);
assert.equal(number.textContent,'20','Rapid reversal finishes at the latest question');
reducedMotion=true;click(links[1]);
assert.equal(number.textContent,'9','Reduced motion updates immediately');
assert.equal(view.lastScroll.behavior,'auto');
reducedMotion=false;click(links[3]);assert.ok(frames.size>0);
cleanup();assert.equal(frames.size,0,'Cleanup cancels the number animation');
assert.equal(number.textContent,'25');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.exam-question-sidebar-panel \{[^}]*border-radius:0;/,'Sidebar panel has square corners');
assert.match(css,/\.exam-question-sidebar:has\(\.exam-question-link\.is-current\.is-answered\) \.exam-question-sidebar-toggle \{ color:var\(--brand-primary\); \}/,'Toggle text follows the answered state of the current question');
console.log('Sidebar: ordinary, heading, gap and table targets; real numbering, smooth jump, manual scroll and cleanup passed.');
