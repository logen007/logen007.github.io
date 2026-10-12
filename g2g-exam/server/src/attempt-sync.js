import {query,appError} from './db.js';

// Poll only the authenticated owner's current attempt, never the question bank.
export async function loadAttemptSync(user,id){
  const result=await query('SELECT id,public_data FROM attempts WHERE id=$1 AND student_id=$2',[id,user.id]);
  if(!result.rows.length)throw appError(404,'Bài làm không tồn tại.');
  const row=result.rows[0];
  return {attempt:{...row.public_data,id:row.id}};
}
