import {appError,query} from '../db.js';
import {buildAttemptReview} from '../../../src/domain/attempt-review.js';

// Authorize before loading snapshots or answer keys. Row status is authoritative.
export async function getAttemptReview(user,{attemptId},{runQuery=query}={}){
  const found=await runQuery(`SELECT public_data,private_data,status,student_id,exam_id FROM attempts WHERE id=$1`,[attemptId]);
  if(!found.rowCount||found.rows[0].student_id!==user.id)throw appError(404,'Không tìm thấy bài làm.');
  const row=found.rows[0];
  const exam=await runQuery(`SELECT data FROM exams WHERE id=$1`,[row.exam_id]);
  const examData=row.private_data?.examSnapshot||exam.rows[0]?.data||{};
  const ids=[...new Set((examData.sections||[]).flatMap(section=>section.questionIds||[]))];
  const questions=examData.questionSnapshot?{rows:examData.questionSnapshot.map(q=>({id:q.id,data:q}))}:ids.length?await runQuery(`SELECT id,data FROM questions WHERE id=ANY($1::text[])`,[ids]):{rows:[]};
  if(row.status==='published'&&row.public_data.reviewerId){
    const reviewer=(await runQuery("SELECT data->>'name' AS name FROM users WHERE id=$1",[row.public_data.reviewerId])).rows[0];
    if(reviewer?.name)row.public_data.reviewerName=reviewer.name;
  }
  row.public_data.studentName=user.name||row.public_data.studentName;
  return buildAttemptReview({exam:examData,questions:questions.rows.map(q=>({...q.data,id:q.id})),attempt:{...row.public_data,id:attemptId,status:row.status},privateData:row.private_data,student:user});
}
