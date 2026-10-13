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
}
