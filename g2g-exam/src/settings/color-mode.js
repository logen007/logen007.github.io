import {iconHtml} from '../ui/icons.js';

const KEY='g2g.color-mode.v1';
const REVEAL_DEADLINE=1600; // Allow the 800ms wave to finish, but never latch the control.
let revealing=null;
export function currentColorMode(){return globalThis.document?.documentElement?.dataset?.colorMode==='dark'?'dark':'light';}
export function colorModeButtonHtml(){
  const dark=currentColorMode()==='dark';
  const label=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
  return `<button type="button" class="icon-btn color-mode-toggle" data-action="toggle-color-mode" data-no-tooltip aria-label="${label}" aria-pressed="${dark}">${iconHtml(dark?'sun':'moon')}</button>`;
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
  const value=(revealing?.value||currentColorMode())==='dark'?'light':'dark';
  const doc=globalThis.document,root=doc?.documentElement;
  const apply=()=>applyColorMode(value,{persist:true});
  // A second activation interrupts the decoration, not the user's request.
  if(revealing){revealing.finish(true);return apply();}
  if(!doc?.startViewTransition||!root?.style||doc.hidden||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return apply();
  const rect=(trigger||doc.querySelector?.('[data-action="toggle-color-mode"]'))?.getBoundingClientRect?.();
  const width=globalThis.innerWidth||root.clientWidth,height=globalThis.innerHeight||root.clientHeight;
  const x=rect?rect.left+rect.width/2:width/2,y=rect?rect.top+rect.height/2:height/2;
  const radius=Math.hypot(Math.max(x,width-x),Math.max(y,height-y));
  const feather=Math.min(260,Math.max(120,Math.max(width,height)*0.18));
  root.style.setProperty('--theme-reveal-x',x+'px');root.style.setProperty('--theme-reveal-y',y+'px');
  root.style.setProperty('--theme-reveal-radius',Math.ceil(radius)+1+'px');
  root.style.setProperty('--theme-reveal-feather',feather+'px');
  root.style.setProperty('--theme-reveal-end',Math.ceil(radius+feather)+1+'px');
  root.classList.add('color-mode-revealing');
  root.dataset.themeReveal=value==='light'?'expand':'contract';
  let transition,timer,settled=false,applied=false;
  const update=()=>{
    if(settled||applied)return;
    applied=true;apply();
  };
  const finish=(skip=false)=>{
    if(settled)return;
    update();settled=true;clearTimeout(timer);
    if(skip)try{transition?.skipTransition();}catch{}
    if(revealing===reveal){
      revealing=null;root.classList.remove('color-mode-revealing');delete root.dataset.themeReveal;
    }
  };
  const reveal={value,finish};revealing=reveal;
  timer=setTimeout(()=>finish(true),REVEAL_DEADLINE);
  try{
    transition=doc.startViewTransition(update);
    transition.ready.catch(()=>finish(true));
    transition.finished.then(()=>finish(),()=>finish(true));
  }catch{finish(true);}
  return value;
}
