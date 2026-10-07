import {hasApiBackend} from '../config.js';
import {loadPublicSettings} from './api.js';

export const DEFAULT_PRIMARY_COLOR='#111827';
const CACHE_KEY='g2g.theme.public.v1';
const DEMO_KEY='g2g.theme.demo.v1';
let publicSettings={};
let currentColor=DEFAULT_PRIMARY_COLOR;
let initialization;
const localThemeEnabled=()=>Boolean(globalThis.G2G_DEMO_BYPASS)||!hasApiBackend();

export function normalizeThemeColor(value){
  const color=String(value??'').trim();
  return /^#[0-9a-f]{6}$/i.test(color)?color.toUpperCase():null;
}

function rgb(color){return color.slice(1).match(/../g).map(channel=>parseInt(channel,16));}
function mix(color,target,amount){
  const a=rgb(color),b=rgb(target);
  return '#'+a.map((channel,index)=>Math.round(channel*(1-amount)+b[index]*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function luminance(color){
  const channels=rgb(color).map(channel=>{
    const value=channel/255;
    return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;
  });
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
export function colorContrast(a,b){
  const values=[luminance(a),luminance(b)].sort((left,right)=>right-left);
  return (values[0]+0.05)/(values[1]+0.05);
}

// One palette owns filled controls, light selections and readable text for any saved color.
export function themePalette(value){
  const primary=normalizeThemeColor(value)||DEFAULT_PRIMARY_COLOR;
  const onPrimary=colorContrast(primary,'#FFFFFF')>=colorContrast(primary,'#000000')?'#FFFFFF':'#000000';
  const soft=mix(primary,'#FFFFFF',0.93);
  let text=primary;
  for(let amount=0.05;colorContrast(text,soft)<4.5&&amount<=1;amount+=0.05)text=mix(primary,'#000000',amount);
  return {
    '--brand-primary':primary,
    '--brand-on-primary':onPrimary,
    '--brand-text':text,
    '--brand-soft':soft,
    '--brand-border':mix(primary,'#FFFFFF',0.76),
    '--brand-hover':mix(primary,onPrimary==='#FFFFFF'?'#000000':'#FFFFFF',0.08),
    '--brand-ring':text,
  };
}

function readColor(key){
  try{return normalizeThemeColor(globalThis.localStorage?.getItem(key));}catch{return null;}
}
function storeColor(key,color){
  try{globalThis.localStorage?.setItem(key,color);}catch{}
}
export function applyTheme(value,target=globalThis.document?.documentElement){
  const palette=themePalette(value);
  if(target?.style)for(const [name,color] of Object.entries(palette))target.style.setProperty(name,color);
  return palette;
}
function applyCurrentTheme(color){
  currentColor=normalizeThemeColor(color)||DEFAULT_PRIMARY_COLOR;
  applyTheme(currentColor);
  globalThis.document?.querySelector('meta[name="theme-color"]')?.setAttribute('content',currentColor);
}
export function currentTheme(){return {primaryColor:currentColor};}
export function saveLocalTheme(value){
  const color=normalizeThemeColor(value);
  if(!color)throw new Error('Nhập mã màu gồm # và 6 ký tự, ví dụ #111827.');
  try{
    if(!globalThis.localStorage)throw new Error('Storage unavailable');
    globalThis.localStorage.setItem(DEMO_KEY,color);
  }catch{throw new Error('Trình duyệt chưa cho phép lưu giao diện. Hãy bật bộ nhớ trang web rồi thử lại.');}
  applyCurrentTheme(color);
}
export function acceptPublicSettings(settings){
  publicSettings=settings||{};
  const color=normalizeThemeColor(publicSettings.theme?.primaryColor)||DEFAULT_PRIMARY_COLOR;
  storeColor(CACHE_KEY,color);
  applyCurrentTheme(localThemeEnabled()?readColor(DEMO_KEY)||color:color);
  return publicSettings;
}

// Starts before role-specific features, including local/demo and student routes.
export function initializeTheme(){
  if(initialization)return initialization;
  const cached=readColor(CACHE_KEY)||DEFAULT_PRIMARY_COLOR;
  applyCurrentTheme(localThemeEnabled()?readColor(DEMO_KEY)||cached:cached);
  initialization=hasApiBackend()
    ? loadPublicSettings().then(acceptPublicSettings).catch(()=>publicSettings)
    : Promise.resolve(publicSettings);
  return initialization;
}
