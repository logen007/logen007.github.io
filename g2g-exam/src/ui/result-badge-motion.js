// Three intact clusters settle in order. Keep the label attached to the plate.
export function animateResultBadge(node){
  if(typeof node?.animate!=='function'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const animations=[],ease='cubic-bezier(.22,1,.36,1)';
  const play=(element,frames,options)=>{
    if(element?.animate)animations.push(element.animate(frames,options));
  };
  const clusters=[['shell',0,5],['symbol',170,-5],['plate',340,5]];
  clusters.forEach(([key,delay,y])=>{
    play(node.querySelector(`[data-medal-cluster="${key}"]`),[
      {opacity:0,transform:`translateY(${y}px)`},
      {opacity:1,transform:'none'}
    ],{duration:620,delay,easing:ease,fill:'backwards'});
  });
  play(node.querySelector('.result-medal-label'),[
    {opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}
  ],{duration:620,delay:340,easing:ease,fill:'backwards'});
  const stop=()=>animations.forEach(animation=>animation.cancel());
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener?.('visibilitychange',hidden);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    document.removeEventListener?.('visibilitychange',hidden);
  });
  return stop;
}
