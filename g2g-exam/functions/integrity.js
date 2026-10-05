const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');

const db=getFirestore();

// Khi một đề được xuất bản, các câu đang dùng trong đề được khóa nội dung.
// Giáo viên vẫn có thể dùng lại câu, nhưng muốn thay đổi phải tạo câu/phiên bản mới.
// Điều này tránh một câu bị sửa sau khi học viên đã luyện hoặc đang làm bài.
exports.lockPublishedExamQuestions = onDocumentWritten('exams/{examId}', async event => {
  const after=event.data.after;
  if(!after.exists) return;
  const exam=after.data();
  if(exam.status!=='published') return;
  const qids=[...new Set((exam.sections||[]).flatMap(s=>s.questionIds||[]))];
  if(!qids.length) return;
  const batch=db.batch();
  for(const id of qids) batch.set(db.collection('questions').doc(id),{locked:true,lockedAt:new Date().toISOString()},{merge:true});
  await batch.commit();
});
