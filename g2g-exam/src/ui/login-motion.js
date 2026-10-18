// CSS owns the independent loops and reduced-motion fallback. One persistent
// control pauses the complete decorative scene without a timer or auth changes.
export function bindLoginMotion(root,{reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
  const scene=root.querySelector('[data-login-scene]'),button=root.querySelector('[data-login-motion-toggle]');
  if(!scene||!button)return;
  button.hidden=false;
  button.onclick=()=>{
    if(reducedMotion()||button.hidden)return;
    const paused=scene.dataset.paused!=='true';
    scene.dataset.paused=button.dataset.paused=String(paused);
    const label=paused?'Tiếp tục chuyển động':'Tạm dừng chuyển động';
    button.setAttribute('aria-label',label);
    button.querySelector('[data-login-motion-label]').textContent=label;
  };
}
