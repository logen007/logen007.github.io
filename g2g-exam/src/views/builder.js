import {byId,getQuestionMaxScore,isMaster} from '../core.js';
import {esc,fmtDate} from '../ui/format.js';
import {getExamSpec,groupSectionsBySkill} from '../exam-specs/index.js';
import {renderPartBuilder} from '../part-templates/index.js';
import {iconHtml} from '../ui/icons.js';

export function examBuilderHtml({data,user,exam,section,readOnly}){
  const spec=getExamSpec(exam.provider,exam.level);
  const configured=Boolean(spec?.configured);
  const groups=groupSectionsBySkill(exam,spec);
  const defaultScoreForSection=item=>Number(exam.settings?.skillSettings?.[item.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const sectionScore=item=>(item.questionIds||[]).reduce((sum,id)=>sum+getQuestionMaxScore(byId(data.questions,id),defaultScoreForSection(item)),0);
  const icons={gear:iconHtml('settings')};
  const partLabel=(item,skill)=>String(item.name||'').startsWith(skill+' ')?String(item.name).replace(skill+' ','Bài '):item.name;
  const editableStructure=!readOnly&&!configured;
  return `<main class="khung goethe-builder"><div class="tieu-de-trang"><div><input id="examTitle" class="exam-title-input" aria-label="Tên bài thi" value="${esc(exam.title)}" ${readOnly?'disabled':''}><p>${esc([exam.provider,exam.level].filter(Boolean).join(' ')||'Bài thi')}</p></div><div class="nhom-nut"><button class="nut" data-action="back-admin">Quay lại</button><button class="nut" data-action="save-exam" ${readOnly?'disabled':''}>Lưu nháp</button><button class="nut" data-action="preview-exam" data-id="${exam.id}">Preview</button><button class="nut chinh" data-action="publish-exam" data-id="${exam.id}" ${exam.status==='published'||readOnly?'disabled':''}>${exam.status==='published'?'Đã xuất bản':'Xuất bản'}</button></div></div>${readOnly?'<div class="goi-y" style="margin-bottom:14px"><b>Đã khóa cấu trúc</b><br>Để thay đổi nội dung, hãy tạo một bài/phiên bản mới.</div>':''}<div class="goethe-layout"><aside class="goethe-outline">${groups.map(([skill,items])=>`<section class="goethe-skill"><div><b>${esc(skill)}</b><span data-skill-total="${esc(skill)}">${items.reduce((sum,item)=>sum+sectionScore(item),0)} điểm</span>${readOnly?'':`<button class="gear" data-action="open-exam-settings" data-skill="${esc(skill)}" title="Cài đặt ${esc(skill)}" aria-label="Cài đặt ${esc(skill)}">${icons.gear}</button>`}</div>${items.map(item=>`<button class="goethe-part ${section?.id===item.id?'active':''}" data-action="select-section" data-id="${item.id}"><span>${esc(partLabel(item,skill))}</span><small>${(item.questionIds||[]).length} câu</small>${editableStructure?`<span class="phan-tool"><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="up">↑</span><span class="icon-btn" data-action="move-section" data-id="${item.id}" data-dir="down">↓</span><span class="icon-btn" data-action="remove-section" data-id="${item.id}">×</span></span>`:''}</button>`).join('')}</section>`).join('')}${editableStructure?'<button class="nut full" data-action="add-section" style="margin-top:10px">+ Thêm phần</button>':''}</aside><section class="goethe-editor">${section?renderPartBuilder(section.templateType,{data,user,exam,section,readOnly}):'<div class="rong">Chọn một phần để cấu hình.</div>'}</section></div></main>`;
}

export function gradingDetailHtml({data,user,attempt,exam}){
  const a=attempt,ex=exam;
  const manualQs=ex.sections.flatMap(s=>s.questionIds.map(id=>byId(data.questions,id))).filter(q=>q&&!q.autoGrade);
  const skills=[...new Set(manualQs.map(q=>q.skill))];
  return `<main class="khung"><div class="tieu-de-trang"><div><h1>${esc(a.studentName)} · ${esc(a.examTitle)}</h1><p>Lần #${a.attemptNo} · ${fmtDate(a.submittedAt)}</p></div><div class="nhom-nut"><button class="nut" data-action="back-grading">Quay lại</button><button class="nut" data-action="save-grade">Lưu tạm</button>${(isMaster(user)||ex.ownerId===user.id)?'<button class="nut chinh" data-action="publish-result">Lưu & công bố</button>':''}</div></div><div class="cham-bai"><aside class="ds-cham"><div class="nhan-muc">BÀI LÀM CẦN CHẤM</div>${manualQs.map(q=>`<div class="hv-cham"><b>${esc(q.skill)} · ${esc(q.title)}</b><div class="phu-de">${q.maxScore} điểm</div></div>`).join('')}</aside><section class="phieu-cham"><div class="nhan-muc">BÀI LÀM</div>${manualQs.map(q=>`<h3>${esc(q.skill)} · ${esc(q.title)}</h3><div class="bai-lam">${q.type==='writing'?esc(a.answers?.[q.id]||'(Học viên chưa nhập nội dung)'):'Phần này được thực hiện trực tiếp/ghi âm theo quy trình phòng thi thử.'}</div>`).join('')}<h3>Phiếu chấm</h3>${skills.map(skill=>{const max=manualQs.filter(q=>q.skill===skill).reduce((n,q)=>n+(Number(q.maxScore)||0),0);return `<div class="tieu-chi"><div><b>${esc(skill)}</b><div class="phu-de">Tối đa ${max} điểm</div></div><input class="manual-score" data-skill="${esc(skill)}" data-max="${max}" type="number" min="0" max="${max}" value="${a.manualScores?.[skill]??''}"></div>`;}).join('')}<label class="phu-de" style="display:block;margin-top:14px">Nhận xét cho học viên</label><textarea class="nhan-xet" id="gradeFeedback">${esc(a.feedback||'')}</textarea><div class="tong-diem"><span>Điểm tự động</span><span>${a.autoScore??'—'}</span></div><div class="tong-diem"><span>Tổng hiện tại</span><span id="gradeTotal">${currentGradeTotal(a)}</span></div></section></div></main>`;
}

export function currentGradeTotal(a){
  return (Number(a.autoScore)||0)+Object.values(a.manualScores||{}).reduce((s,n)=>s+(Number(n)||0),0);
}
