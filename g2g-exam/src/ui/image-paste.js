const selector='input[type="file"]';
const wrappers='.section-image-upload,.choice-image-upload,.rubric-image-upload,.writing-image-picker,.reading-block-image';
const hint='Dán ảnh: trỏ chuột vào đây hoặc dùng Tab để chọn, rồi nhấn ⌘V / Ctrl+V.';

export function acceptsImage(input,file){
  const accept=String(input.accept||'').toLowerCase().split(',').map(value=>value.trim());
  return file.type.startsWith('image/')&&accept.some(value=>value==='image/*'||value===file.type.toLowerCase()||value.startsWith('.')&&file.name.toLowerCase().endsWith(value));
}

// Native paste only: never read clipboard without the user's paste action.
// Dispatch the ordinary file change so compression, validation and saving stay shared.
export function bindImagePaste(root=document,{notify=()=>{},confirmReplace=apply=>apply()}={}){
  let hovered=null,pending=false;
  const controls=new WeakMap();
  const usable=input=>input?.isConnected&&!input.disabled&&!input.matches(':disabled');
  function prepare(node){
    const inputs=[...(node.matches?.(selector)?[node]:[]),...(node.querySelectorAll?.(selector)||[])];
    for(const input of inputs){
      if(controls.has(input)||!/(image\/|\.(png|jpe?g|webp|gif|svg|ico)\b)/i.test(input.accept))continue;
      const control=input.closest(wrappers)||input;
      controls.set(input,control);
      control.dataset.imagePasteTarget='';
      control.title=[control.title,hint].filter(Boolean).join(' — ');
      if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',control.textContent.trim()||'Tải hoặc dán hình ảnh');
    }
  }
  function resolve(target){
    const control=target?.closest?.('[data-image-paste-target]');
    const input=control?.matches(selector)?control:control?.querySelector(selector);
    return controls.has(input)&&usable(input)?input:null;
  }
  function select(input){
    if(hovered)controls.get(hovered)?.classList.remove('image-paste-active');
    hovered=input;
    if(input)controls.get(input)?.classList.add('image-paste-active');
  }
  const over=event=>select(resolve(event.target));
  const out=event=>{if(!controls.get(hovered)?.contains(event.relatedTarget))select(null);};
  const paste=event=>{
    if(event.defaultPrevented||pending)return;
    if(event.target?.closest?.('textarea,input:not([type="file"]),[contenteditable]:not([contenteditable="false"])'))return;
    const input=resolve(event.target)||hovered;
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
      pending=true;
      Promise.resolve(confirmReplace(apply)).finally(()=>{pending=false;});
    }else apply();
  };
  prepare(root);
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)prepare(node);});
  observer.observe(root,{subtree:true,childList:true});
  root.addEventListener('pointerover',over);
  root.addEventListener('pointerout',out);
  root.addEventListener('paste',paste);
  return ()=>{observer.disconnect();select(null);root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('paste',paste);};
}
