// CSS owns the finite choreography. Replay only touches the decorative scene,
// never authentication controls, page layout, or the user's motion preference.
export function bindLoginMotion(root,{reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
  const scene=root.querySelector('[data-login-scene]'),button=root.querySelector('[data-login-replay]');
  if(!scene||!button)return;
  button.hidden=typeof scene.getAnimations!=='function';
  button.onclick=()=>{
    if(reducedMotion()||button.hidden)return;
    for(const animation of scene.getAnimations({subtree:true})){
      animation.currentTime=0;
      animation.play();
    }
  };
}
