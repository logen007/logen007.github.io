const API=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
const TYPE='A1_LISTENING_PART_1';

async function loadState(){
  const res=await fetch(`${API}/state`,{credentials:'include'});
  if(!res.ok)throw new Error('Không tải được ngân hàng câu hỏi.');
  return res.json();
}

async function enhancePicker(){
  const list=document.getElementById('pickerList');
  if(!list||list.dataset.groupEnhanced==='1')return;
  list.dataset.groupEnhanced='1';
  let state;try{state=await loadState();}catch{return;}
  const groups=(state.questionGroups||[]).filter(g=>g.status!=='trash'&&g.structureType===TYPE);
  for(const group of groups){
    const inputs=(group.questionIds||[]).map(id=>list.querySelector(`.bank-pick[value="${CSS.escape(id)}"]`)).filter(Boolean);
    if(!inputs.length)continue;
    const firstRow=inputs[0].closest('.dong-chon');if(!firstRow)continue;
    const box=document.createElement('div');
    box.style.cssText='grid-column:1/-1;border:1px solid var(--vien);border-radius:8px;padding:11px 12px;background:var(--tim-nhat);display:flex;align-items:center;gap:10px';
    const check=document.createElement('input');check.type='checkbox';
    const label=document.createElement('div');label.innerHTML=`<b>A1 · Nghe · Phần 1 — chọn cả cụm</b><div class="phu-de">${inputs.length} câu · thêm/xóa khỏi đề cùng nhau</div>`;
    const sync=()=>{check.checked=inputs.every(x=>x.checked);check.indeterminate=inputs.some(x=>x.checked)&&!check.checked;};
    check.onchange=()=>{inputs.forEach(x=>{x.checked=check.checked;x.dispatchEvent(new Event('change',{bubbles:true}));});sync();};
    inputs.forEach(x=>x.addEventListener('change',sync));
    box.append(check,label);firstRow.insertAdjacentElement('beforebegin',box);sync();
    for(const input of inputs){const row=input.closest('.dong-chon');if(row)row.style.marginLeft='18px';}
  }
}

let queued=false;
function schedule(){if(queued)return;queued=true;queueMicrotask(async()=>{queued=false;await enhancePicker();});}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
schedule();
