import {ATTEMPT_STATUS,getStudentResults,getLatestPublishedAttempt} from '../core.js';
import {STUDENT_LEVELS,normalizeStudentLevel} from '../domain/student-profile.js';
import {resultClass} from '../domain/gradebook.js';
import {esc} from '../ui/format.js';

export function profileStats(data,user){
  const published=getStudentResults(data,user.id).filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  return {published:published.length,passed:published.filter(a=>resultClass(a.result)==='passed').length,latest:getLatestPublishedAttempt(data,user.id),level:normalizeStudentLevel(user.level)||'A1'};
}
export function studentShareText(data,user){
  const stats=profileStats(data,user);
  return `${user.name} · ${stats.level?'Trình độ '+stats.level:'Hành trình học tiếng Đức'}\n${stats.published} bài đã chấm · ${stats.passed} bài đạt\nCùng luyện thi tiếng Đức tại G2G Career!`;
}
export function studentProfileCardHtml(data,user){
  const stats=profileStats(data,user),index=STUDENT_LEVELS.indexOf(stats.level);
  const next=index>=0?STUDENT_LEVELS[index+1]:null;
  const classCode=data.classes?.find(item=>item.id===user.classId)?.code||'Extend';
  const initials=String(user.name||'HV').trim().split(/\s+/).slice(-2).map(word=>word[0]).join('');
  return `<section class="the learner-card" aria-label="Hồ sơ và thành tích học viên">
    <div class="learner-identity"><span class="learner-avatar">${user.picture?`<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:esc(initials)}</span><div><span class="phu-de">HỒ SƠ HỌC VIÊN</span><h1>${esc(user.name)}</h1><span class="phu-de">Mã lớp · ${esc(classCode)}</span></div><button class="nut" data-action="share-profile">↗ Chia sẻ</button></div>
    <div class="learner-rank"><div class="learner-emblem" aria-label="Trình độ hiện tại">${esc(stats.level||'—')}</div><div class="learner-rank-info"><span class="phu-de">HẠNG TRÌNH ĐỘ</span><h2>${stats.level?'Chinh phục tiếng Đức':'Bắt đầu hành trình'}</h2><p>${next?`Mục tiêu tiếp theo · <strong>${next}</strong>`:stats.level?'Bạn đang ở bậc cao nhất C2.':'Trình độ sẽ hiển thị khi hồ sơ được cập nhật.'}</p><div class="learner-steps" aria-label="Các bậc trình độ">${['A1','A2','B1','B2','C1','C2'].map((level,i)=>`<span class="${index>=i?'reached':''}" ${stats.level?.startsWith(level)?'aria-current="step"':''}>${level}</span>`).join('')}</div><small>Hạng theo trình độ học tập, không phải xếp hạng giữa học viên.</small></div></div>
    <div class="learner-stats"><div><span>Bài đã chấm</span><strong>${stats.published}</strong></div><div><span>Bài đạt</span><strong>${stats.passed}</strong></div><div><span>Điểm gần nhất</span><strong>${esc(stats.latest?.totalScore??'—')}</strong></div><div><span>Kết quả gần nhất</span><strong class="exam-latest-result ${resultClass(stats.latest?.result)}">${esc(stats.latest?.result||'Chưa có')}</strong></div></div>
    ${classCode==='Extend'?'<button class="nut" data-action="class-enrollment">Nhập mã xác nhận lớp</button>':''}
    <p class="learner-share-status phu-de" data-share-status role="status" aria-live="polite"></p>
  </section>`;
}
export async function shareStudentProfile(data,user){
  const text=studentShareText(data,user),url=location.origin;
  if(navigator.share){await navigator.share({title:'Hành trình tiếng Đức · G2G',text,url});return 'Đã mở chia sẻ.';}
  await navigator.clipboard.writeText(text+'\n'+url);
  return 'Đã sao chép thành tích và liên kết. Bạn có thể dán lên mạng xã hội.';
}
