import {ATTEMPT_STATUS,getStudentResults} from '../core.js';
import {resultClass,resultLabel} from '../domain/gradebook.js';
import {esc,fmtDate,statusText} from '../ui/format.js';

export function studentResultsHtml({data,user}){
  const attempts=getStudentResults(data,user.id);
  const number=value=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2});
  return `<main class="khung student-results"><div class="tieu-de-trang student-results-heading"><h1>Kết quả của bạn</h1><span>${attempts.length} bài thi</span></div>
    <div class="student-result-list">${attempts.map(attempt=>{
      const published=attempt.status===ATTEMPT_STATUS.PUBLISHED;
      const result=resultLabel(attempt.result);
      const outcome=published?(result||'Đã công bố'):['submitted','grading','ready'].includes(attempt.status)?'Chờ công bố':statusText(attempt.status);
      const tone=published?resultClass(result):'';
      const exam=(data.exams||[]).find(exam=>exam.id===attempt.examId)||{};
      const title=attempt.examTitle||exam.title||'Bài thi';
      const provider=String(attempt.provider||exam.provider||'').toUpperCase(),level=attempt.level||exam.level;
      const max=attempt.totalMax??Object.values(attempt.resultSummary?.skills||{}).reduce((sum,skill)=>sum+Number(skill.max||0),0);
      const tags=`${provider?`<span class="nhan exam-provider" data-provider="${esc(provider)}">${esc(provider==='FID'?'FID':provider.charAt(0)+provider.slice(1).toLowerCase())}</span>`:''}${level?`<span class="nhan exam-level" data-level="${esc(level)}">${esc(level)}</span>`:''}`;
return `<article class="student-result-row"><div class="student-result-info"><h2 class="${tone}">${esc(title)}</h2><div class="student-result-meta">${tags}<span>Lần ${esc(attempt.attemptNo??1)} · ${esc(fmtDate(attempt.submittedAt||attempt.startedAt))}</span></div></div><div class="student-result-outcome">${published?`<div class="student-result-score"><strong>${attempt.totalScore==null?'—':esc(number(attempt.totalScore))}</strong><span>${max>0?`/ ${esc(number(max))}`:'điểm'}</span></div>`:''}<span class="student-result-badge ${tone}">${esc(outcome)}</span></div><button class="nut" data-action="student-attempt-detail" data-id="${esc(attempt.id)}" aria-label="Xem kết quả ${esc(title)}, lần ${esc(attempt.attemptNo??1)}">Xem kết quả</button></article>`;
    }).join('')||'<section class="the student-results-empty"><h2>Chưa có kết quả</h2><p>Chọn một đề để bắt đầu bài thi đầu tiên.</p><button class="nut chinh" data-action="student-home">Chọn đề thi</button></section>'}</div></main>`;
}
