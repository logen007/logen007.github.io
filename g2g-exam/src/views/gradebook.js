import {esc} from '../ui/format.js';
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
  const filtersHtml=filter('provider','Loại đề',[['GOETHE','Goethe'],['TELC','TELC']],filters.provider)+filter('level','Trình độ',STUDENT_LEVELS.map(item=>[item,item]),filters.level)+filter('classId','Mã lớp',(data.classes||[]).map(item=>[item.id,item.code]),filters.classId)+filter('reviewerId','Giáo viên chấm bài',reviewers.map(item=>[item.id,item.name]),filters.reviewerId)+filter('studentId','Học viên',students.map(item=>[item.id,item.name]),filters.studentId);
  const keys=telc?['reading','grammar','listening','writing']:['reading','listening','writing'];
  const rows=filteredGradebook(data,filters).map(({student,attempt,exam,skills,classCode})=>{
    const minutes=attempt?Math.max(0,Math.round((Date.parse(attempt.submittedAt)-Date.parse(attempt.startedAt))/60000)):null;
    const written=keys.reduce((sum,key)=>sum+Number(skills[key]?.score||0),0),max=keys.reduce((sum,key)=>sum+Number(skills[key]?.max||0),0);
    const speaking=skills.speaking;
    const result=attempt?(attempt.resultSummary?.result||(isStandardTelc(exam)?telcResult(skills):attempt.result)):'—';
    return `<tr><td><button class="table-link" data-action="student-profile" data-id="${esc(student.id)}">${esc(student.name)}</button></td><td>${esc(classCode)}</td><td>${esc(attempt?.examTitle||'—')}</td><td>${Number.isFinite(minutes)?`${minutes} phút`:'—'}</td>${keys.map(key=>`<td>${skills[key]?badge(skills[key].score,skills[key].max):'—'}</td>`).join('')}${telc?`<td>${attempt?badge(written,max):'—'}</td>`:''}<td>${speaking?badge(speaking.score,speaking.max):'—'}${attempt?` <button class="nut nho" data-action="edit-oral" data-id="${esc(attempt.id)}">${speaking?'Sửa':'Nhập điểm'}</button>`:''}</td>${telc?`<td>${esc(result||'—')}</td>`:''}</tr>`;
  }).join('');
  return `<div class="tieu-de-trang"><h1>Bảng điểm</h1></div><div class="grade-filters">${filtersHtml}</div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Mã lớp</th><th>Bài thi gần nhất</th><th>Tổng thời gian</th><th>Điểm đọc</th>${telc?'<th>Ngữ pháp</th>':''}<th>Điểm nghe</th><th>Điểm viết</th>${telc?'<th>Tổng điểm</th>':''}<th>Điểm nói</th>${telc?'<th>Kết quả</th>':''}</tr></thead><tbody>${rows||`<tr><td colspan="${telc?11:8}">Không có kết quả phù hợp.</td></tr>`}</tbody></table></div>`;
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
