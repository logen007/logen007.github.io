import {iconHtml} from '../ui/icons.js';

const KEY='g2g.color-mode.v1';
export function currentColorMode(){return globalThis.document?.documentElement?.dataset?.colorMode==='dark'?'dark':'light';}
export function colorModeButtonHtml(){
  const dark=currentColorMode()==='dark';
  const label=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
  return `<button class="icon-btn color-mode-toggle" data-action="toggle-color-mode" aria-label="${label}" title="${label}" aria-pressed="${dark}">${iconHtml(dark?'sun':'moon')}</button>`;
}
export function applyColorMode(mode,{persist=false}={}){
  const value=mode==='dark'?'dark':'light',root=globalThis.document?.documentElement;
  if(root?.dataset)root.dataset.colorMode=value;
  if(persist)try{globalThis.localStorage?.setItem(KEY,value);}catch{}
  globalThis.document?.querySelectorAll?.('[data-action="toggle-color-mode"]').forEach(button=>{
    const label=value==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
    button.setAttribute('aria-label',label);button.setAttribute('title',label);
    button.setAttribute('aria-pressed',String(value==='dark'));
    button.innerHTML=iconHtml(value==='dark'?'sun':'moon');
  });
  return value;
}
export function initializeColorMode(){
  let saved;try{saved=globalThis.localStorage?.getItem(KEY);}catch{}
  return applyColorMode(saved==='dark'?'dark':'light');
}
export function toggleColorMode(){return applyColorMode(currentColorMode()==='dark'?'light':'dark',{persist:true});}
