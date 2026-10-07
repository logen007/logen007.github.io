import {
  ATTEMPT_STATUS,byId,getPublishedExams,getStudentResults,getLatestPublishedAttempt,
  getBestPublishedAttempt,summarizeExam
} from '../core.js';
import {esc,fmtDate,statusClass,statusText,countWords} from '../ui/format.js';

export function loginHtml({mode}){
  const demo=mode==='local'?`<div class="che-do-demo"><div class="phu-de">Tài khoản thử nghiệm</div><div class="chon-demo"><button class="nut full demo-login" data-id="student-a">Vào vai Học viên</button><button class="nut full demo-login" data-id="teacher-lan">Vào vai Cô Lan</button><button class="nut full demo-login" data-id="master-1">Vào vai Quản trị cấp cao</button></div></div>`:'';
  return `<main class="dang-nhap"><section class="gioi-thieu"><div class="nhan-muc">G2G CAREER · THI THỬ</div><h1>Luyện đến khi bước vào phòng thi thật không còn bỡ ngỡ.</h1><p>Hệ thống giúp học viên quen giao diện, cách chuyển phần, đồng hồ, nghe âm thanh, viết bài và nộp bài trên máy tính.</p><div class="phu-de">Đọc hiểu · Ngữ pháp · Nghe hiểu · Viết · Nói</div></section><section class="hop-dang-nhap"><h2>Đăng nhập</h2><p>Dùng tài khoản Google của bạn để tiếp tục. Hệ thống tự nhận quyền Học viên, Giáo viên hoặc Master Admin theo tài khoản.</p><button class="dang-nhap-google" id="googleLogin">Đăng nhập bằng Google</button>${demo}</section></main>`;
}

export function studentHomeHtml({data,user}){
  const exams=getPublishedExams(data);
  const attempts=getStudentResults(data,user.id);
  const latest=getLatestPublishedAttempt(data,user.id);
  const best=getBestPublishedAttempt(data,user.id);
  const latestExam=latest&&byId(data.exams,latest.examId);
  return `<main class="khung"><div class="tieu-de-trang"><div><h1>Xin chào, ${esc(user.name)}</h1><p>Chọn bài thi để bắt đầu.</p></div><button class="nut" data-action="student-results">Xem toàn bộ kết quả</button></div>${latest?`<section class="the tong-quan-hv"><div class="o"><span>Bài thi gần nhất</span><b>${esc(latestExam?.title||latest.examTitle)}</b><small class="phu-de">${fmtDate(latest.submittedAt)} · Lần #${latest.attemptNo}</small></div><div class="o"><span>Điểm gần nhất</span><b>${latest.totalScore??'—'}</b></div><div class="o"><span>Điểm cao nhất</span><b>${best?.totalScore??'—'}</b></div><div class="o"><span>Số lần thi</span><b>${attempts.length}</b></div><div class="o"><span>Kết quả</span><b class="dat">${esc(latest.result||'—')}</b></div></section>`:''}<div class="tieu-de-trang" style="margin-top:26px"><div><h1 style="font-size:20px">Chọn bài thi</h1><p>${exams.length} bài đang mở</p></div></div><section class="danh-sach-de">${exams.map(ex=>studentExamCardHtml(ex,attempts,data)).join('')}</section></main>`;
}

export function studentExamCardHtml(ex,attempts,data){
  const mine=attempts.filter(a=>a.examId===ex.id);
  const current=mine.find(a=>a.status===ATTEMPT_STATUS.IN_PROGRESS);
  const waiting=mine.find(a=>a.status===ATTEMPT_STATUS.GRADING||a.status===ATTEMPT_STATUS.READY);
  const published=mine.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED);
  const best=[...published].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0];
  const sum=summarizeExam(ex,data);
  const mins=(ex.sections||[]).reduce((n,s)=>n+(Number(s.timeMinutes)||0),0);
  return `<article class="the the-de"><span class="nhan">${esc(ex.level)} · THI THỬ</span><h3>${esc(ex.title)}</h3><div class="meta">${sum.sections} phần · ${sum.questions} câu · khoảng ${mins} phút</div><div class="day"></div><div class="chan"><span>${current?'Đang làm dở':waiting?'Có bài đang chờ chấm':mine.length?`Đã thi ${mine.length} lần`:'Chưa từng thi'}</span><b>${best?`Cao nhất ${best.totalScore}`:'Mới'}</b></div><div class="hanh-dong">${current?`<button class="nut chinh" data-action="resume" data-exam="${ex.id}" data-attempt="${current.id}">Tiếp tục</button><button class="nut" data-action="restart" data-exam="${ex.id}">Làm lại từ đầu</button>`:`<button class="nut chinh" data-action="start" data-exam="${ex.id}">${mine.length?'Thi lại':'Bắt đầu thi'}</button>`}</div></article>`;
}

export function studentResultsHtml({data,user}){
  const attempts=getStudentResults(data,user.id);
  return `<main class="khung"><div class="tieu-de-trang"><div><h1>Toàn bộ kết quả</h1><p>Bài chưa được giáo viên công bố sẽ không hiển thị điểm.</p></div><button class="nut" data-action="student-home">Quay lại</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Lần thi</th><th>Ngày</th><th>Tổng điểm</th><th>Kết quả</th><th>Trạng thái</th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.examTitle)}</b></td><td>#${a.attemptNo}</td><td>${fmtDate(a.submittedAt||a.startedAt)}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?(a.totalScore??'—'):'—'}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?esc(a.result||'—'):'—'}</td><td><span class="nhan ${statusClass(a.status)}">${statusText(a.status)}</span></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có lần thi nào.</td></tr>'}</tbody></table></div></main>`;
}

export function examHtml({attempt,exam,sectionIndex,questions,online,preview=false,previewSummary=null}){
  const sec=exam.sections[sectionIndex];
  const answered=questions.filter(q=>answerPresent(attempt.answers?.[q.id],q)).length;
  const previousAction=preview?'preview-prev-section':'prev-section';
  const nextAction=preview?(sectionIndex===exam.sections.length-1?'close-preview':'preview-next-section'):(sectionIndex===exam.sections.length-1?'submit-exam':'next-section');
  const nextLabel=sectionIndex===exam.sections.length-1?(preview?'Kết thúc preview':'Nộp bài'):'Tiếp theo';
  const previewNavigation=preview?`<aside class="preview-outline" aria-label="Danh sách phần xem thử"><div class="preview-outline-head"><div><span class="preview-eyebrow">CẤU TRÚC ĐỀ</span><b data-preview-total>${previewSummary?.answered||0}/${previewSummary?.total||0} câu</b></div><button class="preview-reset" data-action="reset-preview" title="Làm lại Preview">Làm lại</button></div><div class="preview-section-list">${(previewSummary?.sections||[]).map((item,index)=>`<button class="preview-section ${index===sectionIndex?'active':''}" data-action="preview-select-section" data-index="${index}"><span><b>${esc(item.name)}</b><small data-preview-section-progress="${index}">${item.answered}/${item.total} câu</small></span><i data-preview-section-check="${index}" aria-hidden="true">${item.answered===item.total&&item.total?'✓':index===sectionIndex?'→':''}</i></button>`).join('')}</div></aside>`:'';
  const sectionInstruction=sec.instruction||sec.instructionImageUrl?`<section class="exam-instruction">${sec.instruction?`<div><span>ĐỀ BÀI</span><p>${esc(sec.instruction)}</p></div>`:''}${sec.instructionImageUrl?`<img src="${esc(sec.instructionImageUrl)}" alt="Hình minh họa đề bài">`:''}</section>`:'';
  const currentCount=`<span ${preview?'data-preview-current':'data-current-answer-count'}>${answered}/${questions.length} câu đã trả lời</span>`;
  const body=`<main class="noi-dung-thi"><div class="exam-context"><div class="exam-title-block"><div class="nhan-muc">${esc(exam.level)} · ${esc(exam.title)}</div><h1>${esc(sec.name)}</h1><div class="phu-de">${sec.showTimer!==false?'Có giới hạn thời gian · ':''}${currentCount}</div></div>${preview?`<div class="preview-progress" aria-label="Tiến độ xem thử"><span data-preview-total>${previewSummary?.answered||0}/${previewSummary?.total||0} câu</span><div><i data-preview-progress style="width:${previewSummary?.total?Math.round((previewSummary.answered/previewSummary.total)*100):0}%"></i></div></div>`:''}</div>${sectionInstruction}<section class="to-thi">${questions.map(q=>renderQuestionHtml(q,attempt.answers?.[q.id],attempt,{sectionInstruction:sec.instruction||''})).join('')||'<div class="rong">Phần này chưa có câu hỏi.</div>'}</section><div class="dieu-huong-thi"><button class="nut" data-action="${previousAction}" ${sectionIndex===0?'disabled':''}>Quay lại</button><span class="tien-do" id="saveState">${preview?currentCount:`Đã trả lời <span data-current-answer-count>${answered}/${questions.length} câu đã trả lời</span> · Còn lại <b id="examTimeSummary">--:--</b>`}</span><button class="nut chinh" data-action="${nextAction}">${nextLabel}</button></div></main>`;
  const previewTop=preview?`<div class="preview-notice"><div><span class="preview-chip">XEM THỬ</span><span>Trả lời ở đây chỉ dùng để kiểm tra luồng thi, không lưu kết quả.</span></div><button class="nut nho" data-action="close-preview">Quay lại chỉnh sửa</button></div>`:'';
  return `<div class="thi ${preview?'thi--preview':''}"><header class="thanh-thi"><strong>G2G Thi thử</strong><div class="thong-tin-thi"><span>Phần ${sectionIndex+1}/${exam.sections.length}</span>${preview?'<b>Xem thử</b>':`<span class="exam-time-label">Còn lại</span><b id="examTimer">--:--</b>`}</div></header>${previewTop}${!online?'<div class="offline">Đang ngoại tuyến. Hãy giữ trang mở; câu trả lời sẽ tiếp tục được lưu trên thiết bị.</div>':''}${preview?`<div class="preview-shell">${body}${previewNavigation}</div>`:body}</div>`;
}

export function answerPresent(answer,q){
  if(q.type==='writing')return Boolean(String(answer||'').trim());
  if(q.type==='matching')return Array.isArray(answer)&&answer.some(Boolean);
  return answer!==undefined&&answer!==null&&answer!=='';
}

export function renderQuestionHtml(q,answer,attempt,{sectionInstruction=''}={}){
  const played=sessionStorage.getItem(`g2g.audio.${attempt.id}.${q.id}`);
  const audio=q.audioUrl?`<div class="audio-thi"><audio id="audio-${q.id}" preload="metadata" src="${esc(q.audioUrl)}"></audio><button class="nut nho chinh play-audio" data-q="${q.id}" ${played?'disabled':''}>${played?'Đã phát audio':'Phát audio'}</button><span class="phu-de">Audio chỉ phát theo quy định của đề thi.</span></div>`:'';
  const rawPrompt=String(q.prompt||q.title||'').trim();
  const normalizedPrompt=rawPrompt.toLocaleLowerCase(),normalizedSection=String(sectionInstruction||'').toLocaleLowerCase();
  const isSharedInstruction=normalizedPrompt.length>12&&normalizedSection.includes(normalizedPrompt);
  const questionText=rawPrompt==='Nháp'||isSharedInstruction?'':rawPrompt;
  const head=`${q.instruction?`<div class="question-instruction">${esc(q.instruction)}</div>`:''}${questionText?`<div class="noi">${esc(questionText)}</div>`:''}${audio}`;
  const root=`cau-thi ${answerPresent(answer,q)?'is-answered':''}`;
  if(['single','cloze','truefalse'].includes(q.type))return `<div class="${root}" data-q="${q.id}">${head}<div class="answer-options" role="radiogroup">${(q.choices||[]).map((choice,index)=>{const text=typeof choice==='object'?choice.text:choice,imageUrl=typeof choice==='object'?choice.imageUrl||'':'';return `<label class="answer-option"><input class="answer-one" type="radio" name="answer-${q.id}" data-q="${q.id}" value="${index}" ${String(answer)===String(index)?'checked':''}><span class="answer-option-body">${imageUrl?`<img src="${esc(imageUrl)}" alt="">`:''}<span>${esc(text)}</span></span></label>`;}).join('')}</div></div>`;
  if(q.type==='matching')return `<div class="${root}" data-q="${q.id}">${head}${(q.pairs||[]).map((p,i)=>`<div class="matching-row"><b>${esc(p[0])}</b><select class="dap-an answer-match" data-q="${q.id}" data-i="${i}"><option value="">Chọn đáp án</option>${[...new Set((q.pairs||[]).map(x=>x[1]))].map(v=>`<option value="${esc(v)}" ${Array.isArray(answer)&&answer[i]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div>`;
  if(q.type==='writing')return `<div class="${root}" data-q="${q.id}">${head}<textarea class="viet answer-text" data-q="${q.id}" placeholder="Viết bài tại đây...">${esc(answer||'')}</textarea><div class="phu-de" style="text-align:right"><span class="word-count">${countWords(answer||'')}</span> từ</div></div>`;
  if(q.type==='speaking')return `<div class="cau-thi" data-q="${q.id}">${head}<div class="goi-y">Phần Nói được thực hiện theo hướng dẫn của giáo viên/phòng thi thử và được chấm thủ công.</div></div>`;
  return `<div class="cau-thi">${head}</div>`;
}

export function submittedHtml(){
  return `<main class="khung"><section class="the ket-qua-cho"><div class="vong">✓</div><div class="nhan-muc">ĐÃ NỘP BÀI THÀNH CÔNG</div><h1>Đang chờ kết quả</h1><span class="nhan vang">ĐANG CHỜ CHẤM</span><p>Bài thi đã được ghi nhận. Một số phần cần giáo viên chấm thủ công nên hệ thống chưa hiển thị điểm ngay.</p><div class="goi-y"><b>Khi có kết quả</b><br>Hệ thống sẽ gửi email đến địa chỉ bạn dùng để đăng nhập. Bạn cũng có thể quay lại trang kết quả để xem.</div><button class="nut" data-action="student-home" style="margin-top:18px">Về danh sách bài thi</button></section></main>`;
}
