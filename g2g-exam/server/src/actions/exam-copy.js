import {withTx,uid,now,appError,audit} from '../db.js';
import {isTeacher} from './shared.js';

export async function copyExam(user,{examId}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên hoặc quản trị được sao chép đề.');
  return withTx(async client=>{
    const row=(await client.query('SELECT * FROM exams WHERE id=$1 FOR SHARE',[examId])).rows[0];
    if(!row||row.status==='trash')throw appError(404,'Không tìm thấy đề thi.');
    const source=row.data,at=now(),id=uid('exam'),ids=[...new Set((source.sections||[]).flatMap(s=>s.questionIds||[]))];
    const questions=ids.length?(await client.query('SELECT * FROM questions WHERE id=ANY($1::text[]) FOR SHARE',[ids])).rows:[];
    if(questions.length!==ids.length)throw appError(409,'Đề gốc thiếu câu hỏi, chưa thể sao chép.');
    const mapping=new Map();
    for(const original of questions){
      const questionId=uid('q');
      mapping.set(original.id,questionId);
      const data={...original.data,ownerId:user.id,ownerName:user.name,locked:false,status:'active',usedCount:0,correctRate:null,createdAt:at,updatedAt:at};
      delete data.id;delete data.lockedAt;
      await client.query('INSERT INTO questions(id,owner_id,status,locked,data) VALUES($1,$2,$3,false,$4::jsonb)',[questionId,user.id,'active',JSON.stringify(data)]);
    }
    const titles=(await client.query('SELECT data->>\'title\' AS title FROM exams')).rows.map(r=>r.title);
    let number=1;while(titles.includes(`${source.title} - Copy ${number}`))number++;
    const data={...source,title:`${source.title} - Copy ${number}`,ownerId:user.id,ownerName:user.name,status:'draft',locked:false,copiedFrom:examId,createdAt:at,updatedAt:at,version:1,
      sections:(source.sections||[]).map(s=>({...s,id:uid('sec'),questionIds:(s.questionIds||[]).map(q=>mapping.get(q))}))};
    delete data.id;delete data.lockedAt;delete data.publishedAt;delete data.deletedAt;
    await client.query('INSERT INTO exams(id,owner_id,status,locked,data) VALUES($1,$2,$3,false,$4::jsonb)',[id,user.id,'draft',JSON.stringify(data)]);
    await audit(user,'duplicate','exam',id,{sourceId:examId,ownerId:user.id},client);
    return {id};
  });
}
