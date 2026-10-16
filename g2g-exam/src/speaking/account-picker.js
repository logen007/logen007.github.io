import {speakingApi} from './api.js';

// One dialog shares short-lived search results; no account data is persisted.
export function bindAccountPickers(dialog){
 const cache=new Map(),pending=new Map();
 for(const seat of ['A','B']){
  const input=dialog.querySelector('[name=email'+seat+']'),list=dialog.querySelector('#speaking-accounts-'+seat),status=dialog.querySelector('[data-account-status]');
  let timer,sequence=0,active=-1;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const select=node=>{input.value=node.dataset.email;sequence++;clearTimeout(timer);close();input.focus();input.dispatchEvent(new input.ownerDocument.defaultView.Event('change',{bubbles:true}));};
  const highlight=index=>{const options=[...list.children];active=index;options.forEach((node,i)=>node.setAttribute('aria-selected',String(i===index)));input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView?.({block:'nearest'});};
  list.onpointerdown=e=>e.preventDefault();
  list.onclick=e=>{const node=e.target.closest('[role=option]');if(node)select(node);};
  input.onblur=()=>{sequence++;clearTimeout(timer);close();};
  input.onkeydown=e=>{
   if(e.key==='Escape'&&!list.hidden){e.preventDefault();e.stopPropagation();sequence++;clearTimeout(timer);close();}
   else if(['ArrowDown','ArrowUp'].includes(e.key)&&list.children.length){e.preventDefault();list.hidden=false;input.setAttribute('aria-expanded','true');highlight((active+(e.key==='ArrowDown'?1:active<0?0:-1)+list.children.length)%list.children.length);}
   else if(e.key==='Enter'&&!list.hidden&&active>=0){e.preventDefault();select(list.children[active]);}
   else if(e.key==='Tab')close();
  };
  input.oninput=()=>{
   clearTimeout(timer);const key=input.value.trim(),version=++sequence;close();list.replaceChildren();status.textContent='';if(key.length<2)return;
   timer=setTimeout(async()=>{try{
    let rows=cache.get(key);
    if(!rows){if(!pending.has(key))pending.set(key,speakingApi('accounts?q='+encodeURIComponent(key)).then(r=>{cache.set(key,r.accounts);return r.accounts;}).finally(()=>pending.delete(key)));rows=await pending.get(key);}
    if(!dialog.isConnected||version!==sequence)return;
    const other=dialog.querySelector('[name=email'+(seat==='A'?'B':'A')+']').value.trim().toLowerCase();
    for(const row of rows.filter(r=>r.email.toLowerCase()!==other)){
     const node=document.createElement('div');node.id=list.id+'-'+list.children.length;node.setAttribute('role','option');node.setAttribute('aria-selected','false');node.dataset.email=row.email;
     const name=document.createElement('strong'),email=document.createElement('small');name.textContent=row.name||row.email;email.textContent=row.email;node.append(name,email);list.append(node);
    }
    list.hidden=!list.children.length;input.setAttribute('aria-expanded',String(!list.hidden));status.textContent=list.children.length?'':'Không tìm thấy tài khoản phù hợp.';
   }catch{if(dialog.isConnected&&version===sequence)status.textContent='Chưa tải được gợi ý. Anh có thể nhập email đầy đủ.';}},300);
  };
  dialog.addEventListener('close',()=>{clearTimeout(timer);sequence++;},{once:true});
 }
}
