// Only the central symbol moves; frame and readable assessment stay still.
import {animateDiamond} from './diamond-mesh.js';
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
      {transform:'rotate(0deg)'},
      {transform:'rotate(720deg)',offset:.6,easing:'cubic-bezier(.3,.4,.6,1)'},
      {transform:'rotate(1080deg)'}
    ],{duration:2400,easing:'linear',fill:'forwards'});
  }else if(state==='good'){
    const rotation=animateDiamond(node.querySelector('.result-medal-diamond'));
    if(rotation)animations.push(rotation);
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
