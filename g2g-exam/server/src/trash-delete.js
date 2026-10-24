import {appError} from './db.js';

// Caller owns the transaction. Delete only this exam's history, never shared media.
export async function deleteTrashedExam(client,id){
  const found=await client.query('SELECT status FROM exams WHERE id=$1 FOR UPDATE',[id]);
  if(!found.rowCount)return;
  if(found.rows[0].status!=='trash')throw appError(409,'Chỉ xóa vĩnh viễn đề trong Thùng rác.');
  const speaking=await client.query('SELECT 1 FROM speaking_exam_sessions WHERE exam_id=$1 UNION ALL SELECT 1 FROM speaking_exam_queue WHERE exam_id=$1 LIMIT 1',[id]);
  if(speaking.rowCount)throw appError(409,'Đề nói còn lịch sử thi hoặc thí sinh đang chờ. Giữ trong Thùng rác để bảo toàn bản ghi và kết quả.');
  await client.query('DELETE FROM notifications WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id=$1)',[id]);
  await client.query('DELETE FROM level_promotions WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id=$1)',[id]);
  await client.query('DELETE FROM exam_code_uses WHERE code_id IN (SELECT id FROM exam_codes WHERE exam_id=$1) OR attempt_id IN (SELECT id FROM attempts WHERE exam_id=$1)',[id]);
  await client.query('DELETE FROM attempts WHERE exam_id=$1',[id]);
  await client.query('DELETE FROM exams WHERE id=$1',[id]);
}
