import assert from 'node:assert/strict';
import { seedState } from '../src/seed.js';
import {
  clone, byId, canEditQuestion, canEditExam, canGradeExam, canSeeTrash, canPublishExamResult, getQuestionMaxScore,
  createQuestion, updateQuestion, softDeleteQuestion, restoreQuestion, permanentlyDeleteQuestion,
  createExam, duplicateExam, addSection, removeSection, moveSection, addQuestionsToSection, removeQuestionFromSection,
  startAttempt, saveAnswer, setAttemptSection, getSectionRemainingSeconds,
  submitAttempt, saveManualScore, publishAttempt, getStudentResults, validateExamForPublish, publishExam,
  ATTEMPT_STATUS
} from '../src/core.js';

let passed=0;
const test=(name,fn)=>{try{fn();console.log(`✓ ${name}`);passed++;}catch(e){console.error(`✗ ${name}`);throw e;}};
const fresh=()=>clone(seedState);
const users=s=>({student:byId(s.users,'student-a'),lan:byId(s.users,'teacher-lan'),mai:byId(s.users,'teacher-mai'),master:byId(s.users,'master-1')});

test('Điểm câu hỏi dùng giá trị mặc định khi dữ liệu cũ chưa có maxScore',()=>{
  assert.equal(getQuestionMaxScore({maxScore:2},1),2);
  assert.equal(getQuestionMaxScore({maxScore:0},1),0);
  assert.equal(getQuestionMaxScore({},1),1);
});

test('Chủ câu hỏi và master được sửa; giáo viên khác không được sửa',()=>{
  const s=fresh(),u=users(s),q=byId(s.questions,'q-read-1');
  assert.equal(canEditQuestion(u.lan,q),true);assert.equal(canEditQuestion(u.master,q),true);assert.equal(canEditQuestion(u.mai,q),false);
  assert.throws(()=>updateQuestion(s,u.mai,q.id,{title:'Sai quyền'}));
});

test('Đáp án tùy chọn để trống vẫn được lưu khi câu còn ít nhất hai lựa chọn',()=>{
  const s=fresh(),u=users(s);
  const q=createQuestion(s,u.lan,{title:'Câu ba lựa chọn',type:'single',choices:['A','B','C'],correctAnswer:0,maxScore:1});
  const ex=createExam(s,u.lan,{title:'Đề đang soạn',sections:[{id:'draft',name:'Đọc 2',questionIds:[q.id]}]});
  updateQuestion(s,u.lan,q.id,{choices:[{text:'50 €'},{text:''},{text:''}]});
  assert.equal(byId(s.questions,q.id).choices[0].text,'50 €');
  assert.ok(validateExamForPublish(s,ex).some(error=>error.includes('ít nhất 2 lựa chọn')));
  updateQuestion(s,u.lan,q.id,{choices:[{text:'50 €'},{text:'65 €'},{text:''}]});
  assert.equal(byId(s.questions,q.id).choices[2].text,'');
  assert.equal(validateExamForPublish(s,ex).some(error=>error.includes('lựa chọn')),false);
  updateQuestion(s,u.lan,q.id,{correctAnswer:2});
  assert.ok(validateExamForPublish(s,ex).some(error=>error.includes('Đáp án đúng không hợp lệ')));
});

test('Câu hỏi chưa dùng có thể soft delete; chỉ master khôi phục/xóa vĩnh viễn',()=>{
  const s=fresh(),u=users(s);
  const q=createQuestion(s,u.lan,{title:'Câu tạm',type:'single',choices:['A','B'],correctAnswer:0,maxScore:1});
  softDeleteQuestion(s,u.lan,q.id);assert.equal(byId(s.questions,q.id).status,'trash');
  assert.throws(()=>restoreQuestion(s,u.lan,q.id));restoreQuestion(s,u.master,q.id);assert.equal(byId(s.questions,q.id).status,'active');
  softDeleteQuestion(s,u.lan,q.id);permanentlyDeleteQuestion(s,u.master,q.id);assert.equal(byId(s.questions,q.id),undefined);
});

test('Không xóa vĩnh viễn câu hỏi còn được tham chiếu trong bài thi',()=>{
  const s=fresh(),u=users(s);assert.throws(()=>permanentlyDeleteQuestion(s,u.master,'q-read-1'));
});

test('Giáo viên khác xem được bài nhưng không chỉnh sửa bài của người khác',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01');assert.equal(canEditExam(u.lan,exam),true);assert.equal(canEditExam(u.mai,exam),false);
});

test('Giáo viên nhân bản đề của người khác thành bản nháp do mình sở hữu',()=>{
  const s=fresh(),u=users(s),source=byId(s.exams,'exam-b1-01');
  const copy=duplicateExam(s,u.mai,source.id);
  assert.equal(copy.title,`${source.title} - Copy 1`);
  assert.equal(copy.ownerId,u.mai.id);
  assert.equal(copy.status,'draft');
  assert.notEqual(copy.sections[0].questionIds[0],source.sections[0].questionIds[0]);
  assert.equal(duplicateExam(s,u.mai,source.id).title,`${source.title} - Copy 2`);
});

test('Giáo viên có thể chấm bài mà không cần xin quyền',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01');assert.equal(canGradeExam(s,u.mai,exam),true);
});

test('Giáo viên có thể công bố bài đã chấm',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01');
  assert.equal(canGradeExam(s,u.mai,exam),true);assert.equal(canPublishExamResult(u.mai,exam),true);assert.equal(canPublishExamResult(u.lan,exam),true);assert.equal(canPublishExamResult(u.master,exam),true);
});

test('Master nhìn thấy thùng rác, giáo viên không',()=>{const s=fresh(),u=users(s);assert.equal(canSeeTrash(u.master),true);assert.equal(canSeeTrash(u.lan),false);});

test('Học viên có thể thi nhiều lần; làm lại sẽ bỏ dở lượt cũ',()=>{
  const s=fresh(),u=users(s);const a1=startAttempt(s,u.student,'exam-b1-03');assert.equal(a1.status,ATTEMPT_STATUS.IN_PROGRESS);
  const same=startAttempt(s,u.student,'exam-b1-03');assert.equal(same.id,a1.id);
  const a2=startAttempt(s,u.student,'exam-b1-03',{restart:true});assert.equal(a1.status,ATTEMPT_STATUS.ABANDONED);assert.notEqual(a2.id,a1.id);assert.equal(a2.attemptNo,a1.attemptNo+1);
});

test('Mỗi phần có đồng hồ riêng và tiếp tục thi không reset thời gian',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-03');const a=startAttempt(s,u.student,exam.id);
  const first=exam.sections[0];assert.ok(a.sectionStates[first.id]?.deadlineAt);const deadline=a.sectionStates[first.id].deadlineAt;
  startAttempt(s,u.student,exam.id);assert.equal(a.sectionStates[first.id].deadlineAt,deadline);
  setAttemptSection(s,u.student,a.id,1);const second=exam.sections[1];assert.ok(a.sectionStates[second.id]?.deadlineAt);assert.ok(getSectionRemainingSeconds(a,exam,1)>0);
});

test('Nộp bài có phần Viết/Nói chuyển sang chờ chấm và học viên chưa thấy điểm',()=>{
  const s=fresh(),u=users(s);const a=startAttempt(s,u.student,'exam-b1-03');saveAnswer(s,u.student,a.id,'q-read-1',1);submitAttempt(s,u.student,a.id);
  assert.equal(a.status,ATTEMPT_STATUS.GRADING);assert.equal(a.totalScore,null);
  const visible=getStudentResults(s,u.student.id).find(x=>x.id===a.id);assert.equal(visible.totalScore,null);assert.equal(visible.autoScore,null);assert.deepEqual(visible.sectionScores,{});
});

test('Điểm chấm tay bị chặn nếu vượt điểm tối đa',()=>{
  const s=fresh(),u=users(s);const a=startAttempt(s,u.student,'exam-b1-03');submitAttempt(s,u.student,a.id);
  assert.throws(()=>saveManualScore(s,u.lan,a.id,{scores:{'Viết':999,'Nói':60}}));
});

test('Chấm đủ Viết/Nói -> sẵn sàng; chủ bài công bố -> có điểm và notification email',()=>{
  const s=fresh(),u=users(s);const a=startAttempt(s,u.student,'exam-b1-03');submitAttempt(s,u.student,a.id);
  saveManualScore(s,u.lan,a.id,{scores:{'Viết':35,'Nói':60},feedback:'Ổn'});assert.equal(a.status,ATTEMPT_STATUS.READY);assert.equal(typeof a.totalScore,'number');
  publishAttempt(s,u.lan,a.id);assert.equal(a.status,ATTEMPT_STATUS.PUBLISHED);assert.equal(s.notifications.at(-1).type,'result_published');assert.equal(s.notifications.at(-1).to,u.student.email);
});

test('Người công bố được ghi là người chấm',()=>{
  const s=fresh(),u=users(s),exam=byId(s.exams,'exam-b1-01');
  const a=startAttempt(s,u.student,exam.id);submitAttempt(s,u.student,a.id);saveManualScore(s,u.mai,a.id,{scores:{'Viết':35,'Nói':60}});assert.equal(a.status,ATTEMPT_STATUS.READY);publishAttempt(s,u.mai,a.id);assert.equal(a.status,ATTEMPT_STATUS.PUBLISHED);assert.equal(a.reviewerId,u.mai.id);
});

test('Bài thi cho phép thêm/bớt/sắp xếp phần trước khi có lượt thi',()=>{
  const s=fresh(),u=users(s);const ex=createExam(s,u.lan,{title:'Test',sections:[{id:'a',name:'A',questionIds:[]},{id:'b',name:'B',questionIds:[]}]});
  addSection(s,u.lan,ex.id,{name:'C'});assert.equal(ex.sections.length,3);const c=ex.sections[2];moveSection(s,u.lan,ex.id,c.id,'up');assert.equal(ex.sections[1].id,c.id);removeSection(s,u.lan,ex.id,c.id);assert.equal(ex.sections.length,2);
});

test('Thêm hàng loạt câu từ ngân hàng không tạo trùng lặp',()=>{
  const s=fresh(),u=users(s);const ex=createExam(s,u.lan,{title:'Test',sections:[{id:'s1',name:'Phần 1',questionIds:[]}]});
  addQuestionsToSection(s,u.lan,ex.id,'s1',['q-read-1','q-read-2','q-read-1']);assert.deepEqual(ex.sections[0].questionIds,['q-read-1','q-read-2']);
});

test('Xuất bản bài sẽ khóa câu hỏi đã dùng',()=>{
  const s=fresh(),u=users(s);const ex=createExam(s,u.lan,{title:'Đề khóa',sections:[{id:'s1',name:'Đọc',timeMinutes:10,questionIds:['q-read-1']}]});
  publishExam(s,u.lan,ex.id);assert.equal(byId(s.questions,'q-read-1').locked,true);assert.equal(canEditQuestion(u.lan,byId(s.questions,'q-read-1')),false);assert.equal(canEditQuestion(u.master,byId(s.questions,'q-read-1')),true);
});

test('Sau khi học viên bắt đầu, giáo viên không được đổi cấu trúc bài',()=>{
  const s=fresh(),u=users(s);const ex=createExam(s,u.lan,{title:'Đề đang thi',sections:[{id:'s1',name:'Đọc',timeMinutes:10,questionIds:['q-read-1']}]});
  publishExam(s,u.lan,ex.id);startAttempt(s,u.student,ex.id);assert.throws(()=>addSection(s,u.lan,ex.id,{name:'Phần mới'}));assert.throws(()=>removeQuestionFromSection(s,u.lan,ex.id,'s1','q-read-1'));
});

test('Không xuất bản được bài trống hoặc bài lặp cùng câu ở nhiều phần',()=>{
  const s=fresh(),u=users(s);const empty=createExam(s,u.lan,{title:'Trống',sections:[{id:'s1',name:'Đọc hiểu',questionIds:[]}]});assert.ok(validateExamForPublish(s,empty).length>0);
  const dup=createExam(s,u.lan,{title:'Trùng',sections:[{id:'a',name:'A',questionIds:['q-read-1']},{id:'b',name:'B',questionIds:['q-read-1']}]});assert.ok(validateExamForPublish(s,dup).some(x=>x.includes('lặp')));
});

console.log(`\n${passed} kiểm thử đã đạt.`);
