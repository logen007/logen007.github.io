import {createRepository} from '../repository.js';
import {restoreQuestionGroup,permanentlyDeleteQuestionGroup} from '../core.js';
import {esc} from '../ui/format.js';

const repo=await createRepository();
let user=await repo.getCurrentUser();
let mounting=false;

async function mount(){
  if(mounting||!user||user.role!=='master')return;
  const main=document.querySelector('.noi-dung-quan-tri');
  const heading=main?.querySelector('.tieu-de-trang h1')?.textContent?.trim();
  if(!main||heading!=='Thùng rác'||main.querySelector('#questionGroupTrash'))return;
  mounting=true;
  try{
    const state=await repo.getState();
    const groups=(state.questionGroups||[]).filter(group=>group.status==='trash');
    const section=document.createElement('section');section.id='questionGroupTrash';section.style.marginTop='20px';
    section.innerHTML=`<h3>Cụm câu hỏi</h3><div class="table-wrap"><table class="bang"><tbody>${groups.map(group=>`<tr><td><b>${esc(group.title||group.id)}</b><span class="phu">${esc(group.level||'')} · ${esc(group.skill||'')} · ${(group.questionIds||[]).length} câu</span></td><td>${esc(group.ownerName||'')}</td><td><div class="hanh-dong-bang"><button class="nut nho" data-qg-restore="${group.id}">Khôi phục</button><button class="nut nho nguy" data-qg-permanent="${group.id}">Xóa vĩnh viễn</button></div></td></tr>`).join('')||'<tr><td class="rong">Trống</td></tr>'}</tbody></table></div>`;
    main.append(section);
    section.querySelectorAll('[data-qg-restore]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;await repo.transaction(state=>restoreQuestionGroup(state,user,button.dataset.qgRestore));location.reload();
    });
    section.querySelectorAll('[data-qg-permanent]').forEach(button=>button.onclick=async()=>{
      if(!confirm('Xóa vĩnh viễn cụm câu hỏi và các câu thuộc cụm? Hành động không thể hoàn tác.'))return;
      button.disabled=true;
      try{await repo.transaction(state=>permanentlyDeleteQuestionGroup(state,user,button.dataset.qgPermanent));location.reload();}
      catch(error){alert(error?.message||'Không thể xóa cụm câu hỏi.');button.disabled=false;}
    });
  }finally{mounting=false;}
}

let frame=0;
const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;mount().catch(console.error);});};
new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
schedule();
