const selector='input[type="file"]';
const wrappers='.section-image-upload,.choice-image-upload,.rubric-image-upload,.writing-image-picker,.reading-block-image';
const hint='Bấm lần 1 để chọn vùng dán\nBấm lần 2 để chọn ảnh';

export function acceptsImage(input,file){
  const accept=String(input.accept||'').toLowerCase().split(',').map(value=>value.trim());
  return file.type.startsWith('image/')&&accept.some(value=>value==='image/*'||value===file.type.toLowerCase()||value.startsWith('.')&&file.name.toLowerCase().endsWith(value));
}

// Native paste only: never read clipboard without the user's paste action.
// Dispatch the ordinary file change so compression, validation and saving stay shared.
export function bindImagePaste(root=document,{notify=()=>{},confirmReplace=apply=>apply()}={}){
  let selected=null,pending=null,picking=false,pointerSelection=null;
  const doc=root.ownerDocument||root;
  const controls=new WeakMap();
  const usable=input=>input?.isConnected&&!input.disabled&&!input.matches(':disabled');
  function prepare(node){
    const inputs=[...(node.matches?.(selector)?[node]:[]),...(node.querySelectorAll?.(selector)||[])];
    for(const input of inputs){
      if(input.dataset.imagePickerDirect!==undefined)continue;
      if(controls.has(input)||!/(image\/|\.(png|jpe?g|webp|gif|svg|ico)\b)/i.test(input.accept))continue;
      const control=input.closest(wrappers)||input;
      controls.set(input,control);
      control.dataset.imagePasteTarget='';
      control.title=hint;
      if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',control.textContent.trim()||'Tải hoặc dán hình ảnh');
    }
  }
  function resolve(target){
    const control=target?.closest?.('[data-image-paste-target]');
    const input=control?.matches(selector)?control:control?.querySelector(selector);
    return controls.has(input)&&usable(input)?input:null;
  }
  function browse(){
    if(!usable(selected))return;
    picking=true;try{selected.click();}finally{picking=false;}
  }
  function select(input){
    if(!input&&selected&&doc.activeElement===selected)selected.blur();
    if(selected)controls.get(selected)?.classList.remove('image-paste-active');
    selected=input;
    if(input){controls.get(input).classList.add('image-paste-active');controls.get(input).title=hint;}
  }
  // Remember selection before pointer focus, so the first click on a native
  // file input cannot be mistaken for a second click by its focusin event.
  const pointerdown=event=>{const input=resolve(event.target);pointerSelection={input,armed:input!=null&&selected===input};};
  const click=event=>{
    if(picking)return;
    const input=resolve(event.target);
    const armed=pointerSelection?.input===input?pointerSelection.armed:input!=null&&selected===input;
    pointerSelection=null;
    if(!input){select(null);return;}
    // Keep remove/other buttons working, but block label and transparent-input
    // default activation. Clicking the image selects a paste target, not a file.
    if(event.target.closest('button'))return;
    event.preventDefault();event.stopPropagation();select(input);input.focus({preventScroll:true});
    if(armed)browse();
  };
  const focus=event=>select(resolve(event.target));
  const keydown=event=>{
    pointerSelection=null;
    if(event.key==='Escape')select(null);
    else if((event.key==='Enter'||event.key===' ')&&event.target===selected){event.preventDefault();browse();}
  };
  const paste=event=>{
    if(pending&&!usable(pending))pending=null;
    if(event.defaultPrevented||pending)return;
    if(event.target?.closest?.('textarea,input:not([type="file"]),[contenteditable]:not([contenteditable="false"])'))return;
    const input=resolve(event.target)||selected;
    if(!usable(input))return;
    const files=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
    if(!files.length)files.push(...Array.from(event.clipboardData?.files||[]));
    const images=files.filter(file=>file.type.startsWith('image/'));
    if(!images.length)return;
    event.preventDefault();
    if(images.length!==1){notify('Mỗi lần chỉ dán một ảnh vào vị trí đã chọn.');return;}
    const file=images[0];
    if(!acceptsImage(input,file)){notify('Định dạng ảnh không phù hợp với vị trí này.');return;}
    const apply=()=>{
      if(!usable(input))return;
      try{
        const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }catch{notify('Trình duyệt chưa hỗ trợ dán ảnh ở đây. Anh/chị hãy chọn tệp ảnh.');}
    };
    const control=controls.get(input);
    if(control.querySelector('img')||input.files?.length||input.id==='sLogo'||input.id==='sFavicon'){
      pending=input;
      Promise.resolve(confirmReplace(apply)).finally(()=>{if(pending===input)pending=null;});
    }else apply();
  };
  prepare(root);
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)prepare(node);if(selected&&!usable(selected))select(null);});
  observer.observe(root,{subtree:true,childList:true});
  root.addEventListener('pointerdown',pointerdown,true);
  root.addEventListener('click',click,true);
  root.addEventListener('focusin',focus);
  root.addEventListener('keydown',keydown);
  root.addEventListener('paste',paste);
  return ()=>{observer.disconnect();select(null);root.removeEventListener('pointerdown',pointerdown,true);root.removeEventListener('click',click,true);root.removeEventListener('focusin',focus);root.removeEventListener('keydown',keydown);root.removeEventListener('paste',paste);};
}
