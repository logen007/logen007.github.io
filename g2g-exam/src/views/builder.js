import {gradingNeighbors} from '../domain/grading-navigation.js';
import {sectionLabel} from '../ui/section-label.js';
import {isPrefilledQuestion} from '../domain/question-display.js';
import {byId,getQuestionMaxScore,isMaster,canEditExam} from '../core.js';
import {textHtml,esc,fmtDate} from '../ui/format.js';
import {getExamSpec,groupSectionsBySkill} from '../exam-specs/index.js';
import {renderPartBuilder} from '../part-templates/index.js';
import {iconHtml} from '../ui/icons.js';
import {examPublishButton,examPublicationVersion} from '../ui/exam-publish-button.js';
import {writingSubmission} from '../ui/writing-form.js';
import {isAutomaticWritingForm} from '../domain/writing-form.js';
import {resultSummary} from '../domain/result-summary.js';
import {manualGroups} from '../domain/manual-grading.js';
import {oralMaximum} from '../domain/gradebook.js';
import {gradingAutomaticHtml,gradingIdentityHtml,gradingHistoryHtml,gradingOutcomeHtml,gradingPanelsHtml,gradingScoreBarsHtml,gradingStatsHtml} from './grading-review.js';

export function examBuilderHtml({data,user,exam,section,readOnly}){
  const spec=getExamSpec(exam.provider,exam.level);
  const configured=Boolean(spec?.configured);
  const groups=groupSectionsBySkill(exam,spec);
  const defaultScoreForSection=item=>Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const sectionScore=item=>(item.questionIds||[]).reduce((sum,id)=>sum+getQuestionMaxScore(byId(data.questions,id),defaultScoreForSection(item)),0);
  const sectionQuestionCount=item=>(item.questionIds||[]).filter(id=>!isPrefilledQuestion(byId(data.questions,id))).length;
  const icons={gear:iconHtml('settings')};
  const partLabel=(item,skill)=>sectionLabel(exam,item)!==item.name?sectionLabel(exam,item):String(item.name||'').startsWith(skill+' ')?String(item.name).replace(skill+' ','Bài '):item.name;
  const editableStructure=!readOnly&&!configured;
  return `<main class="khung goethe-builder"><div class="tieu-de-trang"><div class="builder-heading"><div class="builder-title"><textarea id="examTitle" class="exam-title-input" aria-label="Tên bài thi" rows="1" ${readOnly?'disabled':''}>${esc(exam.title)}</textarea><div class="builder-meta"><button class="text-link builder-back navigation-arrow" aria-label="Quay lại" title="Quay lại" data-action="back-admin">${iconHtml('arrowLeft')}</button><span class="builder-badges">${[exam.provider==='GOETHE'?'Goethe':exam.provider,exam.level].filter(Boolean).map(label=>`<span class="nhan">${esc(label)}</span>`).join('')}</span><span class="builder-version" data-exam-version="${esc(exam.id)}">${examPublicationVersion(exam)}</span></div></div></div><div class="nhom-nut">${readOnly?'':'<span class="builder-save-status" data-builder-save-status role="status" aria-live="polite" hidden></span>'}${canEditExam(user,exam)?`<button class="icon-btn" title="Cài đặt đề" aria-label="Cài đặt đề" data-action="exam-access-settings" data-id="${esc(exam.id)}">${iconHtml('settings')}</button>`:''}<button class="icon-btn" title="Xem trước" aria-label="Xem trước" data-action="preview-exam" data-id="${exam.id}">${iconHtml('preview')}</button>${examPublishButton(exam,{disabled:!canEditExam(user,exam),showVersion:false})}</div></div>${readOnly?`<div class="goi-y" style="margin-bottom:14px">${canEditExam(user,exam)?'Bài thi đã khóa cấu trúc.':'Chỉ người tạo bài thi mới có thể lưu chỉnh sửa.'}</div>`:''}<div class="goethe-layout"><aside class="goethe-outline">${groups.map(([skill,items])=>`<section class="goethe-skill" style="--part-columns:${Math.min(5,Math.max(1,items.length))}"><div><b>${esc(skill)}</b><span data-skill-total="${esc(skill)}">${items.reduce((sum,item)=>sum+sectionScore(item),0)} điểm</span>${readOnly?'':`<button class="gear" data-action="open-exam-settings" data-skill="${esc(skill)}" title="Cài đặt ${esc(skill)}" aria-label="Cài đặt ${esc(skill)}">${icons.gear}</button>`}</div>${items.map(item=>`<button class="goethe-part ${section?.id===item.id?'active':''}" data-action="select-section" data-id="${item.id}"><span>${esc(partLabel(item,skill))}</span><small>${sectionQuestionCount(item)} câu</small>${editableStructure?`<span class="phan-tool"><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="up">↑</span><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="down">↓</span><span class="icon-btn" data-action="remove-section" data-id="${item.id}">×</span></span>`:''}</button>`).join('')}</section>`).join('')}${editableStructure?'<button class="nut full" data-action="add-section" style="margin-top:10px">+ Thêm phần</button>':''}</aside><section class="goethe-editor">${section?renderPartBuilder(section.templateType,{data,user,exam,section,readOnly}):'<div class="rong">Chọn một phần để cấu hình.</div>'}</section></div></main>`;
}

export function gradingDetailHtml({data,user,attempt,exam}){
  if(attempt.examSnapshot){exam=attempt.examSnapshot;data={...data,questions:exam.questionSnapshot};}
  const duration=Number(attempt.durationSeconds??((Date.parse(attempt.submittedAt)-Date.parse(attempt.startedAt))/1000));
  const elapsed=Number.isFinite(duration)?`${Math.floor(Math.max(0,duration)/60)} phút ${Math.floor(Math.max(0,duration)%60)}s`:'—';
  const a=attempt,ex=exam;
  const summary=a.resultSummary||resultSummary(ex,data.questions,a);
  const hasSpeakingSection=(ex.sections||[]).some(s=>/speaking|sprechen|nói/i.test(s.skillKey||s.skill||s.name));
  const oralEditor=!hasSpeakingSection?`<div class="grading-score-row"><label for="gradeOralScore">Điểm nói</label><div><input id="gradeOralScore" type="number" min="0" max="${oralMaximum(ex)}" step="0.01" value="${a.oralScore??''}" placeholder="0"><span>/ ${oralMaximum(ex)}</span></div></div>`:'';
  const sections=(ex.sections||[]).map(section=>({section,questions:(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean)}));
  const auto=gradingAutomaticHtml(ex,data.questions,a);
  const submission=q=>q.writingFormVersion===1?writingSubmission(q,a.answers?.[q.id]):(String(a.answers?.[q.id]||'').trim()?textHtml(a.answers[q.id]):'<span class="grading-writing-empty">Chưa có bài viết</span>');
  const aiSuggestion=q=>{
    if(q.type!=='writing'||q.writingFormVersion===1||!String(q.aiGradingRules||'').trim())return '';
    const suggestion=a.aiWritingSuggestions?.[q.id];
    const findings=(suggestion?.findings||[]).map(item=>`<li class="${item.met?'is-met':'is-missing'}"><span aria-hidden="true">${item.met?'✓':'×'}</span>${esc(item.text)}</li>`).join('');
    const complete=Number.isFinite(Number(suggestion?.suggestedScore))&&suggestion?.status!=='failed';
    const queuePosition=Math.max(1,Number(suggestion?.queuePosition)||1),queueTotal=Math.max(queuePosition,Number(suggestion?.queueTotal)||queuePosition);
    const pending=`<p class="ai-writing-pending"><i aria-hidden="true"></i>Đang trong hàng đợi chấm tự động ${queuePosition}/${queueTotal}</p>`;
    const score=complete?`<div class="ai-writing-score"><b>${esc(suggestion.suggestedScore)}</b><span>điểm</span></div>`:'';
    return `<section class="ai-writing-suggestion" data-ai-writing-suggestion="${esc(q.id)}"><div class="ai-writing-suggestion-head"><strong>Gợi ý chấm điểm</strong>${score}</div>${complete?(findings?`<ul>${findings}</ul>`:''):pending}</section>`;
  };
  const isFormWriting=sections.some(({section})=>section.questionProfile?.layout==='form-fields');
  const manualItems=manualGroups(ex,data.questions).map((group,index)=>({label:sectionLabel(ex,group.section),html:`<h2>${esc(group.section.questionProfile?.manualPerPart?group.section.name:isFormWriting?'Viết · Bài 2':'Phần cần chấm')}</h2>${group.section.instruction?`<p>${textHtml(group.section.instruction)}</p>`:''}${gradingPanelsHtml(group.questions.map((q,i)=>({label:'Bài '+(i+1),html:`<div class="grading-writing"><p>${textHtml(q.aiGradingRules?'':q.title==='Nháp'?'':q.title||q.prompt||'')}</p><div class="bai-lam ${q.type==='writing'&&q.writingFormVersion!==1?(q.handwriting!==false?'lined-writing-paper':'grading-typed-paper'):''}">${q.type==='writing'?submission(q):'Thực hiện theo hướng dẫn của giáo viên.'}</div></div>`})), 'grade-question-'+index)}<div class="grading-score-row"><label>${isFormWriting?'Điểm Viết Bài 2':'Điểm '+esc(group.key)}</label><div><input class="manual-score" placeholder="0" data-skill="${esc(group.key)}" data-max="${group.max}" type="number" min="0" max="${group.max}" step="0.01" value="${a.manualScores?.[group.key]??''}"><span>/ ${group.max}</span></div></div>${group.questions.map(aiSuggestion).join('')}`}));
  if(oralEditor)manualItems.push({label:'Nói',html:`<div class="grading-oral"><span class="grading-oral-icon">${iconHtml('teacher')}</span><h2>Đánh giá phần Nói</h2><p class="phu-de">Nhập điểm phần thi trực tiếp của học viên.</p>${oralEditor}</div>`});
  if(!manualItems.length)manualItems.push({label:'Bài làm',html:'<p class="phu-de">Không có phần cần chấm thủ công.</p>'});
  const neighbors=gradingNeighbors(data,user,a);
  const navigation=`<nav class="grading-navigation" aria-label="Bài cùng lớp">${[[neighbors.previous,'arrowLeft','Bài trước cùng lớp'],[neighbors.next,'arrowRight','Bài tiếp cùng lớp']].map(([target,icon,label])=>`<button class="nut navigation-arrow" data-action="grading-neighbor" data-id="${esc(target?.id||'')}" aria-label="${label}" title="${label}" ${target?'':'disabled'}>${iconHtml(icon)}</button>`).join('')}</nav>`;
  const actions=`<button class="nut navigation-arrow" aria-label="Quay lại" title="Quay lại" data-action="back-grading">${iconHtml('arrowLeft')}</button><span data-grade-save-status role="status" aria-live="polite"></span><button class="nut chinh" data-action="publish-result" ${summary.complete?'':`disabled title="Cần chấm đủ các phần trước khi công bố"`}>${iconHtml('publish')}Công bố</button>`;
  const workspace=gradingPanelsHtml(manualItems,'grade-manual',{actions,wrap:panels=>`<div class="grading-workspace"><section class="grading-panel grading-submissions">${panels}</section><aside class="grading-panel grading-review"><label class="grading-feedback" for="gradeFeedback"><span>Nhận xét</span><textarea class="nhan-xet" id="gradeFeedback" placeholder="Điểm làm tốt và điều học viên cần luyện thêm…">${esc(a.feedback||'')}</textarea></label><div class="tong-diem"><span>Tổng điểm</span><strong id="gradeTotal">${summary.total}</strong></div></aside></div>`});
  return `<main class="khung grading-detail"><div class="the grading-hero tieu-de-trang"><div><div class="phu-de">Bài thi · ${esc([ex.provider,ex.level].filter(Boolean).join(' '))}</div>${gradingIdentityHtml(data,a)}<p>${esc(a.examTitle||ex.title)}</p><p class="phu-de">Lần #${a.attemptNo} · ${elapsed} · ${fmtDate(a.submittedAt||a.startedAt)}</p></div>${gradingOutcomeHtml(summary,a)}${gradingStatsHtml(ex,data.questions,a,summary)}</div>${workspace}${gradingScoreBarsHtml(summary)}<details class="the grading-panel grading-automatic"><summary><span><strong>Đối chiếu trắc nghiệm</strong><small class="phu-de">Câu trả lời, đáp án và các câu cần xem lại</small></span><span class="grading-disclosure-arrow" aria-hidden="true">${iconHtml('chevronDown')}</span></summary><div class="grading-automatic-content">${auto}</div></details>${gradingHistoryHtml(data,ex,a)}${navigation}</main>`;
}

export function currentGradeTotal(a){
  return (Number(a.autoScore)||0)+Object.values(a.manualScores||{}).reduce((s,n)=>s+(Number(n)||0),0);
}
