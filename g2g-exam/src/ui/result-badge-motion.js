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
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'scale(1)'},
      {transform:'scale(.86)',offset:.28},
      {transform:'scale(1.06)',offset:.65},
      {transform:'none'}
    ],{duration:850,easing:'ease-in-out'});
  }else if(state==='fair'){
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'rotate(0deg)'},{transform:'rotate(90deg)'}
    ],{duration:1050,easing:'ease-in-out',fill:'forwards'});
  }else if(state==='good'){
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'scaleX(1)'},
      {transform:'scaleX(.08) scaleY(1.05)',offset:.5},
      {transform:'none'}
    ],{duration:1000,easing:'ease-in-out'});
    const face=node.querySelector('[data-medal-effect="gleam"]');
    const opacity=Number(face?.getAttribute('opacity')??.58);
    play(face,[{opacity},{opacity:.9},{opacity}],{duration:450,delay:650,easing:'ease-in-out'});
  }else if(state==='excellent'){
    play(node.querySelector('.result-medal-symbol'),[
      {transform:'scale(.82)'},
      {transform:'scale(1.12)',offset:.45},
      {transform:'none'}
    ],{duration:950,easing:'cubic-bezier(.22,1,.36,1)'});
    play(node.querySelector('.result-medal-aura'),[
      {opacity:0,transform:'scale(.72)'},
      {opacity:.85,offset:.2},
      {opacity:0,transform:'scale(1.45)'}
    ],{duration:900,delay:250,easing:'ease-out'});
  }
  const stop=()=>animations.forEach(animation=>animation.cancel());
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener?.('visibilitychange',hidden);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    document.removeEventListener?.('visibilitychange',hidden);
  });
  return stop;
}
