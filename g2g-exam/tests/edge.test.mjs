import assert from 'node:assert/strict';
import { seedState } from '../src/seed.js';
import {
  clone, byId, createQuestion, createExam, addSection, removeSection,
  addQuestionsToSection, requestGrading, resolveGradingRequest,
  startAttempt, saveAnswer, submitAttempt, saveManualScore, publishAttempt,
  permanentlyDeleteExam, permanentlyDeleteQuestion, validateExamForPublish,
  ATTEMPT_STATUS
} from '../src/core.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (error) { console.error(`✗ ${name}`); throw error; }
};
const fresh = () => clone(seedState);
const users = s => ({
  student: byId(s.users, 'student-a'),
  lan: byId(s.users, 'teacher-lan'),
  mai: byId(s.users, 'teacher-mai'),
  master: byId(s.users, 'master-1'),
});

test('Giáo viên không thể bắt đầu lượt thi thay học viên', () => {
  const s = fresh(), u = users(s);
  assert.throws(() => startAttempt(s, u.lan, 'exam-b1-03'));
});

test('Học viên không thể sửa câu trả lời sau khi đã nộp', () => {
  const s = fresh(), u = users(s);
  const a = startAttempt(s, u.student, 'exam-b1-03');
  saveAnswer(s, u.student, a.id, 'q-read-1', 1);
  submitAttempt(s, u.student, a.id);
  assert.throws(() => saveAnswer(s, u.student, a.id, 'q-read-1', 0));
});

test('Điểm chấm tay vượt điểm tối đa bị từ chối', () => {
  const s = fresh(), u = users(s);
  const a = startAttempt(s, u.student, 'exam-b1-03');
  submitAttempt(s, u.student, a.id);
  assert.equal(a.status, ATTEMPT_STATUS.GRADING);
  assert.throws(() => saveManualScore(s, u.lan, a.id, { scores: { 'Viết': 999 } }));
});

test('Không thể công bố khi phần chấm tay chưa hoàn tất', () => {
  const s = fresh(), u = users(s);
  const a = startAttempt(s, u.student, 'exam-b1-03');
  submitAttempt(s, u.student, a.id);
  saveManualScore(s, u.lan, a.id, { scores: { 'Viết': 30 } });
  assert.equal(a.status, ATTEMPT_STATUS.GRADING);
  assert.throws(() => publishAttempt(s, u.lan, a.id));
});

test('Xóa vĩnh viễn bài thi có lịch sử làm bài bị chặn', () => {
  const s = fresh(), u = users(s);
  assert.throws(() => permanentlyDeleteExam(s, u.master, 'exam-b1-01'));
});

test('Xóa vĩnh viễn câu hỏi còn được tham chiếu trong đề bị chặn', () => {
  const s = fresh(), u = users(s);
  assert.throws(() => permanentlyDeleteQuestion(s, u.master, 'q-read-1'));
});

test('Không thể xóa phần cuối cùng của bài thi', () => {
  const s = fresh(), u = users(s);
  const ex = createExam(s, u.lan, { title: 'Một phần', sections: [{ id: 'only', name: 'Đọc', questionIds: [] }] });
  assert.throws(() => removeSection(s, u.lan, ex.id, 'only'));
});

test('Yêu cầu xin chấm đang chờ không bị tạo trùng', () => {
  const s = fresh(), u = users(s);
  const r1 = requestGrading(s, u.mai, 'exam-b1-01');
  const r2 = requestGrading(s, u.mai, 'exam-b1-01');
  assert.equal(r1.id, r2.id);
  assert.equal(s.gradingRequests.filter(r => r.status === 'pending').length, 1);
});

test('Giáo viên không sở hữu đề không thể duyệt yêu cầu xin chấm', () => {
  const s = fresh(), u = users(s);
  const req = requestGrading(s, u.mai, 'exam-b1-01');
  const huong = byId(s.users, 'teacher-huong');
  assert.throws(() => resolveGradingRequest(s, huong, req.id, 'approved'));
});

test('Câu tự chấm phải có đáp án hợp lệ', () => {
  const s = fresh(), u = users(s);
  assert.throws(() => createQuestion(s, u.lan, {
    title: 'Câu lỗi', type: 'single', choices: ['A', 'B'], correctAnswer: 5, maxScore: 1,
  }));
});

test('Đề có cùng một câu lặp ở nhiều phần không được xuất bản', () => {
  const s = fresh(), u = users(s);
  const ex = createExam(s, u.lan, {
    title: 'Đề lặp',
    sections: [
      { id: 's1', name: 'Phần 1', timeMinutes: 10, questionIds: ['q-read-1'] },
      { id: 's2', name: 'Phần 2', timeMinutes: 10, questionIds: ['q-read-1'] },
    ],
  });
  const errors = validateExamForPublish(s, ex);
  assert.ok(errors.some(x => x.includes('bị lặp')));
});

test('Thêm câu hàng loạt bỏ qua mã câu không tồn tại', () => {
  const s = fresh(), u = users(s);
  const ex = createExam(s, u.lan, { title: 'Đề test', sections: [{ id: 's1', name: 'Phần 1', questionIds: [] }] });
  addQuestionsToSection(s, u.lan, ex.id, 's1', ['q-read-1', 'khong-ton-tai']);
  assert.deepEqual(ex.sections[0].questionIds, ['q-read-1']);
});

test('Bài chỉ có câu tự chấm chuyển sang sẵn sàng công bố', () => {
  const s = fresh(), u = users(s);
  const ex = createExam(s, u.lan, {
    title: 'Tự chấm',
    passScore: 1,
    sections: [{ id: 's1', name: 'Đọc', timeMinutes: 10, questionIds: ['q-read-1'] }],
  });
  ex.status = 'published';
  const a = startAttempt(s, u.student, ex.id);
  saveAnswer(s, u.student, a.id, 'q-read-1', 1);
  submitAttempt(s, u.student, a.id);
  assert.equal(a.status, ATTEMPT_STATUS.READY);
  assert.equal(a.totalScore, 5);
  publishAttempt(s, u.lan, a.id);
  assert.equal(a.status, ATTEMPT_STATUS.PUBLISHED);
});

console.log(`\n${passed} kiểm thử biên đã đạt.`);
