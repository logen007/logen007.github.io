let busy=false;
export async function withExamTransition(start){
  if(busy)return;
  busy=true;
  const previous=document.activeElement,app=document.getElementById('app');
  const wasInert=app?.inert;
  const overlay=document.createElement('div');
  overlay.className='exam-transition';overlay.tabIndex=-1;
  overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="exam-transition-light" aria-hidden="true"></div><div class="exam-transition-center"><img class="exam-transition-logo" alt="G2G Career" width="48" height="48"><p>Hãy sẵn sàng</p></div>';
  const logo=overlay.querySelector('img');
  logo.src=document.querySelector?.('.thuong-hieu .logo img')?.src||'/brand/logo';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try{
    if(app)app.inert=true;
    document.body.append(overlay);overlay.focus();
    // Start the request immediately, while the overlay covers the page render.
    // Capture rejection now so a fast network error never becomes unhandled.
    const loading=Promise.resolve().then(start).then(()=>({ok:true}),error=>({ok:false,error}));
    await wait(reduced?100:1100);
    overlay.querySelector('p').textContent='Chúc may mắn';
    overlay.classList.add('is-ready');
    const [result]=await Promise.all([loading,wait(reduced?100:900)]);
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
