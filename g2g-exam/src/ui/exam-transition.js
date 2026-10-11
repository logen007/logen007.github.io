let busy=false;
export async function withExamTransition(start){
  if(busy)return;
  busy=true;
  const previous=document.activeElement,app=document.getElementById('app');
  const wasInert=app?.inert;
  const overlay=document.createElement('div');
  overlay.className='exam-transition';overlay.tabIndex=-1;
  overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.innerHTML='<div class="exam-transition-orbit" aria-hidden="true"></div><p>Hãy sẵn sàng</p>';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try{
    if(app)app.inert=true;
    document.body.append(overlay);overlay.focus();
    await wait(reduced?150:1100);
    overlay.querySelector('p').textContent='Chúc may mắn';
    overlay.classList.add('is-ready');
    await wait(reduced?150:1100);
    overlay.querySelector('p').textContent='Đang mở bài thi…';
    await start();
    overlay.classList.add('is-leaving');
    await wait(reduced?0:250);
  }finally{
    overlay.remove();if(app)app.inert=wasInert;
    busy=false;
    if(previous?.isConnected)previous.focus();
    else {const heading=app?.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  }
}
