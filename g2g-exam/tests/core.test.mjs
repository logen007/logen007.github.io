import assert from 'node:assert/strict';
import { seedState } from '../src/seed.js';
import {
  clone, byId, canEditQuestion, canEditExam, canGradeExam, canSeeTrash, canPublishExamResult,
  updateQuestion, softDeleteQuestion, restoreQuestion, permanentlyDeleteQuestion,
  createExam, addSection, removeSection, moveSection, addQuestionsToSection,
  requestGrading, resolveGradingRequest, startAttempt, saveAnswer, setAttemptSection, getSectionRemainingSeconds,
  submitAttempt, saveManualScore, publishAttempt, getStudentResults, validateExamForPublish,
  ATTEMPT_STATUS
} from '../src/core.js';

let passed=0;
const test=(name,fn)=>{ try{ fn(); console.log(`✓ ${name}`); passed++; }catch(e){ console.error(`✗ ${name}`); throw e; } };
const fresh=()=>clone(seedState);
const users=s=>({student:byId(s.users,'student-a'),lan:byId(s.users,'teacher-lan'),mai:byId(s.users,'teacher-mai'),master:byId(s.users,'master-1')});

test('Chủ câu hỏi và master được sửa; giáo viên khác không được sửa',()=>{
  const s=fresh(),u=users(s),q=byId(s.questions,'q-read-1');
  assert.equal(canEditQuestion(u.lan,q),true); assert.equal(canEditQuestion(u.master,q),true); assert.equal(canEditQuestion(u.mai,q),false);
  assert.throws(()=>updateQuestion(s,u.mai,q.id,{title:'Sai quyền'}));
});

test('Xóa câu hỏi là soft delete và chỉ master khôi phục/xóa vĩnh viễn',()=>{
  const s=fresh(),u=users(s); softDeleteQuestion(s,u.lan,'q-read-1'); assert.equal(byId(s.questions,'q-read-1').status,'trash');
  assert.throws(()=>restoreQuestion(s,u.lan,'q-read-1')); restoreQuestion(s,u.master,'q-read-1'); assert.equal(byId(s.questions,'q-read-1').status,'active');
  softDeleteQuestion(s,u.lan,'q-read-1'); permanentlyDeleteQuestion(s,u.master,'q-read-1'); assert.equal(byId(s.questions,'q-read-1'),undefined);
});

test('Giáo viên khác xem được bài nhưng không chỉnh sửa bài của người khác',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01'); assert.equal(canEditExam(u.lan,exam),true); assert.equal(canEditExam(u.mai,exam),false);
});

test('Xin chấm phải được chủ bài duyệt trước',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01'); assert.equal(canGradeExam(s,u.mai,exam),false);
  const req=requestGrading(s,u.mai,exam.id); assert.equal(req.status,'pending'); assert.equal(canGradeExam(s,u.mai,exam),false);
  resolveGradingRequest(s,u.lan,req.id,'approved'); assert.equal(canGradeExam(s,u.mai,exam),true);
});

test('Giáo viên được duyệt có thể chấm nhưng không được tự công bố kết quả',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01');
  const req=requestGrading(s,u.mai,exam.id); resolveGradingRequest(s,u.lan,req.id,'approved');
  assert.equal(canGradeExam(s,u.mai,exam),true); assert.equal(canPublishExamResult(u.mai,exam),false); assert.equal(canPublishExamResult(u.lan,exam),true); assert.equal(canPublishExamResult(u.master,exam),true);
});

test('Master nhìn thấy thùng rác, giáo viên không',()=>{ const s=fresh(),u=users(s); assert.equal(canSeeTrash(u.master),true); assert.equal(canSeeTrash(u.lan),false); });

test('Học viên có thể thi nhiều lần; làm lại sẽ bỏ dở lượt cũ',()=>{
  const s=fresh(),u=users(s); const a1=startAttempt(s,u.student,'exam-b1-03'); assert.equal(a1.status,ATTEMPT_STATUS.IN_PROGRESS);
  const same=startAttempt(s,u.student,'exam-b1-03'); assert.equal(same.id,a1.id);
  const a2=startAttempt(s,u.student,'exam-b1-03',{restart:true}); assert.equal(a1.status,ATTEMPT_STATUS.ABANDONED); assert.notEqual(a2.id,a1.id); assert.equal(a2.attemptNo,a1.attemptNo+1);
});

test('Mỗi phần có đồng hồ riêng và tiếp tục thi không làm reset thời gian',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-03'); const a=startAttempt(s,u.student,exam.id);
  const first=exam.sections[0]; assert.ok(a.sectionStates[first.id]?.deadlineAt); const deadline=a.sectionStates[first.id].deadlineAt;
  startAttempt(s,u.student,exam.id); assert.equal(a.sectionStates[first.id].deadlineAt,deadline);
  setAttemptSection(s,u.student,a.id,1); const second=exam.sections[1]; assert.ok(a.sectionStates[second.id]?.deadlineAt); assert.ok(getSectionRemainingSeconds(a,exam,1)>0);
});

test('Nộp bài có phần Viết/Nói chuyển sang chờ chấm và chưa lộ kết quả',()=>{
  const s=fresh(),u=users(s); const a=startAttempt(s,u.student,'exam-b1-03'); saveAnswer(s,u.student,a.id,'q-read-1',1); submitAttempt(s,u.student,a.id);
  assert.equal(a.status,ATTEMPT_STATUS.GRADING); assert.equal(a.totalScore,null); const visible=getStudentResults(s,u.student.id).find(x=>x.id===a.id); assert.equal(visible.totalScore,null); assert.deepEqual(visible.sectionScores,{});
});

test('Chấm đủ Viết/Nói -> sẵn sàng; chủ bài công bố -> có điểm và notification email',()=>{
  const s=fresh(),u=users(s); const a=startAttempt(s,u.student,'exam-b1-03'); submitAttempt(s,u.student,a.id);
  saveManualScore(s,u.lan,a.id,{scores:{'Viết':35,'Nói':60},feedback:'Ổn'}); assert.equal(a.status,ATTEMPT_STATUS.READY); assert.equal(typeof a.totalScore,'number');
  publishAttempt(s,u.lan,a.id); assert.equal(a.status,ATTEMPT_STATUS.PUBLISHED); assert.equal(s.notifications.at(-1).type,'result_published'); assert.equal(s.notifications.at(-1).to,u.student.email);
});

test('Giáo viên được duyệt chấm không thể công bố kết quả thay chủ bài',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01'); const req=requestGrading(s,u.mai,exam.id); resolveGradingRequest(s,u.lan,req.id,'approved');
  const a=startAttempt(s,u.student,exam.id); submitAttempt(s,u.student,a.id); saveManualScore(s,u.mai,a.id,{scores:{'Viết':35,'Nói':60}}); assert.equal(a.status,ATTEMPT_STATUS.READY); assert.throws(()=>publishAttempt(s,u.mai,a.id)); publishAttempt(s,u.lan,a.id); assert.equal(a.status,ATTEMPT_STATUS.PUBLISHED);
});

test('Bài thi cho phép thêm/bớt/sắp xếp phần',()=>{
  const s=fresh(),u=users(s); const ex=createExam(s,u.lan,{title:'Test',sections:[{id:'a',name:'A',questionIds:[]},{id:'b',name:'B',questionIds:[]} ]});
  addSection(s,u.lan,ex.id,{name:'C'}); assert.equal(ex.sections.length,3); const c=ex.sections[2]; moveSection(s,u.lan,ex.id,c.id,'up'); assert.equal(ex.sections[1].id,c.id); removeSection(s,u.lan,ex.id,c.id); assert.equal(ex.sections.length,2);
});

test('Thêm hàng loạt câu từ ngân hàng không tạo trùng lặp',()=>{
  const s=fresh(),u=users(s); const ex=createExam(s,u.lan,{title:'Test',sections:[{id:'s1',name:'Phần 1',questionIds:[]} ]});
  addQuestionsToSection(s,u.lan,ex.id,'s1',['q-read-1','q-read-2','q-read-1']); assert.deepEqual(ex.sections[0].questionIds,['q-read-1','q-read-2']);
});

test('Không xuất bản được bài trống',()=>{
  const s=fresh(),u=users(s); const ex=createExam(s,u.lan,{title:'Trống',sections:[{id:'s1',name:'Đọc hiểu',questionIds:[]} ]}); const errors=validateExamForPublish(s,ex); assert.ok(errors.length>0);
});

console.log(`\n${passed} kiểm thử đã đạt.`);
