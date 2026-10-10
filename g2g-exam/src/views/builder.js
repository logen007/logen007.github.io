import {byId,getQuestionMaxScore,isMaster,canEditExam} from '../core.js';
import {esc,fmtDate} from '../ui/format.js';
import {getExamSpec,groupSectionsBySkill} from '../exam-specs/index.js';
import {renderPartBuilder} from '../part-templates/index.js';
import {iconHtml} from '../ui/icons.js';
import {writingSubmission} from '../ui/writing-form.js';
import {isAutomaticWritingForm} from '../domain/writing-form.js';
import {resultSummary} from '../domain/result-summary.js';
import {resultSummaryHtml} from './result-summary.js';

export function examBuilderHtml({data,user,exam,section,readOnly}){
  const spec=getExamSpec(exam.provider,exam.level);
  const configured=Boolean(spec?.configured);
  const groups=groupSectionsBySkill(exam,spec);
  const defaultScoreForSection=item=>Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const sectionScore=item=>(item.questionIds||[]).reduce((sum,id)=>sum+getQuestionMaxScore(byId(data.questions,id),defaultScoreForSection(item)),0);
  const sectionQuestionCount=item=>(item.questionIds||[]).filter(id=>!byId(data.questions,id)?.example).length;
  const icons={gear:iconHtml('settings')};
  const partLabel=(item,skill)=>String(item.name||'').startsWith(skill+' ')?String(item.name).replace(skill+' ','Bài '):item.name;
  const editableStructure=!readOnly&&!configured;
  return `<main class="khung goethe-builder"><div class="tieu-de-trang"><div class="builder-heading"><div class="builder-title"><input id="examTitle" class="exam-title-input" aria-label="Tên bài thi" value="${esc(exam.title)}" ${readOnly?'disabled':''}><div class="builder-meta"><button class="text-link builder-back" data-action="back-admin"><span aria-hidden="true">←</span> Quay lại</button><p>${esc([exam.provider,exam.level].filter(Boolean).join(' ')||'Bài thi')}</p></div></div></div><div class="nhom-nut">${readOnly?'':'<span class="builder-save-status" data-builder-save-status role="status" aria-live="polite" hidden></span>'}${canEditExam(user,exam)?`<button class="icon-btn" title="Cài đặt đề" aria-label="Cài đặt đề" data-action="exam-access-settings" data-id="${esc(exam.id)}">${iconHtml('settings')}</button>`:''}<button class="nut" data-action="preview-exam" data-id="${exam.id}">Preview</button><button class="nut chinh" data-action="publish-exam" data-id="${exam.id}" ${exam.status==='published'||readOnly?'disabled':''}>${exam.status==='published'?'Đã xuất bản':'Xuất bản'}</button></div></div>${readOnly?`<div class="goi-y" style="margin-bottom:14px">${canEditExam(user,exam)?'Bài thi đã khóa cấu trúc.':'Chỉ người tạo bài thi mới có thể lưu chỉnh sửa.'}</div>`:''}<div class="goethe-layout"><aside class="goethe-outline">${groups.map(([skill,items])=>`<section class="goethe-skill"><div><b>${esc(skill)}</b><span data-skill-total="${esc(skill)}">${items.reduce((sum,item)=>sum+sectionScore(item),0)} điểm</span>${readOnly?'':`<button class="gear" data-action="open-exam-settings" data-skill="${esc(skill)}" title="Cài đặt ${esc(skill)}" aria-label="Cài đặt ${esc(skill)}">${icons.gear}</button>`}</div>${items.map(item=>`<button class="goethe-part ${section?.id===item.id?'active':''}" data-action="select-section" data-id="${item.id}"><span>${esc(partLabel(item,skill))}</span><small>${sectionQuestionCount(item)} câu</small>${editableStructure?`<span class="phan-tool"><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="up">↑</span><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="down">↓</span><span class="icon-btn" data-action="remove-section" data-id="${item.id}">×</span></span>`:''}</button>`).join('')}</section>`).join('')}${editableStructure?'<button class="nut full" data-action="add-section" style="margin-top:10px">+ Thêm phần</button>':''}</aside><section class="goethe-editor">${section?renderPartBuilder(section.templateType,{data,user,exam,section,readOnly}):'<div class="rong">Chọn một phần để cấu hình.</div>'}</section></div></main>`;
}

export function gradingDetailHtml({data,user,attempt,exam}){
  if(attempt.examSnapshot){exam=attempt.examSnapshot;data={...data,questions:exam.questionSnapshot};}
  const a=attempt,ex=exam,published=a.status==='published';
  const summary=a.resultSummary||resultSummary(ex,data.questions,a);
  const hasSpeakingSection=(ex.sections||[]).some(s=>/speaking|sprechen|nói/i.test(s.skillKey||s.skill||s.name));
  const oralEditor=!hasSpeakingSection?`<div class="grading-score-row"><label for="gradeOralScore">Điểm nói</label><div><input id="gradeOralScore" type="number" min="0" max="${ex.provider==='TELC'?75:15}" step="0.01" value="${a.oralScore??''}" placeholder="Chưa chấm" ${published?'disabled':''}><span>/ ${ex.provider==='TELC'?75:15}</span></div></div>`:'';
  const sections=(ex.sections||[]).map(section=>({section,questions:(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean)}));
  const manual=sections.flatMap(({section,questions})=>questions.filter(q=>!q.example&&!q.autoGrade&&!isAutomaticWritingForm(ex,section,q)));
  const auto=sections.filter(({questions})=>questions.length).map(({section,questions})=>{
    const automatic=questions.filter(q=>!q.example&&(q.autoGrade||isAutomaticWritingForm(ex,section,q)));
    const max=automatic.reduce((sum,q)=>sum+Number(q.maxScore||0),0);
    if(!max)return '';
    const score=Number(a.sectionScores?.[section.name]||0);
    return `<details class="grading-section"><summary><b>${esc(section.name)}</b><span>${score}/${max} điểm</span></summary><div>${automatic.map(q=>{const answer=a.answers?.[q.id];return `<div class="grading-answer"><b>${esc(q.title||q.prompt||'Câu hỏi')}</b><span>Đã chọn: ${esc(answer&&typeof answer==='object'?JSON.stringify(answer):answer??'Chưa trả lời')}</span></div>`;}).join('')}</div></details>`;
  }).filter(Boolean).join('');
  const submission=q=>q.writingFormVersion===1?writingSubmission(q,a.answers?.[q.id]):esc(a.answers?.[q.id]||'(Học viên chưa nhập nội dung)');
  const isFormWriting=sections.some(({section})=>section.questionProfile?.layout==='form-fields');
  const skills=[...new Set(manual.map(q=>q.skill))];
  const manualBody=manual.length?`<h2>${isFormWriting?'Viết · Bài 2':'Phần cần chấm'}</h2>${manual.map(q=>`<div class="grading-writing"><p>${esc(q.title||q.prompt||'')}</p><div class="bai-lam">${q.type==='writing'?submission(q):'Thực hiện theo hướng dẫn của giáo viên.'}</div></div>`).join('')}${skills.map(skill=>{const max=manual.filter(q=>q.skill===skill).reduce((sum,q)=>sum+Number(q.maxScore||0),0);return `<div class="grading-score-row"><label>${isFormWriting&&/viết|writing|schreiben/i.test(skill)?'Điểm Viết Bài 2':esc(skill)}</label><div><input class="manual-score" data-skill="${esc(skill)}" data-max="${max}" type="number" min="0" max="${max}" step="0.01" value="${a.manualScores?.[skill]??''}" ${published?'disabled':''}><span>/ ${max}</span></div></div>`;}).join('')}`:'';
  return `<main class="khung grading-detail"><div class="tieu-de-trang"><div><h1>${esc(a.studentName)}</h1><p>${esc(a.examTitle)} · Lần #${a.attemptNo} · ${fmtDate(a.submittedAt||a.startedAt)}</p></div><div class="nhom-nut"><button class="nut" data-action="back-grading">Quay lại</button>${published?'':`<button class="nut" data-action="save-grade">Lưu tạm</button><button class="nut chinh" data-action="publish-result">Lưu & công bố</button>`}</div></div>${resultSummaryHtml(summary)}<section class="the grading-panel"><h2>Phần tự chấm</h2>${auto||'<p>Không có phần tự chấm.</p>'}${manualBody}${oralEditor}<label class="grading-feedback">Nhận xét<textarea class="nhan-xet" id="gradeFeedback" ${published?'disabled':''}>${esc(a.feedback||'')}</textarea></label><div class="tong-diem"><span>Tổng Điểm</span><strong id="gradeTotal">${summary.total}</strong></div></section></main>`;
}

export function currentGradeTotal(a){
  return (Number(a.autoScore)||0)+Object.values(a.manualScores||{}).reduce((s,n)=>s+(Number(n)||0),0);
}
