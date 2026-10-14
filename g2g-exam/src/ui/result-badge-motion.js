// Only the central symbol moves; frame and readable assessment stay still.
export function animateResultBadge(node){
  if(typeof node?.animate!=='function'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const animations=[];
  const play=(element,frames,options)=>{
    if(element?.animate)animations.push(element.animate(frames,options));
  };
  const state=node.dataset.resultState;
  if(state==='waiting'){
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'rotate(0deg)'},{transform:'rotate(180deg)'}
    ],{duration:1200,easing:'ease-in-out',fill:'forwards'});
  }else if(state==='passed'){
    play(node.querySelector('[data-medal-effect="check-line"]'),[
      {strokeDashoffset:'1'},{strokeDashoffset:'0'}
    ],{duration:900,easing:'ease-in-out'});
  }else if(state==='failed'){
    play(node.querySelector('[data-medal-effect="cross-line"]'),[
      {strokeDashoffset:'1'},{strokeDashoffset:'0'}
    ],{duration:900,easing:'ease-in-out'});
  }else{
    const angle=state==='good'?18:24;
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'none'},
      {transform:`rotate(${angle}deg) scale(1.08)`,offset:.45},
      {transform:'none'}
    ],{duration:1100,easing:'ease-in-out'});
  }
  const stop=()=>animations.forEach(animation=>animation.cancel());
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener?.('visibilitychange',hidden);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    document.removeEventListener?.('visibilitychange',hidden);
  });
  return stop;
}
