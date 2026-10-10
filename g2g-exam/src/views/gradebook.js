import {esc,fmtDate} from '../ui/format.js';
import {STUDENT_LEVELS} from '../domain/student-profile.js';
import {filteredGradebook,gradeBand,skillScores,examResult,isStandardTelc,telcResult} from '../domain/gradebook.js';
import {mountDialog} from './classes.js';

const number=value=>Number(value.toFixed(2));
function badge(score,max){
  const band=gradeBand(score,max);
  if(!band)return '—';
  return `<span tabindex="0" class="score-badge score-${band.key}" aria-label="${number(score)}/${number(max)}: ${band.label}">${number(score)}/${number(max)}<span role="tooltip" class="score-tooltip">${band.label}</span></span>`;
}
function filter(name,label,items,selected){return `<label>${label}<select data-grade-filter="${name}">${name==='provider'?'':'<option value="">Tất cả</option>'}${items.map(([value,text])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;}
export function gradebookHtml({data,ui}){
  const filters={provider:'GOETHE',...ui.gradeFilters},telc=filters.provider==='TELC';
  const reviewers=data.users.filter(user=>['teacher','master'].includes(user.role));
  const students=data.users.filter(user=>user.role==='student');
  const filtersHtml=filter('provider','Loại đề',[['GOETHE','Goethe'],['TELC','TELC']],filters.provider)+filter('level','Trình độ',STUDENT_LEVELS.map(item=>[item,item]),filters.level)+filter('classId','Mã lớp',(data.classes||[]).map(item=>[item.id,item.code]),filters.classId)+filter('reviewerId','Giáo viên chấm bài',reviewers.map(item=>[item.id,item.name]),filters.reviewerId)+filter('studentId','Học viên',students.map(item=>[item.id,item.name]),filters.studentId)+filter('status','Trạng thái',[['pending','Cần chấm'],['graded','Đã chấm']],filters.status);
  const keys=telc?['reading','grammar','listening','writing']:['reading','listening','writing'];
  const rows=filteredGradebook(data,filters).map(({student,attempt,exam,skills,classCode,status})=>{
    const minutes=Math.max(0,Math.round((attempt.durationSeconds??((Date.parse(attempt.submittedAt)-Date.parse(attempt.startedAt))/1000))/60));
    const graded=status==='graded',title=attempt.examTitle||exam.title||'Bài thi';
    const written=keys.reduce((sum,key)=>sum+Number(skills[key]?.score||0),0),max=keys.reduce((sum,key)=>sum+Number(skills[key]?.max||0),0);
    const speaking=skills.speaking;
    const result=attempt?(attempt.resultSummary?.result||(isStandardTelc(exam)?telcResult(skills):attempt.result)):'—';
    return `<tr><td><button class="table-link" data-action="student-profile" data-id="${esc(student.id)}">${esc(student.name)}</button></td><td>${esc(classCode)}</td><td><button class="table-link ${graded?'grade-attempt--graded':''}" data-action="grade-attempt" data-id="${esc(attempt.id)}" aria-label="${graded?'Xem':'Chấm bài'}: ${esc(title)}">${esc(title)}</button><span class="phu">${attempt.attemptNo?`Lần #${esc(attempt.attemptNo)} · `:''}${fmtDate(attempt.submittedAt)}</span></td><td>${Number.isFinite(minutes)?`${minutes} phút`:'—'}</td>${keys.map(key=>`<td>${skills[key]?badge(skills[key].score,skills[key].max):'—'}</td>`).join('')}${telc?`<td>${attempt?badge(written,max):'—'}</td>`:''}<td>${speaking?badge(speaking.score,speaking.max):'—'}${!graded?` <button class="nut nho" data-action="edit-oral" data-id="${esc(attempt.id)}">${speaking?'Sửa':'Nhập điểm'}</button>`:''}</td>${telc?`<td>${esc(result||'—')}</td>`:''}<td><span class="nhan ${graded?'xanh':'vang'}">${graded?'Đã chấm':'Cần chấm'}</span></td></tr>`;
  }).join('');
  return `<div class="tieu-de-trang"><h1>Bài Thi</h1></div><div class="grade-filters">${filtersHtml}</div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Mã lớp</th><th>Bài thi</th><th>Thời gian</th><th>Đọc</th>${telc?'<th>Ngữ pháp</th>':''}<th>Nghe</th><th>Viết</th>${telc?'<th>Tổng điểm</th>':''}<th>Nói</th>${telc?'<th>Kết quả</th>':''}<th>Trạng thái</th></tr></thead><tbody>${rows||`<tr><td colspan="${telc?12:9}">Không có bài thi phù hợp.</td></tr>`}</tbody></table></div>`;
}

export function bindGradebook(root,{data,repo,ui,onSaved,render}){
  root.querySelectorAll('[data-grade-filter]').forEach(select=>select.onchange=()=>{
    ui.gradeFilters={provider:'GOETHE',...ui.gradeFilters,[select.dataset.gradeFilter]:select.value};render();
  });
  root.querySelectorAll('[data-action="edit-oral"]').forEach(button=>button.onclick=()=>{
    const attempt=data.attempts.find(item=>item.id===button.dataset.id),exam=attempt.examSnapshot||data.exams.find(item=>item.id===attempt.examId);
    const existing=skillScores(exam,exam.questionSnapshot||data.questions,attempt).speaking;
    const max=existing?.max||(String(exam.provider).toUpperCase()==='TELC'?75:15);
    const modal=mountDialog('Điểm nói',`<form class="profile-form"><p>${esc(attempt.studentName)} · ${esc(attempt.examTitle)}</p><label>Điểm nói / ${max}<input name="score" type="number" min="0" max="${max}" step="0.01" required value="${existing?.score??''}"></label><p data-error role="alert"></p><button class="nut chinh" type="submit">Lưu điểm</button></form>`);
    modal.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,save=form.querySelector('button');save.disabled=true;
      try{
        const score=Number(form.elements.score.value);
        if(!Number.isFinite(score)||score<0||score>max)throw new Error(`Điểm phải từ 0 đến ${max}.`);
        if(repo.mode==='api'){await repo.call('saveOralScore',{attemptId:attempt.id,score});await repo.reload();}
        else await repo.transaction(state=>{const item=state.attempts.find(a=>a.id===attempt.id);item.oralScore=score;item.oralMax=max;const skills=skillScores(exam,state.questions,item);item.totalScore=Number(Object.values(skills).reduce((sum,entry)=>sum+entry.score,0).toFixed(2));item.result=examResult(exam,skills);});
        modal.remove();await onSaved();
      }catch(error){form.querySelector('[data-error]').textContent=error.message;save.disabled=false;}
    };
  });
}
