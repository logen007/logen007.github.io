import {ATTEMPT_STATUS,getStudentResults} from '../core.js';
import {resultClass} from '../domain/gradebook.js';
import {esc,fmtDate,statusText} from '../ui/format.js';

export function studentResultsHtml({data,user}){
  const attempts=getStudentResults(data,user.id);
  return `<main class="khung student-results"><div class="tieu-de-trang"><div><h1>Kết quả của bạn</h1>${attempts.length?`<p>${attempts.length} bài thi</p>`:''}</div><button class="nut" data-action="student-home">Về danh sách đề</button></div>
    <div class="student-result-list">${attempts.map(attempt=>{
      const published=attempt.status===ATTEMPT_STATUS.PUBLISHED;
      const result=attempt.result==='Trượt'?'Chưa đạt':attempt.result;
      const outcome=published?(result||'Đã chấm'):['grading','ready'].includes(attempt.status)?'Chờ chấm':statusText(attempt.status);
      const tone=published?resultClass(result):'';
return `<article class="student-result-row"><div class="student-result-info"><h2 class="${tone}">${esc(attempt.examTitle||'Bài thi')}</h2><p>Lần ${esc(attempt.attemptNo??1)} · ${esc(fmtDate(attempt.submittedAt||attempt.startedAt))}</p></div><div class="student-result-outcome">${published?`<div class="student-result-score"><strong>${esc(attempt.totalScore??'—')}</strong><span>điểm</span></div>`:''}<span class="student-result-badge ${tone}">${esc(outcome)}</span></div><button class="nut" data-action="student-attempt-detail" data-id="${esc(attempt.id)}" aria-label="Xem bài ${esc(attempt.examTitle||'thi')}, lần ${esc(attempt.attemptNo??1)}">Xem bài</button></article>`;
    }).join('')||'<section class="the student-results-empty"><h2>Chưa có kết quả</h2><p>Chọn một đề để bắt đầu bài thi đầu tiên.</p><button class="nut chinh" data-action="student-home">Chọn đề thi</button></section>'}</div></main>`;
}
