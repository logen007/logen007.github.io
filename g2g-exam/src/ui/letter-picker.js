import {esc} from './format.js';

export function selectedLetterLabel(option,fullSelection=false){
  const text=option?.textContent||'—',short=option?.dataset?.shortText;
  return fullSelection?text:short||option?.dataset?.letter||text;
}

export function letterPickerOptions(select){
  return [...select.options].map(option=>`<button type="button" class="letter-picker-option" data-value="${esc(option.value)}" aria-pressed="${option.selected}" ${option.disabled?'disabled':''}>${esc(option.value===''?'Auswahl löschen':option.textContent)}</button>`).join('');
}

export function syncLetterPicker(select){
  const trigger=select.parentElement?.querySelector('[data-letter-picker]');
  if(!trigger)return;
  const selected=select.selectedOptions[0];
  trigger.textContent=selectedLetterLabel(selected,select.dataset?.fullSelection==='true');
  trigger.dataset.answered=String(select.value!=='');
  trigger.setAttribute('aria-label',`${select.getAttribute('aria-label')}: ${selected?.textContent||'—'}`);
}

export function bindLetterPicker(select){
  if(!select.hasAttribute?.('data-full-options')||select.parentElement.querySelector('[data-letter-picker]'))return;
  const doc=select.ownerDocument,trigger=doc.createElement('button');
  trigger.type='button';trigger.className='inline-gap-trigger';trigger.dataset.letterPicker='';
  trigger.setAttribute('aria-haspopup','dialog');
  select.hidden=true;
  select.parentElement.querySelector('.inline-gap-value')?.remove();
  select.after(trigger);
  trigger.onclick=()=>{
    const dialog=doc.createElement('dialog');dialog.className='letter-picker-dialog';
    dialog.setAttribute('aria-label',select.getAttribute('aria-label'));
    dialog.innerHTML=`<header><strong>${esc(select.getAttribute('aria-label'))}</strong><button type="button" class="icon-btn" data-close aria-label="Schließen">×</button></header><div class="letter-picker-options">${letterPickerOptions(select)}</div>`;
    // Keep the dialog owned by the current section; route changes remove it too.
    select.parentElement.appendChild(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});});
    dialog.addEventListener('click',event=>{
      const option=event.target.closest('[data-value]');
      if(option&&!option.disabled){select.value=option.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();}
      else if(event.target===dialog||event.target.closest('[data-close]'))dialog.close();
    });
    dialog.showModal();
    (dialog.querySelector('[aria-pressed="true"]:not(:disabled)')||dialog.querySelector('[data-close]')).focus({preventScroll:true});
  };
  syncLetterPicker(select);
}
