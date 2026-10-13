import {currentPublicSettings} from '../settings/theme.js';
import {pickExamMessages} from './exam-messages.js';
let busy=false;
export async function withExamTransition(start,trigger,{exit=false,message='Đã nộp bài',danger=false}={}){
  if(busy)return;
  busy=true;
  const previous=document.activeElement,app=document.getElementById('app');
  const wasInert=app?.inert;
  const overlay=document.createElement('div');
  overlay.className='exam-transition';overlay.tabIndex=-1;
  if(exit)overlay.classList.add('exam-transition--exit');
  if(danger)overlay.classList.add('exam-transition--danger');
  const rect=trigger?.getBoundingClientRect?.();
  const x=rect?rect.left+rect.width/2:window.innerWidth/2;
  const y=rect?rect.top+rect.height/2:window.innerHeight/2;
  const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y))+32;
  overlay.style.setProperty('--reveal-x',x+'px');
  overlay.style.setProperty('--reveal-y',y+'px');
  overlay.style.setProperty('--reveal-radius',radius+'px');
  // Freeze the logo anchor for this transition; browser chrome and text wrapping
  // must not recenter the group while the destination page renders.
  overlay.style.setProperty('--transition-center-x',window.innerWidth/2+'px');
  overlay.style.setProperty('--transition-center-y',window.innerHeight/2+'px');
  const buttonColor=trigger&&window.getComputedStyle?.(trigger).backgroundColor;
  if(buttonColor&&buttonColor!=='transparent'&&buttonColor!=='rgba(0, 0, 0, 0)')overlay.style.setProperty('--wave-color',buttonColor);
  if(danger)overlay.style.setProperty('--wave-color','var(--do)');
  overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="exam-transition-waves" aria-hidden="true"><i></i></div><div class="exam-transition-center"><img class="exam-transition-logo" alt="G2G Career" width="48" height="48"><p>Hãy sẵn sàng</p></div>';
  const logo=overlay.querySelector('img');
  logo.src=document.querySelector?.('.thuong-hieu .logo img')?.src||'/brand/logo';
  const messages=pickExamMessages(currentPublicSettings().general?.examMessages);
  overlay.querySelector('p').textContent=exit?message:messages[0];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const painted=()=>new Promise(resolve=>{
    if(reduced||!window.requestAnimationFrame)return resolve();
    window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve));
  });
  try{
    if(app)app.inert=true;
    document.body.append(overlay);overlay.focus({preventScroll:true});
    // Fetch immediately; callers await coverage before replacing the visible page.
    const covered=wait(reduced?0:1100).then(async()=>{
      overlay.classList.add('is-covered');
      await painted();
    });
    const loading=Promise.resolve().then(()=>start(covered)).then(()=>({ok:true}),error=>({ok:false,error}));
    await wait(reduced?(exit?0:100):1100);
    if(exit&&danger){
      const result=await loading;
      if(!result.ok)throw result.error;
      await painted();
      overlay.classList.add('is-revealing');
      await wait(reduced?0:400);
      return;
    }
    const [result]=await Promise.all([loading,wait(reduced?(exit?0:100):(exit?400:1400))]);
    if(!result.ok)throw result.error;
    overlay.classList.add('is-leaving');
    await wait(reduced?0:500);
  }finally{
    overlay.remove();if(app)app.inert=wasInert;
    busy=false;
    if(previous?.isConnected)previous.focus();
    else {const heading=app?.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  }
}
