// Only the central symbol moves; frame and readable assessment stay still.
export function animateResultBadge(node){
  if(typeof node?.animate!=='function'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const animations=[],ease='cubic-bezier(.22,1,.36,1)';
  const play=(element,frames,options)=>{
    if(element?.animate)animations.push(element.animate(frames,options));
  };
  const state=node.dataset.resultState;
  if(state==='waiting'){
    play(node.querySelector('[data-medal-effect="sand"]'),[
      {opacity:0,strokeDashoffset:'0'},
      {opacity:.5,offset:.25},
      {opacity:.5,offset:.7},
      {opacity:0,strokeDashoffset:'-21'}
    ],{duration:900,easing:'linear'});
  }else if(state==='passed'){
    play(node.querySelector('[data-medal-effect="check-line"]'),[
      {strokeDashoffset:'1'},{strokeDashoffset:'0'}
    ],{duration:650,easing:ease});
  }else if(state==='failed'){
    play(node.querySelector('.result-medal-symbol'),[
      {opacity:.75,transform:'scale(.96)'},{opacity:1,transform:'none'}
    ],{duration:500,easing:ease});
  }else{
    const face=node.querySelector('[data-medal-effect="gleam"]');
    const opacity=Number(face?.getAttribute('opacity')??.35);
    play(face,[{opacity},{opacity:Math.min(.85,opacity+.25)},{opacity}],{duration:900,easing:'ease-in-out'});
  }
  const stop=()=>animations.forEach(animation=>animation.cancel());
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener?.('visibilitychange',hidden);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    document.removeEventListener?.('visibilitychange',hidden);
  });
  return stop;
}
