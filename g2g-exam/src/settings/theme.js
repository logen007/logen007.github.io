import {hasApiBackend} from '../config.js';
import {loadPublicSettings} from './api.js';
import {normalizeLayout,layoutVariables,validateLayout} from './layout.js';
import {DEFAULT_PRIMARY_COLOR,normalizeThemeColor,themePalette,darkThemePalette,normalizeButtonTheme,validateButtonTheme} from './palette.js';
import {initializeColorMode} from './color-mode.js';
export {DEFAULT_PRIMARY_COLOR,normalizeThemeColor,themePalette,colorContrast} from './palette.js';
let currentLayout=normalizeLayout();
let currentButtons=normalizeButtonTheme();
let currentAsciiReveal=true;
const appearance=value=>({...normalizeLayout(value),...normalizeButtonTheme(value),asciiRevealEnabled:value?.asciiRevealEnabled!==false});
function readLayout(key){try{return JSON.parse(globalThis.localStorage?.getItem(key+'.layout')||'null');}catch{return null;}}
function storeLayout(key,value){try{globalThis.localStorage?.setItem(key+'.layout',JSON.stringify(value));}catch{}}
export function applyLayout(value,target=globalThis.document?.documentElement){
  if(target?.style)for(const [key,item] of Object.entries(layoutVariables(value)))target.style.setProperty(key,item);
}

const CACHE_KEY='g2g.theme.public.v1';
const DEMO_KEY='g2g.theme.demo.v1';
let publicSettings={};
export function currentPublicSettings(){return publicSettings;}
let currentColor=DEFAULT_PRIMARY_COLOR;
let initialization;
const localThemeEnabled=()=>Boolean(globalThis.G2G_DEMO_BYPASS)||!hasApiBackend();

function readColor(key){
  try{return normalizeThemeColor(globalThis.localStorage?.getItem(key));}catch{return null;}
}
function storeColor(key,color){
  try{globalThis.localStorage?.setItem(key,color);}catch{}
}
export function applyTheme(value,target=globalThis.document?.documentElement,options={}){
  const palette=themePalette(value,options);
  if(target?.style)for(const [name,color] of Object.entries({...palette,...darkThemePalette(value)}))target.style.setProperty(name,color);
  return palette;
}
function applyCurrentTheme(color,layout={}){
  currentAsciiReveal=layout?.asciiRevealEnabled!==false;
  const root=globalThis.document?.documentElement;
  if(root?.dataset){
    // Global state must not match the per-content [data-ascii-reveal] selector.
    const value=currentAsciiReveal?'on':'off',changed=root.dataset.asciiEnabled!==value;
    root.dataset.asciiEnabled=value;
    const win=root.ownerDocument?.defaultView;
    if(changed&&win)win.dispatchEvent(new win.Event('g2g-ascii-preference'));
  }
  currentLayout=normalizeLayout(layout);
  currentButtons=normalizeButtonTheme(layout);
  applyLayout(currentLayout);
  currentColor=normalizeThemeColor(color)||DEFAULT_PRIMARY_COLOR;
  applyTheme(currentColor,globalThis.document?.documentElement,currentButtons);
  globalThis.document?.querySelector('meta[name="theme-color"]')?.setAttribute('content',currentColor);
}
export function currentTheme(){return {primaryColor:currentColor,...currentLayout,...currentButtons,asciiRevealEnabled:currentAsciiReveal};}
export function saveLocalTheme(value,layout={}){
  const color=normalizeThemeColor(value);
  if(!color)throw new Error('Nhập mã màu gồm # và 6 ký tự, ví dụ #111827.');
  validateLayout(layout);validateButtonTheme(layout);
  try{
    if(!globalThis.localStorage)throw new Error('Storage unavailable');
    globalThis.localStorage.setItem(DEMO_KEY,color);
    globalThis.localStorage.setItem(DEMO_KEY+'.layout',JSON.stringify(appearance(layout)));
  }catch{throw new Error('Trình duyệt chưa cho phép lưu giao diện. Hãy bật bộ nhớ trang web rồi thử lại.');}
  applyCurrentTheme(color,layout);
}
export function acceptPublicSettings(settings){
  publicSettings=settings||{};
  const color=normalizeThemeColor(publicSettings.theme?.primaryColor)||DEFAULT_PRIMARY_COLOR;
  storeColor(CACHE_KEY,color);
  storeLayout(CACHE_KEY,appearance(publicSettings.theme));
  applyCurrentTheme(localThemeEnabled()?readColor(DEMO_KEY)||color:color,localThemeEnabled()?readLayout(DEMO_KEY)||publicSettings.theme:publicSettings.theme);
  return publicSettings;
}

// Starts before role-specific features, including local/demo and student routes.
export function initializeTheme(){
  if(initialization)return initialization;
  initializeColorMode();
  const cached=readColor(CACHE_KEY)||DEFAULT_PRIMARY_COLOR;
  applyCurrentTheme(localThemeEnabled()?readColor(DEMO_KEY)||cached:cached,localThemeEnabled()?readLayout(DEMO_KEY)||readLayout(CACHE_KEY)||{}:readLayout(CACHE_KEY)||{});
  initialization=hasApiBackend()
    ? loadPublicSettings().then(acceptPublicSettings).catch(()=>publicSettings)
    : Promise.resolve(publicSettings);
  return initialization;
}
