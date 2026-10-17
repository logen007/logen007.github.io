import {iconHtml} from '../ui/icons.js';

const KEY='g2g.color-mode.v1';
let revealing=false;
export function currentColorMode(){return globalThis.document?.documentElement?.dataset?.colorMode==='dark'?'dark':'light';}
export function colorModeButtonHtml(){
  const dark=currentColorMode()==='dark';
  const label=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
  return `<button class="icon-btn color-mode-toggle" data-action="toggle-color-mode" data-no-tooltip aria-label="${label}" aria-pressed="${dark}">${iconHtml(dark?'sun':'moon')}</button>`;
}
export function applyColorMode(mode,{persist=false}={}){
  const value=mode==='dark'?'dark':'light',root=globalThis.document?.documentElement;
  if(root?.dataset)root.dataset.colorMode=value;
  if(persist)try{globalThis.localStorage?.setItem(KEY,value);}catch{}
  globalThis.document?.querySelectorAll?.('[data-action="toggle-color-mode"]').forEach(button=>{
    const label=value==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
    button.setAttribute('aria-label',label);
    button.setAttribute('aria-pressed',String(value==='dark'));
    button.innerHTML=iconHtml(value==='dark'?'sun':'moon');
  });
  return value;
}
export function initializeColorMode(){
  let saved;try{saved=globalThis.localStorage?.getItem(KEY);}catch{}
  return applyColorMode(saved==='dark'?'dark':'light');
}
export function toggleColorMode(trigger){
  if(revealing)return currentColorMode();
  const value=currentColorMode()==='dark'?'light':'dark';
  const doc=globalThis.document,root=doc?.documentElement;
  const apply=()=>applyColorMode(value,{persist:true});
  if(!doc?.startViewTransition||!root?.style||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return apply();
  const rect=(trigger||doc.querySelector?.('[data-action="toggle-color-mode"]'))?.getBoundingClientRect?.();
  const width=globalThis.innerWidth||root.clientWidth,height=globalThis.innerHeight||root.clientHeight;
  const x=rect?rect.left+rect.width/2:width/2,y=rect?rect.top+rect.height/2:height/2;
  const radius=Math.hypot(Math.max(x,width-x),Math.max(y,height-y));
  root.style.setProperty('--theme-reveal-x',x+'px');root.style.setProperty('--theme-reveal-y',y+'px');
  root.style.setProperty('--theme-reveal-radius',Math.ceil(radius)+1+'px');
  revealing=true;root.classList.add('color-mode-revealing');
  const cleanup=()=>{revealing=false;root.classList.remove('color-mode-revealing');};
  try{
    const transition=doc.startViewTransition(apply);
    transition.ready.catch(()=>{});
    transition.finished.catch(()=>{}).finally(cleanup);
  }catch{cleanup();return apply();}
  return value;
}
