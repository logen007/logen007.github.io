// Animate native disclosures without wrapping/rebuilding their content.
export function bindDisclosureMotion(root=globalThis.document){
  const running=new WeakMap();
  root.addEventListener('click',event=>{
    const summary=event.target.closest?.('summary');
    const details=summary?.parentElement;
    if(details?.tagName!=='DETAILS'||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(event.target.closest('a,button,input,select,textarea,[contenteditable]'))return;
    if(!details.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    event.preventDefault();
    const previous=running.get(details),open=!(previous?.open??details.open);
    const from=details.getBoundingClientRect().height;
    previous?.animation.cancel();
    // Measure both natural states in the same frame; keep content visible until closing ends.
    details.open=open;
    const to=details.getBoundingClientRect().height;
    details.open=true;
    const overflow=previous?.overflow??details.style.overflow;
    details.style.overflow='hidden';
    const animation=details.animate([{height:from+'px'},{height:to+'px'}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
    const state={animation,open,overflow};
    running.set(details,state);
    const finish=()=>{
      if(running.get(details)!==state)return;
      details.open=open;
      details.style.overflow=overflow;
      running.delete(details);
    };
    animation.onfinish=finish;
    animation.oncancel=finish;
  });
}
