import {ATTEMPT_STATUS,getStudentResults,getLatestPublishedAttempt} from '../core.js';
import {normalizeStudentLevel,validateStudentName} from '../domain/student-profile.js';
import {resultClass} from '../domain/gradebook.js';
import {esc} from '../ui/format.js';
import {iconHtml} from '../ui/icons.js';

export function profileStats(data,user){
  const published=getStudentResults(data,user.id).filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const taken=getStudentResults(data,user.id).filter(a=>![ATTEMPT_STATUS.IN_PROGRESS,ATTEMPT_STATUS.ABANDONED].includes(a.status)).length;
  return {taken,published:published.length,passed:published.filter(a=>resultClass(a.result)==='passed').length,latest:getLatestPublishedAttempt(data,user.id),level:normalizeStudentLevel(user.level)||'A1'};
}
export function studentShareText(data,user){
  const stats=profileStats(data,user);
  return `${user.name} · ${stats.level?'Trình độ '+stats.level:'Hành trình học tiếng Đức'}\n${stats.taken} bài đã thi · ${stats.passed} bài đạt\nCùng luyện thi tiếng Đức tại G2G Career!`;
}
export function studentProfileCardHtml(data,user){
  const stats=profileStats(data,user);
  const classCode=data.classes?.find(item=>item.id===user.classId)?.code||'Extend';
  const initials=String(user.name||'HV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('');
  return `<section class="the learner-card" aria-label="Hồ sơ và thành tích học viên">
    <div class="learner-identity"><span class="learner-avatar">${user.picture?`<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><div class="learner-details"><div class="learner-name"><h1 data-student-name>${esc(user.name)}</h1><form class="profile-form learner-name-editor" data-name-form hidden><label class="sr-only" for="studentNameEdit">Họ và tên đầy đủ</label><input id="studentNameEdit" name="name" required maxlength="120" autocomplete="name" value="${esc(user.name)}" aria-describedby="studentNameStatus"></form><button class="icon-btn" data-edit-student-name title="Sửa họ tên" aria-label="Sửa họ tên">${iconHtml('grading')}</button></div><span class="phu-de">${esc(classCode)}</span><p id="studentNameStatus" class="learner-share-status phu-de" data-name-status role="status"></p></div><div class="learner-emblem" aria-label="Trình độ ${esc(stats.level)}">${esc(stats.level)}</div><div class="learner-actions">${classCode==='Extend'?'<button class="nut" data-action="class-enrollment">Nhập mã xác nhận</button>':''}<button class="nut" data-action="share-profile">↗ Chia sẻ</button></div></div>
    <div class="learner-stats"><div><span>Bài đã thi</span><strong>${stats.taken}</strong></div><div><span>Bài đạt</span><strong>${stats.passed}</strong></div><div><span>Điểm gần nhất</span><strong>${esc(stats.latest?.totalScore??'—')}</strong></div><div><span>Kết quả gần nhất</span><strong class="exam-latest-result ${resultClass(stats.latest?.result)}">${esc(stats.latest?.result||'Chưa có')}</strong></div></div>
    <p class="learner-share-status phu-de" data-share-status role="status" aria-live="polite"></p>
  </section>`;
}
export async function shareStudentProfile(data,user){
  const text=studentShareText(data,user),url=location.origin;
  if(navigator.share){await navigator.share({title:'Hành trình tiếng Đức · G2G',text,url});return 'Đã mở chia sẻ.';}
  await navigator.clipboard.writeText(text+'\n'+url);
  return 'Đã sao chép thành tích và liên kết. Bạn có thể dán lên mạng xã hội.';
}

export function bindStudentName(root,{repo,user,onSaved}){
  const button=root.querySelector('[data-edit-student-name]'),form=root.querySelector('[data-name-form]');
  if(!button||!form)return;
  const input=form.elements.name,title=root.querySelector('[data-student-name]'),status=root.querySelector('[data-name-status]');
  let editing=false,saving=false;
  const close=()=>{editing=false;form.hidden=true;title.hidden=false;button.hidden=false;};
  button.onclick=()=>{editing=true;title.hidden=true;form.hidden=false;button.hidden=true;status.textContent='';input.value=user.name;input.focus();input.select();};
  const save=async()=>{
    if(!editing||saving)return;
    let name;
    try{name=validateStudentName(input.value);}catch(error){status.textContent=error.message;return;}
    if(name===user.name){close();return;}
    saving=true;input.disabled=true;status.textContent='Đang lưu…';
    try{
      if(repo.mode==='api'){await repo.call('saveStudentName',{name});await repo.reload();}
      else await repo.transaction(state=>{state.users.find(item=>item.id===user.id).name=name;});
      close();await onSaved();
    }catch(error){status.textContent=error.message;}
    finally{saving=false;input.disabled=false;}
  };
  form.onsubmit=event=>{event.preventDefault();save();};
  input.onblur=()=>save();
  input.onkeydown=event=>{if(event.key==='Escape'&&!saving){event.preventDefault();close();status.textContent='';button.focus();}};
}
