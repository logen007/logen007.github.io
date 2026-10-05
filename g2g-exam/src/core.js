import { APP_CONFIG } from './config.js';

export const ROLES = Object.freeze({ STUDENT:'student', TEACHER:'teacher', MASTER:'master' });
export const ATTEMPT_STATUS = Object.freeze({ IN_PROGRESS:'in_progress', SUBMITTED:'submitted', GRADING:'grading', READY:'ready', PUBLISHED:'published', ABANDONED:'abandoned' });

export const clone = value => JSON.parse(JSON.stringify(value));
export const nowIso = () => new Date().toISOString();
export const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export const byId = (items,id) => items.find(x=>x.id===id);
export const active = items => items.filter(x=>x.status!=='trash');
export const isTeacher = user => user?.role===ROLES.TEACHER || user?.role===ROLES.MASTER;
export const isMaster = user => user?.role===ROLES.MASTER;
export const isStudent = user => user?.role===ROLES.STUDENT;

export function normalizeState(input){
  const s = clone(input || {});
  s.schemaVersion ||= 2; s.revision ||= 1;
  for (const k of ['users','questions','exams','attempts','gradingRequests','notifications','auditLog']) s[k] ||= [];
  return s;
}

export function audit(state, user, action, entityType, entityId, detail={}){
  state.auditLog.unshift({ id:uid('audit'), at:nowIso(), userId:user?.id||'system', userName:user?.name||'Hệ thống', action, entityType, entityId, detail });
  if (state.auditLog.length>1000) state.auditLog.length=1000;
}

export function canEditQuestion(user,q){ return Boolean(user && q && (isMaster(user) || (isTeacher(user)&&q.ownerId===user.id))); }
export function canDeleteQuestion(user,q){ return canEditQuestion(user,q); }
export function canPermanentlyDelete(user){ return isMaster(user); }
export function canEditExam(user,exam){ return Boolean(user && exam && (isMaster(user) || (isTeacher(user)&&exam.ownerId===user.id))); }
export function canSeeTrash(user){ return isMaster(user); }

export function canGradeExam(state,user,exam){
  if (!isTeacher(user) || !exam) return false;
  if (isMaster(user) || exam.ownerId===user.id) return true;
  return state.gradingRequests.some(r=>r.examId===exam.id && r.requesterId===user.id && r.status==='approved');
}

export function getPublishedExams(state){ return state.exams.filter(x=>x.status==='published'); }
export function getVisibleQuestions(state,user,{includeTrash=false}={}){
  return state.questions.filter(q=> includeTrash ? (isMaster(user) && q.status==='trash') : q.status!=='trash');
}

export function createQuestion(state,user,input){
  if (!isTeacher(user)) throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo câu hỏi.');
  const q={ id:uid('q'), code:input.code||`Q-${String(state.questions.length+1).padStart(4,'0')}`, level:input.level||'B1', skill:input.skill||'Đọc hiểu', part:input.part||'Phần 1', type:input.type||'single', title:(input.title||'Câu hỏi mới').trim(), instruction:input.instruction||'', prompt:input.prompt||'', choices:clone(input.choices||[]), correctAnswer:input.correctAnswer ?? null, pairs:clone(input.pairs||[]), maxScore:Number(input.maxScore||1), autoGrade:input.autoGrade ?? !['writing','speaking'].includes(input.type), rubric:clone(input.rubric||[]), audioUrl:input.audioUrl||'', ownerId:user.id, ownerName:user.name, status:'active', usedCount:0, correctRate:null, createdAt:nowIso(), updatedAt:nowIso() };
  state.questions.push(q); audit(state,user,'create','question',q.id,{title:q.title}); return q;
}

export function updateQuestion(state,user,id,patch){
  const q=byId(state.questions,id); if(!q) throw new Error('Không tìm thấy câu hỏi.');
  if(!canEditQuestion(user,q)) throw new Error('Bạn không có quyền sửa câu hỏi này.');
  const allowed=['code','level','skill','part','type','title','instruction','prompt','choices','correctAnswer','pairs','maxScore','autoGrade','rubric','audioUrl'];
  for(const k of allowed) if(k in patch) q[k]=clone(patch[k]); q.updatedAt=nowIso(); audit(state,user,'update','question',q.id); return q;
}
export function softDeleteQuestion(state,user,id){ const q=byId(state.questions,id); if(!q) throw new Error('Không tìm thấy câu hỏi.'); if(!canDeleteQuestion(user,q)) throw new Error('Bạn không có quyền xóa câu hỏi này.'); q.status='trash'; q.deletedAt=nowIso(); q.updatedAt=nowIso(); audit(state,user,'trash','question',id); return q; }
export function restoreQuestion(state,user,id){ if(!isMaster(user)) throw new Error('Chỉ quản trị cấp cao được khôi phục từ thùng rác.'); const q=byId(state.questions,id); if(!q) throw new Error('Không tìm thấy câu hỏi.'); q.status='active'; delete q.deletedAt; q.updatedAt=nowIso(); audit(state,user,'restore','question',id); return q; }
export function permanentlyDeleteQuestion(state,user,id){ if(!isMaster(user)) throw new Error('Chỉ quản trị cấp cao được xóa vĩnh viễn.'); const idx=state.questions.findIndex(x=>x.id===id); if(idx<0) throw new Error('Không tìm thấy câu hỏi.'); state.questions.splice(idx,1); for(const exam of state.exams) for(const sec of exam.sections||[]) sec.questionIds=(sec.questionIds||[]).filter(qid=>qid!==id); audit(state,user,'delete_forever','question',id); }

export function createExam(state,user,input={}){
  if(!isTeacher(user)) throw new Error('Chỉ giáo viên hoặc quản trị viên mới được tạo bài thi.');
  const exam={ id:uid('exam'), title:(input.title||'Bài thi thử mới').trim(), level:input.level||'B1', ownerId:user.id, ownerName:user.name, status:'draft', version:1, passScore:Number(input.passScore||APP_CONFIG.defaultPassScore), sections:clone(input.sections||[]), createdAt:nowIso(), updatedAt:nowIso()};
  state.exams.push(exam); audit(state,user,'create','exam',exam.id,{title:exam.title}); return exam;
}
export function updateExam(state,user,id,patch){ const exam=byId(state.exams,id); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const allowed=['title','level','passScore','sections','status']; for(const k of allowed) if(k in patch) exam[k]=clone(patch[k]); exam.updatedAt=nowIso(); audit(state,user,'update','exam',id); return exam; }
export function softDeleteExam(state,user,id){ const exam=byId(state.exams,id); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền xóa bài thi này.'); exam.status='trash'; exam.deletedAt=nowIso(); exam.updatedAt=nowIso(); audit(state,user,'trash','exam',id); return exam; }
export function restoreExam(state,user,id){ if(!isMaster(user)) throw new Error('Chỉ quản trị cấp cao được khôi phục bài thi.'); const exam=byId(state.exams,id); if(!exam) throw new Error('Không tìm thấy bài thi.'); exam.status='draft'; delete exam.deletedAt; exam.updatedAt=nowIso(); audit(state,user,'restore','exam',id); return exam; }
export function permanentlyDeleteExam(state,user,id){ if(!isMaster(user)) throw new Error('Chỉ quản trị cấp cao được xóa vĩnh viễn.'); const idx=state.exams.findIndex(x=>x.id===id); if(idx<0) throw new Error('Không tìm thấy bài thi.'); state.exams.splice(idx,1); audit(state,user,'delete_forever','exam',id); }

export function addSection(state,user,examId,input={}){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const sec={id:uid('sec'),name:input.name||'Phần mới',timeMinutes:Number(input.timeMinutes||30),maxScore:Number(input.maxScore||0),showTimer:input.showTimer!==false,autoSubmit:input.autoSubmit!==false,shuffle:Boolean(input.shuffle),questionIds:clone(input.questionIds||[])}; exam.sections.push(sec); exam.updatedAt=nowIso(); audit(state,user,'add_section','exam',examId,{sectionId:sec.id}); return sec; }
export function removeSection(state,user,examId,sectionId){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); if(exam.sections.length<=1) throw new Error('Bài thi phải còn ít nhất một phần.'); exam.sections=exam.sections.filter(s=>s.id!==sectionId); exam.updatedAt=nowIso(); audit(state,user,'remove_section','exam',examId,{sectionId}); }
export function moveSection(state,user,examId,sectionId,direction){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const i=exam.sections.findIndex(s=>s.id===sectionId); if(i<0) throw new Error('Không tìm thấy phần thi.'); const j=i+(direction==='up'?-1:1); if(j<0||j>=exam.sections.length) return exam.sections; [exam.sections[i],exam.sections[j]]=[exam.sections[j],exam.sections[i]]; exam.updatedAt=nowIso(); audit(state,user,'move_section','exam',examId,{sectionId,direction}); return exam.sections; }
export function updateSection(state,user,examId,sectionId,patch){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const sec=exam.sections.find(s=>s.id===sectionId); if(!sec) throw new Error('Không tìm thấy phần thi.'); const allowed=['name','timeMinutes','maxScore','showTimer','autoSubmit','shuffle','questionIds']; for(const k of allowed) if(k in patch) sec[k]=clone(patch[k]); exam.updatedAt=nowIso(); audit(state,user,'update_section','exam',examId,{sectionId}); return sec; }
export function addQuestionsToSection(state,user,examId,sectionId,questionIds){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const sec=exam.sections.find(s=>s.id===sectionId); if(!sec) throw new Error('Không tìm thấy phần thi.'); const valid=new Set(state.questions.filter(q=>q.status!=='trash').map(q=>q.id)); const merged=[...sec.questionIds]; for(const id of questionIds) if(valid.has(id)&&!merged.includes(id)) merged.push(id); sec.questionIds=merged; exam.updatedAt=nowIso(); audit(state,user,'add_questions','exam',examId,{sectionId,count:questionIds.length}); return sec; }
export function removeQuestionFromSection(state,user,examId,sectionId,questionId){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const sec=exam.sections.find(s=>s.id===sectionId); if(!sec) throw new Error('Không tìm thấy phần thi.'); sec.questionIds=sec.questionIds.filter(id=>id!==questionId); exam.updatedAt=nowIso(); audit(state,user,'remove_question','exam',examId,{sectionId,questionId}); }
export function moveQuestion(state,user,examId,sectionId,questionId,direction){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền chỉnh sửa bài thi này.'); const sec=exam.sections.find(s=>s.id===sectionId); const i=sec?.questionIds.indexOf(questionId)??-1; if(i<0) return; const j=i+(direction==='up'?-1:1); if(j<0||j>=sec.questionIds.length) return; [sec.questionIds[i],sec.questionIds[j]]=[sec.questionIds[j],sec.questionIds[i]]; exam.updatedAt=nowIso(); }

export function requestGrading(state,user,examId){ if(!isTeacher(user)||isMaster(user)) throw new Error('Chỉ giáo viên mới cần gửi yêu cầu xin chấm.'); const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(exam.ownerId===user.id) throw new Error('Bạn là người tạo bài thi nên đã có quyền chấm.'); let req=state.gradingRequests.find(r=>r.examId===examId&&r.requesterId===user.id&&r.status==='pending'); if(req) return req; req={id:uid('gr'),examId,examTitle:exam.title,ownerId:exam.ownerId,requesterId:user.id,requesterName:user.name,status:'pending',createdAt:nowIso(),updatedAt:nowIso()}; state.gradingRequests.push(req); audit(state,user,'request_grading','exam',examId); return req; }
export function resolveGradingRequest(state,user,requestId,status){ const req=byId(state.gradingRequests,requestId); if(!req) throw new Error('Không tìm thấy yêu cầu.'); const exam=byId(state.exams,req.examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!(isMaster(user)||exam.ownerId===user.id)) throw new Error('Chỉ giáo viên tạo bài hoặc quản trị cấp cao được duyệt.'); if(!['approved','rejected'].includes(status)) throw new Error('Trạng thái không hợp lệ.'); req.status=status; req.resolvedBy=user.id; req.updatedAt=nowIso(); audit(state,user,'resolve_grading','request',requestId,{status}); return req; }

function questionScore(q,answer){
  if(!q?.autoGrade) return 0;
  if(q.type==='single'||q.type==='truefalse'||q.type==='cloze') return Number(answer)===Number(q.correctAnswer)?Number(q.maxScore||0):0;
  if(q.type==='matching'){
    if(!Array.isArray(answer)||!Array.isArray(q.pairs)||!q.pairs.length) return 0;
    let correct=0; q.pairs.forEach((pair,i)=>{ if(answer[i]===pair[1]) correct++; });
    return Math.round((correct/q.pairs.length)*Number(q.maxScore||0)*100)/100;
  }
  return 0;
}

export function startAttempt(state,user,examId,{restart=false}={}){
  if(!isStudent(user)) throw new Error('Chỉ học viên mới được bắt đầu bài thi.');
  const exam=byId(state.exams,examId); if(!exam||exam.status!=='published') throw new Error('Bài thi chưa mở cho học viên.');
  const current=state.attempts.find(a=>a.examId===examId&&a.studentId===user.id&&a.status===ATTEMPT_STATUS.IN_PROGRESS);
  if(current&&!restart) return current;
  if(current&&restart){ current.status=ATTEMPT_STATUS.ABANDONED; current.abandonedAt=nowIso(); }
  const attemptNo=1+Math.max(0,...state.attempts.filter(a=>a.examId===examId&&a.studentId===user.id).map(a=>Number(a.attemptNo||0)));
  const a={ id:uid('att'), examId, examTitle:exam.title, examVersion:exam.version||1, studentId:user.id, studentName:user.name, studentEmail:user.email, attemptNo, status:ATTEMPT_STATUS.IN_PROGRESS, startedAt:nowIso(), updatedAt:nowIso(), currentSectionIndex:0, answers:{}, autoScore:0, manualScores:{}, sectionScores:{}, totalScore:null, result:null, reviewerId:null, reviewerName:null, feedback:'', publishedAt:null };
  state.attempts.push(a); audit(state,user,'start_attempt','attempt',a.id,{examId,restart}); return a;
}
export function saveAnswer(state,user,attemptId,questionId,answer){ const a=byId(state.attempts,attemptId); if(!a) throw new Error('Không tìm thấy lượt thi.'); if(a.studentId!==user.id||!isStudent(user)) throw new Error('Bạn không có quyền sửa lượt thi này.'); if(a.status!==ATTEMPT_STATUS.IN_PROGRESS) throw new Error('Lượt thi này đã được nộp.'); a.answers[questionId]=clone(answer); a.updatedAt=nowIso(); return a; }
export function setAttemptSection(state,user,attemptId,index){ const a=byId(state.attempts,attemptId); if(!a||a.studentId!==user.id) throw new Error('Không tìm thấy lượt thi.'); a.currentSectionIndex=Math.max(0,Number(index)||0); a.updatedAt=nowIso(); }

export function calculateAutomaticScores(state,attempt){
  const exam=byId(state.exams,attempt.examId); if(!exam) throw new Error('Không tìm thấy bài thi.');
  const sectionScores={}; let total=0;
  for(const sec of exam.sections){ let section=0; for(const qid of sec.questionIds){ const q=byId(state.questions,qid); if(q?.autoGrade) section+=questionScore(q,attempt.answers[qid]); } sectionScores[sec.name]=Math.round(section*100)/100; total+=section; }
  return {autoScore:Math.round(total*100)/100,sectionScores};
}
export function hasManualQuestions(state,exam){ return exam.sections.some(sec=>sec.questionIds.some(qid=>!byId(state.questions,qid)?.autoGrade)); }
export function submitAttempt(state,user,attemptId){ const a=byId(state.attempts,attemptId); if(!a) throw new Error('Không tìm thấy lượt thi.'); if(!isStudent(user)||a.studentId!==user.id) throw new Error('Bạn không có quyền nộp lượt thi này.'); if(a.status!==ATTEMPT_STATUS.IN_PROGRESS) return a; const exam=byId(state.exams,a.examId); const score=calculateAutomaticScores(state,a); a.autoScore=score.autoScore; a.sectionScores=score.sectionScores; a.status=hasManualQuestions(state,exam)?ATTEMPT_STATUS.GRADING:ATTEMPT_STATUS.READY; a.submittedAt=nowIso(); a.updatedAt=nowIso(); if(a.status===ATTEMPT_STATUS.READY){ a.totalScore=a.autoScore; a.result=a.totalScore>=exam.passScore?'Đạt':'Chưa đạt'; } audit(state,user,'submit_attempt','attempt',a.id); return a; }

export function saveManualScore(state,user,attemptId,payload){ const a=byId(state.attempts,attemptId); if(!a) throw new Error('Không tìm thấy lượt thi.'); const exam=byId(state.exams,a.examId); if(!canGradeExam(state,user,exam)) throw new Error('Bạn chưa có quyền chấm bài thi này.'); if(![ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(a.status)) throw new Error('Bài này không ở trạng thái chấm.'); a.manualScores={...a.manualScores,...clone(payload.scores||{})}; if(payload.rubrics) a.rubrics={...(a.rubrics||{}),...clone(payload.rubrics)}; if('feedback' in payload) a.feedback=payload.feedback; a.reviewerId=user.id; a.reviewerName=user.name; a.updatedAt=nowIso(); const manualExpected=exam.sections.flatMap(sec=>sec.questionIds.map(id=>byId(state.questions,id))).filter(q=>q&&!q.autoGrade).map(q=>q.skill); const complete=manualExpected.every(skill=>Number.isFinite(Number(a.manualScores[skill]))); if(complete){ a.totalScore=Number(a.autoScore||0)+Object.values(a.manualScores).reduce((sum,n)=>sum+(Number(n)||0),0); a.result=a.totalScore>=exam.passScore?'Đạt':'Chưa đạt'; a.status=ATTEMPT_STATUS.READY; } else a.status=ATTEMPT_STATUS.GRADING; audit(state,user,'save_grade','attempt',attemptId,{complete}); return a; }
export function publishAttempt(state,user,attemptId){ const a=byId(state.attempts,attemptId); if(!a) throw new Error('Không tìm thấy lượt thi.'); const exam=byId(state.exams,a.examId); if(!canGradeExam(state,user,exam)) throw new Error('Bạn không có quyền công bố kết quả bài thi này.'); if(a.status!==ATTEMPT_STATUS.READY) throw new Error('Bài thi chưa được chấm đủ để công bố.'); a.status=ATTEMPT_STATUS.PUBLISHED; a.publishedAt=nowIso(); a.updatedAt=nowIso(); const n={id:uid('notify'),type:'result_published',status:'queued',to:a.studentEmail,studentId:a.studentId,attemptId:a.id,subject:`G2G – Đã có kết quả ${a.examTitle}`,body:`Kết quả của bạn đã được công bố. Vui lòng đăng nhập hệ thống G2G để xem chi tiết.`,createdAt:nowIso()}; state.notifications.push(n); audit(state,user,'publish_result','attempt',attemptId,{notificationId:n.id}); return a; }

export function getStudentAttempts(state,studentId){ return state.attempts.filter(a=>a.studentId===studentId).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))); }
export function visibleStudentAttempt(a){ return a.status===ATTEMPT_STATUS.PUBLISHED ? a : {...a,totalScore:null,result:null,sectionScores:{},manualScores:{},feedback:''}; }
export function getStudentResults(state,studentId){ return getStudentAttempts(state,studentId).map(visibleStudentAttempt); }
export function getLatestPublishedAttempt(state,studentId){ return getStudentAttempts(state,studentId).find(a=>a.status===ATTEMPT_STATUS.PUBLISHED)||null; }
export function getBestPublishedAttempt(state,studentId){ return getStudentAttempts(state,studentId).filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED).sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0]||null; }
export function gradebookRows(state,mode='best'){
  const students=state.users.filter(u=>u.role==='student'&&u.active!==false); const rows=[];
  for(const u of students){ const attempts=getStudentAttempts(state,u.id); const published=attempts.filter(a=>a.status===ATTEMPT_STATUS.PUBLISHED); let chosen=null; if(mode==='latest') chosen=published[0]||null; else chosen=[...published].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0))[0]||null; rows.push({user:u,attempt:chosen,attempts}); }
  return rows;
}
export function pendingGradingAttempts(state,user){ return state.attempts.filter(a=>[ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(a.status)).filter(a=>canGradeExam(state,user,byId(state.exams,a.examId))); }
export function validateExamForPublish(state,exam){ const errors=[]; if(!exam.title?.trim()) errors.push('Bài thi chưa có tên.'); if(!exam.sections?.length) errors.push('Bài thi chưa có phần nào.'); for(const [i,sec] of (exam.sections||[]).entries()){ if(!sec.name?.trim()) errors.push(`Phần ${i+1} chưa có tên.`); if(!sec.questionIds?.length) errors.push(`Phần ${i+1} chưa có câu hỏi.`); for(const qid of sec.questionIds||[]) if(!byId(state.questions,qid)||byId(state.questions,qid).status==='trash') errors.push(`Phần ${i+1} chứa câu hỏi không còn hợp lệ.`); } return errors; }
export function publishExam(state,user,examId){ const exam=byId(state.exams,examId); if(!exam) throw new Error('Không tìm thấy bài thi.'); if(!canEditExam(user,exam)) throw new Error('Bạn không có quyền xuất bản bài thi này.'); const errors=validateExamForPublish(state,exam); if(errors.length) throw new Error(errors.join(' ')); exam.status='published'; exam.updatedAt=nowIso(); audit(state,user,'publish','exam',examId); return exam; }

export function summarizeExam(exam,state){ let questions=0,manual=0,max=0; for(const sec of exam.sections||[]){ questions+=sec.questionIds?.length||0; for(const id of sec.questionIds||[]){ const q=byId(state.questions,id); if(q){max+=Number(q.maxScore||0); if(!q.autoGrade) manual++;} } } return {questions,manual,maxScore:max,sections:exam.sections?.length||0}; }
