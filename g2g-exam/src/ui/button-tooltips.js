// One delegated tooltip also covers buttons added by dialogs or rerenders.
export function bindButtonTooltips(){
  let tip=null,timer=null,active=null;
  const hide=()=>{
    clearTimeout(timer);
    if(active&&tip){
      const ids=(active.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==tip.id);
      if(ids.length)active.setAttribute('aria-describedby',ids.join(' '));else active.removeAttribute('aria-describedby');
    }
    tip?.remove();tip=null;active=null;
  };
  const show=target=>{
    const button=target?.closest?.('button,.icon-btn,.gear,[data-image-paste-target],[data-tooltip]');
    if(!button||button.disabled)return;
    const imageTarget=button.matches('[data-image-paste-target]');
    const iconOnly=button.getAttribute('data-tooltip')||imageTarget||button.matches('.icon-btn,.gear,.navigation-arrow,.section-arrow')||(!button.textContent.trim()&&button.querySelector('svg,img'));
    const label=button.getAttribute('data-tooltip')||(imageTarget?button.getAttribute('title'):button.getAttribute('aria-label')||button.getAttribute('title'));
    const savedLabel=label||button.getAttribute('data-preview-hint');
    if(!iconOnly||!savedLabel)return;
    hide();active=button;
    tip=document.createElement('div');tip.className=imageTarget?'button-tooltip button-tooltip--image':button.matches('.image-width-control')?'button-tooltip button-tooltip--image-width':'button-tooltip';tip.id='button-action-tooltip';tip.setAttribute('role','tooltip');tip.textContent=label;
    if(imageTarget){button.setAttribute('data-preview-hint',savedLabel);button.removeAttribute('title');tip.textContent=savedLabel;}
    const source=imageTarget&&button.closest('.goethe-builder')?button.querySelector('img:not(.ui-icon)'):null;
    if(source?.getAttribute('src')){
      const preview=document.createElement('img');preview.src=source.currentSrc||source.src;preview.alt=source.alt||'Xem trước ảnh';
      tip.classList.add('button-tooltip--preview');tip.textContent='';tip.prepend(preview);
      preview.onload=()=>{if(active===button&&tip)position();};
    }
    document.body.append(tip);
    button.setAttribute('aria-describedby',[button.getAttribute('aria-describedby'),tip.id].filter(Boolean).join(' '));
    const position=()=>{
    const rect=button.getBoundingClientRect(),size=tip.getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(innerWidth-size.width-8,rect.left+rect.width/2-size.width/2))+'px';
    tip.style.top=Math.max(8,Math.min(innerHeight-size.height-8,imageTarget&&!source?rect.bottom+8:rect.top-size.height-6))+'px';
    };
    position();
    if(!source)timer=setTimeout(hide,2000);
  };
  document.addEventListener('pointerover',event=>{if(event.pointerType!=='touch')show(event.target);});
  document.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>show(event.target));
  document.addEventListener('focusout',hide);
  document.addEventListener('click',event=>{
    const button=event.composedPath().find(node=>node.matches?.('button,.icon-btn,.gear,[data-tooltip]'));
    hide();if(button?.isConnected)show(button);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('scroll',hide,true);
  window.addEventListener('resize',hide);
}
