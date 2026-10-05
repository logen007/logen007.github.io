import { createRepository } from './repository.js';
import {
  ROLES, ATTEMPT_STATUS, byId, active, isMaster, isTeacher, isStudent,
  canEditQuestion, canEditExam, canGradeExam, getPublishedExams, getVisibleQuestions,
  createQuestion, updateQuestion, softDeleteQuestion, restoreQuestion, permanentlyDeleteQuestion,
  createExam, updateExam, softDeleteExam, restoreExam, permanentlyDeleteExam,
  addSection, removeSection, moveSection, updateSection, addQuestionsToSection,
  removeQuestionFromSection, moveQuestion, requestGrading, resolveGradingRequest,
  startAttempt, saveAnswer, setAttemptSection, submitAttempt, saveManualScore, publishAttempt,
  getStudentResults, getLatestPublishedAttempt, getBestPublishedAttempt, gradebookRows,
  pendingGradingAttempts, validateExamForPublish, publishExam, summarizeExam
} from './core.js';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const repo = await createRepository();
let data = await repo.getState();
let user = await repo.getCurrentUser();
let timerHandle = null;
const saveTimers = new Map();

const ui = {
  view: user ? (isStudent(user) ? 'student-home' : 'admin') : 'login',
  adminTab: 'exams', examId: null, attemptId: null,
  builderExamId: null, builderSectionId: null,
  gradeAttemptId: null, gradeMode: 'best', online: navigator.onLine,
};

repo.subscribe(next => { data = next; render(); });
window.addEventListener('online', () => { ui.online = true; render(); });
window.addEventListener('offline', () => { ui.online = false; render(); });

function esc(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtDate(v){ if(!v) return '—'; try{return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return '—';} }
function statusText(s){ return ({in_progress:'Đang làm',grading:'Đang chờ chấm',ready:'Sẵn sàng công bố',published:'Đã có điểm',abandoned:'Bỏ dở',draft:'Bản nháp',trash:'Thùng rác'})[s]||s; }
function statusClass(s){ return s==='published'||s==='ready'?'xanh':s==='grading'?'vang':s==='abandoned'||s==='trash'?'xam':''; }
function notify(msg){ toast.textContent=msg; toast.classList.remove('an'); clearTimeout(notify.t); notify.t=setTimeout(()=>toast.classList.add('an'),2600); }
async function refresh(){ data=await repo.getState(); user=await repo.getCurrentUser(); render(); }
async function act(fn, success){ try{ const r=await fn(); data=await repo.getState(); if(success) notify(success); render(); return r; }catch(e){ console.error(e); notify(e?.message||'Có lỗi xảy ra.'); } }
function clearTimer(){ if(timerHandle){ clearInterval(timerHandle); timerHandle=null; } }

function topbar(){
  return `<header class="thanh-dau"><div class="thuong-hieu"><div class="logo">G2G</div><div class="ten-he-thong"><strong>Thi thử tiếng Đức</strong><small>Mô phỏng trải nghiệm thi trên máy tính</small></div></div><div class="nhom-nut"><span class="nhan">${isStudent(user)?'Học viên':isMaster(user)?'Quản trị cấp cao':'Giáo viên'}</span><button class="nut nho" data-action="logout">Đăng xuất</button></div></header>${repo.mode==='local'?'<div class="canh-bao-che-do">Đang chạy chế độ dữ liệu cục bộ để thử nghiệm. Khi cấu hình Firebase, hệ thống tự chuyển sang dữ liệu thật và đăng nhập Google.</div>':''}${!ui.online?'<div class="offline">Mất kết nối mạng. Câu trả lời đang lưu trên thiết bị và sẽ đồng bộ khi có mạng.</div>':''}`;
}

function loginView(){
  const demo = repo.mode==='local' ? `<div class="che-do-demo"><div class="phu-de">Tài khoản thử nghiệm</div><div class="chon-demo"><button class="nut full demo-login" data-id="student-a">Vào vai Học viên</button><button class="nut full demo-login" data-id="teacher-lan">Vào vai Cô Lan</button><button class="nut full demo-login" data-id="master-1">Vào vai Quản trị cấp cao</button></div></div>` : '';
  app.innerHTML=`<main class="dang-nhap"><section class="gioi-thieu"><div class="nhan-muc">G2G CAREER · THI THỬ</div><h1>Luyện đến khi bước vào phòng thi thật không còn bỡ ngỡ.</h1><p>Hệ thống thi thử tiếng Đức được thiết kế để học viên quen cách thao tác, quản lý thời gian, nghe âm thanh, chuyển phần và nộp bài trên máy tính.</p><div class="phu-de">Đọc hiểu · Ngữ pháp · Nghe hiểu · Viết · Nói</div></section><section class="hop-dang-nhap"><h2>Đăng nhập</h2><p>Học viên dùng tài khoản Google. Kết quả và toàn bộ lịch sử các lần thi được lưu theo tài khoản.</p><button class="dang-nhap-google" id="googleLogin">Đăng nhập bằng Google</button>${demo}</section></main>`;
  document.getElementById('googleLogin').onclick=async()=>{
    if(repo.mode==='firebase' && repo.signInGoogle){ await act(async()=>{ user=await repo.signInGoogle(); ui.view=isStudent(user)?'student-home':'admin'; }); }
    else notify('Chưa cấu hình Firebase. Hãy dùng một tài khoản thử nghiệm bên dưới.');
  };
  app.querySelectorAll('.demo-login').forEach(b=>b.onclick=async()=>{ await act(async()=>{ user=await repo.signInDemo(b.dataset.id); ui.view=isStudent(user)?'student-home':'admin'; }); });
}

function studentHome(){
  const exams=getPublishedExams(data);
  const attempts=getStudentResults(data,user.id);
  const latest=getLatestPublishedAttempt(data,user.id), best=getBestPublishedAttempt(data,user.id);
  const latestExam=latest?byId(data.exams,latest.examId):null;
  app.innerHTML=topbar()+`<main class="khung"><div class="tieu-de-trang"><div><h1>Xin chào, ${esc(user.name)}</h1><p>Chọn bài thi để bắt đầu.</p></div><button class="nut" data-action="student-results">Xem toàn bộ kết quả</button></div>${latest?`<section class="the tong-quan-hv"><div class="o"><span>Bài thi gần nhất</span><b>${esc(latestExam?.title||latest.examTitle)}</b><small class="phu-de">${fmtDate(latest.submittedAt)} · Lần #${latest.attemptNo}</small></div><div class="o"><span>Điểm gần nhất</span><b>${latest.totalScore??'—'}</b></div><div class="o"><span>Điểm cao nhất</span><b>${best?.totalScore??'—'}</b></div><div class="o"><span>Số lần thi</span><b>${attempts.length}</b></div><div class="o"><span>Kết quả</span><b class="dat">${esc(latest.result||'—')}</b></div></section>`:''}<div class="tieu-de-trang" style="margin-top:26px"><div><h1 style="font-size:20px">Chọn bài thi</h1><p>${exams.length} bài đang mở</p></div></div><section class="danh-sach-de">${exams.map(ex=>studentExamCard(ex,attempts)).join('')}</section></main>`;
}

function studentExamCard(ex,attempts){
  const mine=attempts.filter(a=>a.examId===ex.id); const current=mine.find(a=>a.status===ATTEMPT_STATUS.IN_PROGRESS); const published=mine.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED); const best=[...published].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0];
  const sum=summarizeExam(ex,data); const mins=(ex.sections||[]).reduce((n,s)=>n+(Number(s.timeMinutes)||0),0);
  return `<article class="the the-de"><span class="nhan">${esc(ex.level)} · THI THỬ</span><h3>${esc(ex.title)}</h3><div class="meta">${sum.sections} phần · ${sum.questions} câu · khoảng ${mins} phút</div><div class="day"></div><div class="chan"><span>${current?'Đang làm dở':mine.length?`Đã thi ${mine.length} lần`:'Chưa từng thi'}</span><b>${best?`Cao nhất ${best.totalScore}`:'Mới'}</b></div><div class="hanh-dong">${current?`<button class="nut chinh" data-action="resume" data-exam="${ex.id}" data-attempt="${current.id}">Tiếp tục</button><button class="nut" data-action="restart" data-exam="${ex.id}">Làm lại từ đầu</button>`:`<button class="nut chinh" data-action="start" data-exam="${ex.id}">${mine.length?'Thi lại':'Bắt đầu thi'}</button>`}</div></article>`;
}

function studentResultsView(){
  const attempts=getStudentResults(data,user.id);
  app.innerHTML=topbar()+`<main class="khung"><div class="tieu-de-trang"><div><h1>Toàn bộ kết quả</h1><p>Bài chưa được công bố sẽ không hiển thị điểm.</p></div><button class="nut" data-action="student-home">Quay lại</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Lần thi</th><th>Ngày</th><th>Tổng điểm</th><th>Kết quả</th><th>Trạng thái</th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.examTitle)}</b></td><td>#${a.attemptNo}</td><td>${fmtDate(a.submittedAt||a.startedAt)}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?`${a.totalScore??'—'}`:'—'}</td><td>${a.status===ATTEMPT_STATUS.PUBLISHED?esc(a.result||'—'):'—'}</td><td><span class="nhan ${statusClass(a.status)}">${statusText(a.status)}</span></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có lần thi nào.</td></tr>'}</tbody></table></div></main>`;
}

function examView(){
  clearTimer(); const attempt=byId(data.attempts,ui.attemptId); if(!attempt||attempt.studentId!==user.id||attempt.status!==ATTEMPT_STATUS.IN_PROGRESS){ ui.view='student-home'; render(); return; }
  const exam=byId(data.exams,attempt.examId); if(!exam){ ui.view='student-home'; render(); return; }
  const si=Math.min(attempt.currentSectionIndex||0,Math.max(0,exam.sections.length-1)); const sec=exam.sections[si]; const qs=(sec.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  app.innerHTML=`<div class="thi"><header class="thanh-thi"><strong>G2G Thi thử</strong><div class="thong-tin-thi"><span>Phần ${si+1}/${exam.sections.length}</span><b id="examTimer">--:--</b></div></header>${!ui.online?'<div class="offline">Đang ngoại tuyến. Hãy giữ trang mở; câu trả lời sẽ tiếp tục được lưu trên thiết bị.</div>':''}<main class="noi-dung-thi"><div class="nhan-muc">${esc(exam.level)} · ${esc(exam.title)}</div><h1>${esc(sec.name)}</h1><div class="phu-de">${sec.showTimer!==false?'Có giới hạn thời gian · ':''}${qs.length} câu</div><section class="to-thi">${qs.map(q=>renderQuestion(q,attempt.answers?.[q.id])).join('')||'<div class="rong">Phần này chưa có câu hỏi.</div>'}</section><div class="dieu-huong-thi"><button class="nut" data-action="prev-section" ${si===0?'disabled':''}>Quay lại</button><span class="tien-do" id="saveState">Đã lưu</span><button class="nut chinh" data-action="${si===exam.sections.length-1?'submit-exam':'next-section'}">${si===exam.sections.length-1?'Nộp bài':'Tiếp theo'}</button></div></main></div>`;
  bindExamInputs(attempt,qs); startExamTimer(attempt,exam);
}

function renderQuestion(q,answer){
  const head=`<div class="ma">${esc(q.code||'')}</div><div class="noi">${esc(q.prompt||q.title)}</div>`;
  if(q.type==='single'||q.type==='cloze'||q.type==='truefalse') return `<div class="cau-thi" data-q="${q.id}">${head}<select class="dap-an answer-one" data-q="${q.id}"><option value="">Chọn đáp án</option>${(q.choices||[]).map((c,i)=>`<option value="${i}" ${String(answer)===String(i)?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`;
  if(q.type==='matching') return `<div class="cau-thi" data-q="${q.id}">${head}${(q.pairs||[]).map((p,i)=>`<div style="margin:10px 0"><b>${esc(p[0])}</b><select class="dap-an answer-match" data-q="${q.id}" data-i="${i}"><option value="">Chọn đáp án</option>${(q.pairs||[]).map(x=>`<option value="${esc(x[1])}" ${Array.isArray(answer)&&answer[i]===x[1]?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>`).join('')}</div>`;
  if(q.type==='writing') return `<div class="cau-thi" data-q="${q.id}">${head}<div class="phu-de">${esc(q.instruction||'')}</div><textarea class="viet answer-text" data-q="${q.id}" placeholder="Viết bài tại đây...">${esc(answer||'')}</textarea></div>`;
  if(q.type==='speaking') return `<div class="cau-thi" data-q="${q.id}">${head}<div class="goi-y">Phần Nói được giáo viên chấm trực tiếp. Trong phiên bản web hiện tại, học viên đọc đề và thực hiện phần nói theo hướng dẫn của giáo viên/phòng thi thử.</div></div>`;
  return `<div class="cau-thi">${head}</div>`;
}

function bindExamInputs(attempt,qs){
  app.querySelectorAll('.answer-one').forEach(el=>el.onchange=()=>queueAnswer(attempt.id,el.dataset.q,el.value===''?null:Number(el.value),0));
  app.querySelectorAll('.answer-match').forEach(el=>el.onchange=()=>{ const qid=el.dataset.q; const q=qs.find(x=>x.id===qid); const values=Array(q?.pairs?.length||0).fill(''); app.querySelectorAll(`.answer-match[data-q="${qid}"]`).forEach(x=>values[Number(x.dataset.i)]=x.value); queueAnswer(attempt.id,qid,values,0); });
  app.querySelectorAll('.answer-text').forEach(el=>{ el.oninput=()=>queueAnswer(attempt.id,el.dataset.q,el.value,700); el.onblur=()=>queueAnswer(attempt.id,el.dataset.q,el.value,0); });
}
function queueAnswer(attemptId,qid,value,delay){
  const key=`${attemptId}:${qid}`; clearTimeout(saveTimers.get(key)); const saveState=document.getElementById('saveState'); if(saveState) saveState.textContent='Đang lưu...';
  saveTimers.set(key,setTimeout(async()=>{ await act(()=>repo.transaction(st=>saveAnswer(st,user,attemptId,qid,value))); const e=document.getElementById('saveState'); if(e)e.textContent='Đã lưu'; saveTimers.delete(key); },delay));
}
function startExamTimer(attempt,exam){
  const total=(exam.sections||[]).reduce((n,s)=>n+(Number(s.timeMinutes)||0),0)*60*1000; const deadline=new Date(attempt.startedAt).getTime()+total; const tick=async()=>{ const left=Math.max(0,deadline-Date.now()), el=document.getElementById('examTimer'); if(el){const sec=Math.ceil(left/1000);el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;} if(left<=0){ clearTimer(); await act(()=>repo.transaction(st=>submitAttempt(st,user,attempt.id))); ui.view='submitted'; render(); } }; tick(); timerHandle=setInterval(tick,1000);
}

function submittedView(){ app.innerHTML=topbar()+`<main class="khung"><section class="the ket-qua-cho"><div class="vong">✓</div><div class="nhan-muc">ĐÃ NỘP BÀI THÀNH CÔNG</div><h1>Đang chờ kết quả</h1><span class="nhan vang">ĐANG CHỜ CHẤM</span><p>Bài thi đã được ghi nhận. Một số phần cần giáo viên chấm thủ công nên hệ thống chưa hiển thị điểm ngay.</p><div class="goi-y"><b>Khi có kết quả</b><br>Hệ thống sẽ gửi email đến địa chỉ bạn dùng để đăng nhập. Bạn cũng có thể quay lại trang kết quả để xem.</div><button class="nut" data-action="student-home" style="margin-top:18px">Về danh sách bài thi</button></section></main>`; }

function adminShell(content){
  const tabs=[['exams','Bài thi'],['bank','Ngân hàng câu hỏi'],['grading','Chấm bài'],['grades','Bảng điểm'],...(isMaster(user)?[['teachers','Giáo viên'],['trash','Thùng rác']]:[])];
  return topbar()+`<div class="khung-quan-tri"><aside class="thanh-ben">${tabs.map(([k,l])=>`<button class="muc-ben ${ui.adminTab===k?'active':''}" data-action="admin-tab" data-tab="${k}">${l}</button>`).join('')}</aside><main class="noi-dung-quan-tri">${content}</main></div>`;
}
function adminView(){
  let content=''; if(ui.adminTab==='exams')content=examAdmin(); else if(ui.adminTab==='bank')content=bankAdmin(); else if(ui.adminTab==='grading')content=gradingAdmin(); else if(ui.adminTab==='grades')content=gradesAdmin(); else if(ui.adminTab==='teachers')content=teachersAdmin(); else if(ui.adminTab==='trash')content=trashAdmin(); app.innerHTML=adminShell(content);
}
function examAdmin(){
  const exams=data.exams.filter(x=>x.status!=='trash');
  return `<div class="tieu-de-trang"><div><h1>Bài thi</h1><p>Giáo viên xem được bài của nhau; chỉ chủ bài hoặc Quản trị cấp cao được chỉnh sửa/xóa.</p></div><button class="nut chinh" data-action="new-exam">+ Tạo bài thi</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Bài thi</th><th>Người tạo</th><th>Cấu trúc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${exams.map(ex=>{const s=summarizeExam(ex,data);const own=canEditExam(user,ex);const req=data.gradingRequests.find(r=>r.examId===ex.id&&r.requesterId===user.id&&r.status==='pending');return `<tr><td><b>${esc(ex.title)}</b><span class="phu">${esc(ex.level)} · phiên bản ${ex.version||1}</span></td><td>${esc(ex.ownerName)}</td><td>${s.sections} phần · ${s.questions} câu</td><td><span class="nhan ${ex.status==='published'?'xanh':'xam'}">${ex.status==='published'?'Đã xuất bản':'Bản nháp'}</span></td><td><div class="hanh-dong-bang">${own?`<button class="nut nho" data-action="edit-exam" data-id="${ex.id}">Chỉnh sửa</button>${ex.status!=='published'?`<button class="nut nho chinh" data-action="publish-exam" data-id="${ex.id}">Xuất bản</button>`:''}<button class="nut nho nguy" data-action="delete-exam" data-id="${ex.id}">Xóa</button>`:`<button class="nut nho" data-action="view-exam" data-id="${ex.id}">Xem</button>${isTeacher(user)&&!isMaster(user)?`<button class="nut nho" data-action="request-grade" data-id="${ex.id}" ${req?'disabled':''}>${req?'Đã xin chấm':'Xin chấm'}</button>`:''}`}</div></td></tr>`}).join('')}</tbody></table></div>`;
}
function bankAdmin(){
  const qs=getVisibleQuestions(data,user); return `<div class="tieu-de-trang"><div><h1>Ngân hàng câu hỏi</h1><p>Câu hỏi dùng chung. Chỉ người tạo hoặc Quản trị cấp cao được sửa/xóa.</p></div><button class="nut chinh" data-action="new-question">+ Tạo câu hỏi</button></div><div class="bo-loc"><input class="truong tim" id="bankSearch" placeholder="Tìm mã hoặc tiêu đề..."><select class="truong" id="bankLevel"><option value="">Tất cả trình độ</option><option>B1</option><option>B2</option></select></div><div class="table-wrap"><table class="bang"><thead><tr><th>Mã</th><th>Câu hỏi</th><th>Phân loại</th><th>Người tạo</th><th>Đã dùng</th><th>Thao tác</th></tr></thead><tbody id="bankRows">${questionRows(qs)}</tbody></table></div>`;
}
function questionRows(qs){ return qs.map(q=>`<tr data-search="${esc((q.code+' '+q.title).toLowerCase())}" data-level="${esc(q.level)}"><td><b>${esc(q.code)}</b></td><td><b>${esc(q.title)}</b><span class="phu">${esc(q.type)}</span></td><td>${esc(q.level)} · ${esc(q.skill)}<span class="phu">${esc(q.part)}</span></td><td>${esc(q.ownerName)}</td><td>${q.usedCount||0} đề</td><td><div class="hanh-dong-bang">${canEditQuestion(user,q)?`<button class="nut nho" data-action="edit-question" data-id="${q.id}">Sửa</button><button class="nut nho nguy" data-action="delete-question" data-id="${q.id}">Xóa</button>`:'<span class="phu-de">Chỉ đọc / dùng lại</span>'}</div></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Chưa có câu hỏi.</td></tr>'; }
function gradingAdmin(){
  const attempts=pendingGradingAttempts(data,user); const requests=data.gradingRequests.filter(r=>r.status==='pending'&&(isMaster(user)||byId(data.exams,r.examId)?.ownerId===user.id));
  return `<div class="tieu-de-trang"><div><h1>Chấm bài</h1><p>Bài đã nộp và đang chờ chấm thủ công.</p></div></div><div class="hang-thong-ke"><div class="thong-ke"><span>Chờ / đang chấm</span><b>${attempts.filter(a=>a.status===ATTEMPT_STATUS.GRADING).length}</b></div><div class="thong-ke"><span>Sẵn sàng công bố</span><b>${attempts.filter(a=>a.status===ATTEMPT_STATUS.READY).length}</b></div><div class="thong-ke"><span>Yêu cầu xin chấm</span><b>${requests.length}</b></div><div class="thong-ke"><span>Đã công bố</span><b>${data.attempts.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED).length}</b></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Lần</th><th>Điểm tự động</th><th>Trạng thái</th><th></th></tr></thead><tbody>${attempts.map(a=>`<tr><td><b>${esc(a.studentName)}</b><span class="phu">${esc(a.studentEmail)}</span></td><td>${esc(a.examTitle)}</td><td>#${a.attemptNo}</td><td>${a.autoScore||0}</td><td><span class="nhan ${statusClass(a.status)}">${statusText(a.status)}</span></td><td><button class="nut nho chinh" data-action="grade-attempt" data-id="${a.id}">${a.status===ATTEMPT_STATUS.READY?'Kiểm tra':'Chấm bài'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="rong">Không có bài nào cần chấm.</td></tr>'}</tbody></table></div>${requests.length?`<div class="the" style="margin-top:16px"><h3>Yêu cầu xin chấm bài</h3>${requests.map(r=>`<div class="cau-item"><div class="noi"><b>${esc(r.requesterName)} xin chấm ${esc(r.examTitle)}</b></div><div class="nhom-nut"><button class="nut nho chinh" data-action="resolve-request" data-id="${r.id}" data-status="approved">Duyệt</button><button class="nut nho" data-action="resolve-request" data-id="${r.id}" data-status="rejected">Từ chối</button></div></div>`).join('')}</div>`:''}`;
}
function gradesAdmin(){
  const rows=gradebookRows(data,ui.gradeMode); return `<div class="tieu-de-trang"><div><h1>Bảng điểm</h1><p>Xem điểm cao nhất hoặc điểm gần nhất của từng học viên.</p></div></div><div class="nhom-nut" style="margin-bottom:14px"><button class="nut ${ui.gradeMode==='best'?'chinh':''}" data-action="grade-mode" data-mode="best">Điểm cao nhất</button><button class="nut ${ui.gradeMode==='latest'?'chinh':''}" data-action="grade-mode" data-mode="latest">Điểm gần nhất</button></div><div class="table-wrap"><table class="bang"><thead><tr><th>Học viên</th><th>Bài thi</th><th>Tổng điểm</th><th>Kết quả</th><th>Số lần thi</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.user.name)}</b><span class="phu">${esc(r.user.email)}</span></td><td>${esc(r.attempt?.examTitle||'—')}</td><td>${r.attempt?.totalScore??'—'}</td><td>${esc(r.attempt?.result||'—')}</td><td>${r.attempts.length}</td></tr>`).join('')}</tbody></table></div>`;
}
function teachersAdmin(){
  if(!isMaster(user)) return '<div class="rong">Không có quyền.</div>'; return `<div class="tieu-de-trang"><div><h1>Giáo viên & tài khoản</h1><p>Học viên cần đăng nhập Google ít nhất một lần trước khi được nâng quyền thành giáo viên.</p></div></div><div class="table-wrap"><table class="bang"><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>${data.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${u.role==='master'?'Quản trị cấp cao':u.role==='teacher'?'Giáo viên':'Học viên'}</td><td>${u.id===user.id?'—':`<button class="nut nho" data-action="toggle-teacher" data-id="${u.id}">${u.role==='teacher'?'Chuyển về Học viên':'Đặt làm Giáo viên'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
function trashAdmin(){
  const exams=data.exams.filter(x=>x.status==='trash'), qs=data.questions.filter(x=>x.status==='trash'); return `<div class="tieu-de-trang"><div><h1>Thùng rác</h1><p>Chỉ Quản trị cấp cao nhìn thấy và xóa vĩnh viễn.</p></div></div><h3>Bài thi</h3>${trashTable(exams,'exam')}<h3 style="margin-top:20px">Câu hỏi</h3>${trashTable(qs,'question')}`;
}
function trashTable(items,type){ return `<div class="table-wrap"><table class="bang"><tbody>${items.map(x=>`<tr><td><b>${esc(x.title)}</b></td><td>${esc(x.ownerName||'')}</td><td><div class="hanh-dong-bang"><button class="nut nho" data-action="restore-${type}" data-id="${x.id}">Khôi phục</button><button class="nut nho nguy" data-action="permanent-${type}" data-id="${x.id}">Xóa vĩnh viễn</button></div></td></tr>`).join('')||'<tr><td class="rong">Trống</td></tr>'}</tbody></table></div>`; }

function examBuilderView(){
  const ex=byId(data.exams,ui.builderExamId); if(!ex||!canEditExam(user,ex)){ui.view='admin';render();return;} const sec=ex.sections.find(s=>s.id===ui.builderSectionId)||ex.sections[0]; if(sec)ui.builderSectionId=sec.id;
  app.innerHTML=topbar()+`<main class="khung"><div class="tieu-de-trang"><div><h1>${esc(ex.title)}</h1><p>Thêm, bớt, sắp xếp các phần và câu hỏi.</p></div><div class="nhom-nut"><button class="nut" data-action="back-admin">Quay lại</button><button class="nut ${ex.status==='published'?'':'chinh'}" data-action="publish-exam" data-id="${ex.id}" ${ex.status==='published'?'disabled':''}>${ex.status==='published'?'Đã xuất bản':'Xuất bản'}</button></div></div><div class="xay-dung"><aside class="cot-xay"><div class="nhan-muc">CẤU TRÚC BÀI THI</div><div class="cai-dat"><label>Tên bài thi</label><input id="examTitle" value="${esc(ex.title)}"></div>${ex.sections.map((s,i)=>`<div class="phan-item ${sec?.id===s.id?'active':''}" data-action="select-section" data-id="${s.id}"><div class="phan-head"><div><b>${String(i+1).padStart(2,'0')} · ${esc(s.name)}</b><div class="phu-de">${s.questionIds.length} câu</div></div><div class="phan-tool"><button class="icon-btn" data-action="move-section" data-id="${s.id}" data-dir="up">↑</button><button class="icon-btn" data-action="move-section" data-id="${s.id}" data-dir="down">↓</button><button class="icon-btn" data-action="remove-section" data-id="${s.id}">×</button></div></div></div>`).join('')}<button class="nut full" data-action="add-section" style="margin-top:10px">+ Thêm phần</button></aside><section class="cot-xay"><div class="tieu-de-trang"><div><h1 style="font-size:20px">${esc(sec?.name||'Chưa có phần')}</h1><p>Thêm câu từ ngân hàng hoặc tạo câu mới.</p></div><div class="nhom-nut"><button class="nut" data-action="open-bank-picker">+ Thêm từ ngân hàng</button><button class="nut chinh" data-action="new-question">+ Tạo câu mới</button></div></div>${sec?(sec.questionIds||[]).map(qid=>{const q=byId(data.questions,qid);if(!q)return'';return `<div class="cau-item"><div class="noi"><b>${esc(q.code)} · ${esc(q.title)}</b><small>${esc(q.skill)} · ${q.maxScore} điểm</small></div><div class="nhom-nut"><button class="nut nho" data-action="move-question" data-id="${q.id}" data-dir="up">↑</button><button class="nut nho" data-action="move-question" data-id="${q.id}" data-dir="down">↓</button><button class="nut nho nguy" data-action="remove-question" data-id="${q.id}">Bỏ</button></div></div>`}).join(''):'<div class="rong">Hãy thêm một phần.</div>'}</section><aside class="cot-xay cai-dat"><div class="nhan-muc">CÀI ĐẶT PHẦN</div>${sec?`<label>Tên phần</label><input id="sectionName" value="${esc(sec.name)}"><label>Thời gian (phút)</label><input id="sectionTime" type="number" min="1" value="${sec.timeMinutes||30}"><label>Điểm tối đa</label><input id="sectionMax" type="number" min="0" value="${sec.maxScore||0}"><label class="check"><input id="showTimer" type="checkbox" ${sec.showTimer!==false?'checked':''}> Hiển thị đồng hồ</label><label class="check"><input id="autoSubmit" type="checkbox" ${sec.autoSubmit!==false?'checked':''}> Tự nộp khi hết giờ</label><label class="check"><input id="shuffle" type="checkbox" ${sec.shuffle?'checked':''}> Trộn thứ tự câu hỏi</label><button class="nut full" data-action="save-section" style="margin-top:12px">Lưu cài đặt phần</button>`:''}<div class="goi-y"><b>Lưu ý</b><br>Nếu bài thi đã có học viên làm, nên hạn chế thay đổi cấu trúc để tránh khác phiên bản.</div></aside></div></main>`;
}

function gradingDetailView(){
  const a=byId(data.attempts,ui.gradeAttemptId); const ex=a&&byId(data.exams,a.examId); if(!a||!ex||!canGradeExam(data,user,ex)){ui.view='admin';render();return;} const manualQs=ex.sections.flatMap(s=>s.questionIds.map(id=>byId(data.questions,id))).filter(q=>q&&!q.autoGrade); const skills=[...new Set(manualQs.map(q=>q.skill))];
  app.innerHTML=topbar()+`<main class="khung"><div class="tieu-de-trang"><div><h1>${esc(a.studentName)} · ${esc(a.examTitle)}</h1><p>Lần #${a.attemptNo} · ${fmtDate(a.submittedAt)}</p></div><div class="nhom-nut"><button class="nut" data-action="back-grading">Quay lại</button><button class="nut" data-action="save-grade">Lưu tạm</button>${(isMaster(user)||ex.ownerId===user.id)?`<button class="nut chinh" data-action="publish-result" ${a.status!==ATTEMPT_STATUS.READY?'disabled':''}>Công bố kết quả</button>`:''}</div></div><div class="cham-bai"><aside class="ds-cham"><div class="nhan-muc">BÀI LÀM CẦN CHẤM</div>${manualQs.map(q=>`<div class="hv-cham"><b>${esc(q.skill)} · ${esc(q.title)}</b><div class="phu-de">${q.maxScore} điểm</div></div>`).join('')}</aside><section class="phieu-cham"><div class="nhan-muc">BÀI LÀM</div>${manualQs.map(q=>`<h3>${esc(q.skill)} · ${esc(q.title)}</h3><div class="bai-lam">${q.type==='writing'?esc(a.answers?.[q.id]||'(Học viên chưa nhập nội dung)'):'Phần này được thực hiện trực tiếp/ghi âm theo quy trình phòng thi thử.'}</div>`).join('')}<h3>Phiếu chấm</h3>${skills.map(skill=>{const max=manualQs.filter(q=>q.skill===skill).reduce((n,q)=>n+(Number(q.maxScore)||0),0);return `<div class="tieu-chi"><div><b>${esc(skill)}</b><div class="phu-de">Tối đa ${max} điểm</div></div><input class="manual-score" data-skill="${esc(skill)}" data-max="${max}" type="number" min="0" max="${max}" value="${a.manualScores?.[skill]??''}"></div>`}).join('')}<label class="phu-de" style="display:block;margin-top:14px">Nhận xét cho học viên</label><textarea class="nhan-xet" id="gradeFeedback">${esc(a.feedback||'')}</textarea><div class="tong-diem"><span>Điểm tự động</span><span>${a.autoScore||0}</span></div><div class="tong-diem"><span>Tổng hiện tại</span><span id="gradeTotal">${currentGradeTotal(a)}</span></div></section></div></main>`;
  bindGradeCalculator(a);
}
function currentGradeTotal(a){ return (Number(a.autoScore)||0)+Object.values(a.manualScores||{}).reduce((s,n)=>s+(Number(n)||0),0); }
function bindGradeCalculator(a){ app.querySelectorAll('.manual-score').forEach(i=>i.oninput=()=>{ let n=Number(a.autoScore)||0; app.querySelectorAll('.manual-score').forEach(x=>n+=Number(x.value)||0); document.getElementById('gradeTotal').textContent=n; }); }

function questionModal(q=null, onCreated=null){
  const edit=Boolean(q); app.insertAdjacentHTML('beforeend',`<div class="hop-chon" id="modal"><div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">${edit?'CHỈNH SỬA CÂU HỎI':'TẠO CÂU HỎI'}</div><h2>${edit?esc(q.title):'Câu hỏi mới'}</h2></div><button class="nut nho" data-action="close-modal">×</button></div><div class="cai-dat"><label>Trình độ</label><select id="qLevel"><option ${q?.level==='B1'?'selected':''}>B1</option><option ${q?.level==='B2'?'selected':''}>B2</option></select><label>Kỹ năng</label><select id="qSkill">${['Đọc hiểu','Ngữ pháp','Nghe hiểu','Viết','Nói'].map(x=>`<option ${q?.skill===x?'selected':''}>${x}</option>`).join('')}</select><label>Phần</label><input id="qPart" value="${esc(q?.part||'Phần 1')}"><label>Loại câu</label><select id="qType">${[['single','Một đáp án'],['truefalse','Đúng / Sai'],['matching','Ghép nội dung'],['cloze','Điền từ'],['writing','Viết'],['speaking','Nói']].map(([v,l])=>`<option value="${v}" ${q?.type===v?'selected':''}>${l}</option>`).join('')}</select><label>Tiêu đề nội bộ</label><input id="qTitle" value="${esc(q?.title||'')}"><label>Hướng dẫn</label><input id="qInstruction" value="${esc(q?.instruction||'')}"><label>Nội dung</label><textarea id="qPrompt">${esc(q?.prompt||'')}</textarea><label>Đáp án lựa chọn (mỗi dòng một đáp án)</label><textarea id="qChoices">${esc((q?.choices||[]).join('\n'))}</textarea><label>Vị trí đáp án đúng (bắt đầu từ 1)</label><input id="qCorrect" type="number" min="1" value="${q?.correctAnswer!=null?Number(q.correctAnswer)+1:1}"><label>Điểm tối đa</label><input id="qScore" type="number" min="0" value="${q?.maxScore||1}"></div><div class="chan-hop"><span class="phu-de">Câu Viết/Nói sẽ tự chuyển sang chấm thủ công.</span><div class="nhom-nut"><button class="nut" data-action="close-modal">Hủy</button><button class="nut chinh" id="saveQuestion">Lưu câu hỏi</button></div></div></div></div>`);
  document.getElementById('saveQuestion').onclick=async()=>{ const type=document.getElementById('qType').value, choices=document.getElementById('qChoices').value.split('\n').map(x=>x.trim()).filter(Boolean); const input={level:document.getElementById('qLevel').value,skill:document.getElementById('qSkill').value,part:document.getElementById('qPart').value,type,title:document.getElementById('qTitle').value,instruction:document.getElementById('qInstruction').value,prompt:document.getElementById('qPrompt').value,choices,correctAnswer:Math.max(0,(Number(document.getElementById('qCorrect').value)||1)-1),maxScore:Number(document.getElementById('qScore').value)||0,autoGrade:!['writing','speaking'].includes(type),rubric:type==='writing'?[{id:'task',label:'Hoàn thành yêu cầu',max:15},{id:'structure',label:'Tổ chức và diễn đạt',max:15},{id:'language',label:'Ngữ pháp và chính tả',max:15}]:type==='speaking'?[{id:'content',label:'Nội dung',max:25},{id:'fluency',label:'Độ trôi chảy',max:25},{id:'language',label:'Ngôn ngữ',max:25}]:[]}; const result=await act(()=>repo.transaction(st=>edit?updateQuestion(st,user,q.id,input):createQuestion(st,user,input)),edit?'Đã cập nhật câu hỏi.':'Đã tạo câu hỏi.'); closeModal(); if(onCreated&&result)onCreated(result); };
}
function bankPicker(){
  const ex=byId(data.exams,ui.builderExamId), sec=ex?.sections.find(s=>s.id===ui.builderSectionId); if(!sec)return; const qs=getVisibleQuestions(data,user);
  app.insertAdjacentHTML('beforeend',`<div class="hop-chon" id="modal"><div class="noi-hop"><div class="dau-hop"><div><div class="nhan-muc">THÊM TỪ NGÂN HÀNG CÂU HỎI</div><h2>Chọn câu hỏi</h2></div><button class="nut nho" data-action="close-modal">×</button></div><label class="check" style="margin:14px 0"><input id="selectAllBank" type="checkbox"> Chọn tất cả câu hỏi đang hiển thị</label><div class="luoi-chon">${qs.map(q=>`<label class="dong-chon"><input class="bank-pick" type="checkbox" value="${q.id}" ${sec.questionIds.includes(q.id)?'checked':''}><span><b>${esc(q.code)} · ${esc(q.title)}</b><span class="phu-de">${esc(q.level)} · ${esc(q.skill)} · ${esc(q.part)}</span></span></label>`).join('')}</div><div class="chan-hop"><span id="pickCount" class="phu-de">Đã chọn ${sec.questionIds.length} câu</span><button class="nut chinh" id="addPicked">Áp dụng lựa chọn</button></div></div></div>`);
  const items=[...app.querySelectorAll('.bank-pick')], all=document.getElementById('selectAllBank'), count=document.getElementById('pickCount'); const sync=()=>{const n=items.filter(x=>x.checked).length;count.textContent=`Đã chọn ${n} câu`;all.checked=n===items.length&&items.length>0;all.indeterminate=n>0&&n<items.length}; all.onchange=()=>{items.forEach(x=>x.checked=all.checked);sync()};items.forEach(x=>x.onchange=sync);sync(); document.getElementById('addPicked').onclick=async()=>{const ids=items.filter(x=>x.checked).map(x=>x.value);await act(()=>repo.transaction(st=>updateSection(st,user,ex.id,sec.id,{questionIds:ids})),'Đã cập nhật câu hỏi trong phần.');closeModal();};
}
function closeModal(){ document.getElementById('modal')?.remove(); }

function render(){
  clearTimer(); if(!user){ ui.view='login'; loginView(); bindGlobal(); return; }
  if(ui.view==='student-home') studentHome(); else if(ui.view==='student-results') studentResultsView(); else if(ui.view==='exam') examView(); else if(ui.view==='submitted') submittedView(); else if(ui.view==='builder') examBuilderView(); else if(ui.view==='grading-detail') gradingDetailView(); else adminView(); bindGlobal(); bindViewSpecific();
}

function bindGlobal(){
  app.querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=async()=>{await repo.signOut();user=null;ui.view='login';render();});
  app.querySelectorAll('[data-action="student-home"]').forEach(b=>b.onclick=()=>{ui.view='student-home';render();});
  app.querySelectorAll('[data-action="student-results"]').forEach(b=>b.onclick=()=>{ui.view='student-results';render();});
  app.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);
}
function bindViewSpecific(){
  app.querySelectorAll('[data-action="start"]').forEach(b=>b.onclick=()=>beginAttempt(b.dataset.exam,false));
  app.querySelectorAll('[data-action="resume"]').forEach(b=>b.onclick=()=>{ui.attemptId=b.dataset.attempt;ui.view='exam';render();});
  app.querySelectorAll('[data-action="restart"]').forEach(b=>b.onclick=()=>{if(confirm('Bỏ lượt đang làm và bắt đầu lại từ đầu?'))beginAttempt(b.dataset.exam,true);});
  app.querySelectorAll('[data-action="prev-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(-1));
  app.querySelectorAll('[data-action="next-section"]').forEach(b=>b.onclick=()=>moveAttemptSection(1));
  app.querySelectorAll('[data-action="submit-exam"]').forEach(b=>b.onclick=async()=>{if(!confirm('Nộp bài thi? Sau khi nộp bạn sẽ không thể sửa câu trả lời.'))return; await flushTextAnswers(); await act(()=>repo.transaction(st=>submitAttempt(st,user,ui.attemptId))); ui.view='submitted'; render();});
  app.querySelectorAll('[data-action="admin-tab"]').forEach(b=>b.onclick=()=>{ui.adminTab=b.dataset.tab;ui.view='admin';render();});
  app.querySelectorAll('[data-action="new-question"]').forEach(b=>b.onclick=()=>questionModal(null, ui.view==='builder'?async q=>{const ex=byId(data.exams,ui.builderExamId),sec=ex?.sections.find(s=>s.id===ui.builderSectionId);if(ex&&sec)await act(()=>repo.transaction(st=>addQuestionsToSection(st,user,ex.id,sec.id,[q.id])));}:null));
  app.querySelectorAll('[data-action="edit-question"]').forEach(b=>b.onclick=()=>questionModal(byId(data.questions,b.dataset.id)));
  app.querySelectorAll('[data-action="delete-question"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa câu hỏi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteQuestion(st,user,b.dataset.id)),'Đã chuyển câu hỏi vào Thùng rác.');});
  app.querySelectorAll('[data-action="new-exam"]').forEach(b=>b.onclick=()=>createNewExam());
  app.querySelectorAll('[data-action="edit-exam"]').forEach(b=>b.onclick=()=>openBuilder(b.dataset.id));
  app.querySelectorAll('[data-action="delete-exam"]').forEach(b=>b.onclick=()=>{if(confirm('Đưa bài thi này vào Thùng rác?'))act(()=>repo.transaction(st=>softDeleteExam(st,user,b.dataset.id)),'Đã chuyển bài thi vào Thùng rác.');});
  app.querySelectorAll('[data-action="publish-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>publishExam(st,user,b.dataset.id)),'Đã xuất bản bài thi.'));
  app.querySelectorAll('[data-action="request-grade"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>requestGrading(st,user,b.dataset.id)),'Đã gửi yêu cầu xin chấm.'));
  app.querySelectorAll('[data-action="resolve-request"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>resolveGradingRequest(st,user,b.dataset.id,b.dataset.status)),b.dataset.status==='approved'?'Đã duyệt quyền chấm.':'Đã từ chối yêu cầu.'));
  app.querySelectorAll('[data-action="grade-attempt"]').forEach(b=>b.onclick=()=>{ui.gradeAttemptId=b.dataset.id;ui.view='grading-detail';render();});
  app.querySelectorAll('[data-action="grade-mode"]').forEach(b=>b.onclick=()=>{ui.gradeMode=b.dataset.mode;render();});
  app.querySelectorAll('[data-action="toggle-teacher"]').forEach(b=>b.onclick=()=>toggleTeacher(b.dataset.id));
  app.querySelectorAll('[data-action="restore-exam"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreExam(st,user,b.dataset.id)),'Đã khôi phục bài thi.'));
  app.querySelectorAll('[data-action="restore-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>restoreQuestion(st,user,b.dataset.id)),'Đã khôi phục câu hỏi.'));
  app.querySelectorAll('[data-action="permanent-exam"]').forEach(b=>b.onclick=()=>{if(confirm('Xóa vĩnh viễn bài thi? Hành động không thể hoàn tác.'))act(()=>repo.transaction(st=>permanentlyDeleteExam(st,user,b.dataset.id)),'Đã xóa vĩnh viễn.');});
  app.querySelectorAll('[data-action="permanent-question"]').forEach(b=>b.onclick=()=>{if(confirm('Xóa vĩnh viễn câu hỏi? Hành động không thể hoàn tác.'))act(()=>repo.transaction(st=>permanentlyDeleteQuestion(st,user,b.dataset.id)),'Đã xóa vĩnh viễn.');});
  bindBuilder(); bindGrading(); bindFilters();
}
async function beginAttempt(examId,restart){ const a=await act(()=>repo.transaction(st=>startAttempt(st,user,examId,{restart}))); if(a){ui.attemptId=a.id;ui.view='exam';render();} }
async function moveAttemptSection(delta){ await flushTextAnswers(); const a=byId(data.attempts,ui.attemptId), ex=a&&byId(data.exams,a.examId); if(!a||!ex)return; const next=Math.max(0,Math.min(ex.sections.length-1,(a.currentSectionIndex||0)+delta)); await act(()=>repo.transaction(st=>setAttemptSection(st,user,a.id,next))); ui.view='exam';render(); }
async function flushTextAnswers(){ const text=app.querySelector('.answer-text'); if(text&&ui.attemptId) await act(()=>repo.transaction(st=>saveAnswer(st,user,ui.attemptId,text.dataset.q,text.value))); }
async function createNewExam(){ const ex=await act(()=>repo.transaction(st=>createExam(st,user,{title:'Bài thi thử mới',level:'B1',sections:[{id:`sec-${Date.now()}-1`,name:'Đọc hiểu',timeMinutes:35,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]},{id:`sec-${Date.now()}-2`,name:'Ngữ pháp',timeMinutes:20,maxScore:30,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]},{id:`sec-${Date.now()}-3`,name:'Nghe hiểu',timeMinutes:30,maxScore:75,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]},{id:`sec-${Date.now()}-4`,name:'Viết',timeMinutes:30,maxScore:45,showTimer:true,autoSubmit:true,shuffle:false,questionIds:[]},{id:`sec-${Date.now()}-5`,name:'Nói',timeMinutes:15,maxScore:75,showTimer:true,autoSubmit:false,shuffle:false,questionIds:[]}]}))); if(ex)openBuilder(ex.id); }
function openBuilder(id){ const ex=byId(data.exams,id);ui.builderExamId=id;ui.builderSectionId=ex?.sections?.[0]?.id||null;ui.view='builder';render(); }
function bindBuilder(){
  const ex=byId(data.exams,ui.builderExamId); if(!ex)return;
  app.querySelectorAll('[data-action="back-admin"]').forEach(b=>b.onclick=()=>{ui.view='admin';ui.adminTab='exams';render();});
  app.querySelectorAll('[data-action="select-section"]').forEach(b=>b.onclick=e=>{if(e.target.closest('.phan-tool'))return;ui.builderSectionId=b.dataset.id;render();});
  app.querySelectorAll('[data-action="add-section"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>addSection(st,user,ex.id,{name:'Phần mới',timeMinutes:30})),'Đã thêm phần.'));
  app.querySelectorAll('[data-action="move-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();act(()=>repo.transaction(st=>moveSection(st,user,ex.id,b.dataset.id,b.dataset.dir)));});
  app.querySelectorAll('[data-action="remove-section"]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(confirm('Bỏ phần này khỏi bài thi?'))act(()=>repo.transaction(st=>removeSection(st,user,ex.id,b.dataset.id)),'Đã bỏ phần.');});
  app.querySelectorAll('[data-action="move-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>moveQuestion(st,user,ex.id,ui.builderSectionId,b.dataset.id,b.dataset.dir))));
  app.querySelectorAll('[data-action="remove-question"]').forEach(b=>b.onclick=()=>act(()=>repo.transaction(st=>removeQuestionFromSection(st,user,ex.id,ui.builderSectionId,b.dataset.id)),'Đã bỏ câu khỏi phần.'));
  app.querySelectorAll('[data-action="open-bank-picker"]').forEach(b=>b.onclick=bankPicker);
  const title=document.getElementById('examTitle'); if(title)title.onchange=()=>act(()=>repo.transaction(st=>updateExam(st,user,ex.id,{title:title.value})),'Đã đổi tên bài thi.');
  app.querySelectorAll('[data-action="save-section"]').forEach(b=>b.onclick=()=>{const patch={name:document.getElementById('sectionName').value,timeMinutes:Number(document.getElementById('sectionTime').value)||1,maxScore:Number(document.getElementById('sectionMax').value)||0,showTimer:document.getElementById('showTimer').checked,autoSubmit:document.getElementById('autoSubmit').checked,shuffle:document.getElementById('shuffle').checked};act(()=>repo.transaction(st=>updateSection(st,user,ex.id,ui.builderSectionId,patch)),'Đã lưu cài đặt phần.');});
}
function bindGrading(){
  app.querySelectorAll('[data-action="back-grading"]').forEach(b=>b.onclick=()=>{ui.view='admin';ui.adminTab='grading';render();});
  app.querySelectorAll('[data-action="save-grade"]').forEach(b=>b.onclick=()=>saveGrade(false));
  app.querySelectorAll('[data-action="publish-result"]').forEach(b=>b.onclick=()=>saveGrade(true));
}
async function saveGrade(andPublish){ const a=byId(data.attempts,ui.gradeAttemptId); if(!a)return; const scores={}; app.querySelectorAll('.manual-score').forEach(i=>{if(i.value!=='')scores[i.dataset.skill]=Math.min(Number(i.dataset.max)||999,Math.max(0,Number(i.value)||0));}); const feedback=document.getElementById('gradeFeedback')?.value||''; await act(()=>repo.transaction(st=>saveManualScore(st,user,a.id,{scores,feedback})),andPublish?null:'Đã lưu điểm tạm.'); data=await repo.getState(); const fresh=byId(data.attempts,a.id); if(andPublish){ if(fresh.status!==ATTEMPT_STATUS.READY){notify('Cần chấm đủ các phần trước khi công bố.');render();return;} await act(()=>repo.transaction(st=>publishAttempt(st,user,a.id)),'Đã công bố kết quả và xếp email thông báo.'); ui.view='admin';ui.adminTab='grading';render(); } }
function bindFilters(){ const s=document.getElementById('bankSearch'),l=document.getElementById('bankLevel'); if(!s||!l)return; const f=()=>app.querySelectorAll('#bankRows tr[data-search]').forEach(r=>{r.style.display=(!s.value||r.dataset.search.includes(s.value.toLowerCase()))&&(!l.value||r.dataset.level===l.value)?'':'none';});s.oninput=f;l.onchange=f; }
async function toggleTeacher(id){ if(!isMaster(user))return; await act(()=>repo.transaction(st=>{const u=st.users.find(x=>x.id===id);if(!u)throw new Error('Không tìm thấy tài khoản.');if(u.role==='master')throw new Error('Không thể thay đổi tài khoản quản trị cấp cao tại đây.');u.role=u.role==='teacher'?'student':'teacher';u.updatedAt=new Date().toISOString();}),'Đã cập nhật vai trò tài khoản.'); }

render();
