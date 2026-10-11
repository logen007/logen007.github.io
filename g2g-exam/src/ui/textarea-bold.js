// Keep native textareas and their existing autosave/input handlers intact.
export function applyBoldSelection(field){
  return applyTextStyle(field,'b');
}

export function applyTextStyle(field,tag,{allowEmpty=false}={}){
  if(!['b','i','u'].includes(tag))return;
  if(field.disabled||field.readOnly)return;
  const start=field.selectionStart,end=field.selectionEnd;
  const selected=field.value.slice(start,end);
  if(start===end&&!allowEmpty)return;
  const wrapped=new RegExp(`^\\[${tag}\\]([\\s\\S]*)\\[\\/${tag}\\]$`,'i').exec(selected);
  const replacement=wrapped?wrapped[1]:`[${tag}]${selected}[/${tag}]`;
  field.setRangeText(replacement,start,end,'select');
  if(start===end)field.setSelectionRange(start+3,start+3);
  field.focus({preventScroll:true});
  field.dispatchEvent(new Event('input',{bubbles:true}));
}

export function handleTextareaShortcut(event){
  const field=event.target,tag=event.key?.toLowerCase();
  if(!(event.metaKey||event.ctrlKey)||event.altKey||event.shiftKey||event.isComposing||!['b','i','u'].includes(tag))return;
  if(!field?.matches?.('textarea:not(#sHtml):not(#sText)')||field.disabled||field.readOnly)return;
  event.preventDefault();
  applyTextStyle(field,tag,{allowEmpty:true});
}

export function bindTextareaBold(doc=document){
  doc.addEventListener('keydown',handleTextareaShortcut);
  const button=doc.createElement('button');
  button.type='button';button.className='icon-btn textarea-bold-button';
  button.textContent='B';button.title='In đậm đoạn đã chọn';
  button.setAttribute('aria-label','In đậm đoạn đã chọn');button.hidden=true;
  doc.body.appendChild(button);
  let field=null;
  const position=()=>{
    if(!field?.isConnected||field.disabled||field.readOnly||field.selectionStart===field.selectionEnd){button.hidden=true;return;}
    const rect=field.getBoundingClientRect();
    button.hidden=rect.bottom<0||rect.top>doc.documentElement.clientHeight;
    button.style.top=`${Math.max(4,rect.top-42)}px`;
    button.style.left=`${Math.max(4,Math.min(rect.right-40,doc.documentElement.clientWidth-44))}px`;
  };
  doc.addEventListener('focusin',event=>{
    if(event.target===button)return;
    // Email template source is not rendered by the exam text formatter.
    field=event.target.matches?.('textarea:not(#sHtml):not(#sText)')?event.target:null;
    position();
  });
  doc.addEventListener('selectionchange',position);
  doc.addEventListener('select',position,true);
  doc.addEventListener('input',position);
  doc.addEventListener('scroll',position,true);
  globalThis.addEventListener('resize',position);
  // Preserve the native selection when tapping the toolbar, including iPhone.
  button.addEventListener('pointerdown',event=>event.preventDefault());
  button.addEventListener('click',()=>{if(field?.isConnected)applyBoldSelection(field);position();});
  new MutationObserver(()=>{if(field&&!field.isConnected){field=null;button.hidden=true;}}).observe(doc.body,{childList:true,subtree:true});
}
