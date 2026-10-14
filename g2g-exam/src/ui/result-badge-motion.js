// One assembly sequence per opened review, without modifying the assessment.
export function animateResultBadge(node){
  if(typeof node?.animate!=='function'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const animations=[],ease='cubic-bezier(.22,1,.36,1)';
  const play=(element,frames,options)=>{
    if(element?.animate)animations.push(element.animate(frames,options));
  };
  play(node,[{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});
  const pieces=[
    ...Array.from(node.querySelectorAll('[data-medal-piece]'),element=>({element,key:element.dataset.medalPiece})),
    ...Array.from(node.querySelectorAll('.result-medal-symbol>*'),(element,index)=>({element,key:'facet',index})),
    ...Array.from(node.querySelectorAll('.result-medal-wings>*,.result-medal-crown>*'),(element,index)=>({element,key:'accent',index}))
  ];
  const offsets={body:[0,8,0],left:[-13,-3,-5],right:[13,-3,5],core:[0,-10,0],plate:[0,13,0]};
  pieces.forEach(({element,key,index=0},order)=>{
    const opacity=Number(element.getAttribute?.('opacity')??1);
    const [x,y,angle]=offsets[key]||[
      [-10,10,-7,7][index%4],
      [-12,-10,10,12][index%4],
      (index%2?1:-1)*5
    ];
    play(element,[
      {opacity:0,transform:`translate(${x}px,${y}px) rotate(${angle}deg) scale(.92)`},
      {opacity,offset:.25,transform:`translate(${x}px,${y}px) rotate(${angle}deg) scale(.97)`},
      {opacity,offset:.85,transform:'translate(0,0) rotate(0deg) scale(1)'},
      {opacity,transform:'none'}
    ],{duration:1100,delay:Math.min(order*22,150),easing:ease,fill:'backwards'});
  });
  play(node.querySelector('.result-medal-label'),[
    {opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}
  ],{duration:450,delay:700,easing:ease,fill:'backwards'});
  play(node.querySelector('.result-medal-glint'),[
    {opacity:0,transform:'translateX(-100px)'},
    {opacity:.65,offset:.45},
    {opacity:0,transform:'translateX(180px)'}
  ],{duration:600,delay:900,easing:'ease-out'});
  const stop=()=>animations.forEach(animation=>animation.cancel());
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener?.('visibilitychange',hidden);
  Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
    document.removeEventListener?.('visibilitychange',hidden);
  });
  return stop;
}
