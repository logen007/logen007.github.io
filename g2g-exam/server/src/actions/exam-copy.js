import {withTx,uid,now,appError,audit} from '../db.js';
import {isTeacher} from './shared.js';
import {createMediaCopier} from '../copy-media.js';
import {preserveAttemptSnapshots} from '../exam-snapshots.js';

export async function copyExam(user,{examId}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên hoặc quản trị được sao chép đề.');
  return withTx(async client=>{
    const row=(await client.query('SELECT * FROM exams WHERE id=$1 FOR SHARE',[examId])).rows[0];
    if(!row||row.status==='trash')throw appError(404,'Không tìm thấy đề thi.');
    const source=row.data,at=now(),id=uid('exam'),ids=[...new Set((source.sections||[]).flatMap(s=>s.questionIds||[]))];
    const questions=ids.length?(await client.query('SELECT * FROM questions WHERE id=ANY($1::text[]) FOR SHARE',[ids])).rows:[];
    if(questions.length!==ids.length)throw appError(409,'Đề gốc thiếu câu hỏi, chưa thể sao chép.');
    const mapping=new Map(),copyMedia=createMediaCopier();
    for(const original of questions){
      const questionId=uid('q');
      mapping.set(original.id,questionId);
      const data={...await copyMedia(original.data),ownerId:user.id,ownerName:user.name,locked:false,status:'active',usedCount:0,correctRate:null,createdAt:at,updatedAt:at};
      delete data.id;delete data.lockedAt;
      await client.query('INSERT INTO questions(id,owner_id,status,locked,data) VALUES($1,$2,$3,false,$4::jsonb)',[questionId,user.id,'active',JSON.stringify(data)]);
    }
    const titles=(await client.query('SELECT data->>\'title\' AS title FROM exams')).rows.map(r=>r.title);
    let number=1;while(titles.includes(`${source.title} - Copy ${number}`))number++;
    const data={...await copyMedia(source),title:`${source.title} - Copy ${number}`,ownerId:user.id,ownerName:user.name,status:'draft',locked:false,copiedFrom:examId,independentCopyVersion:1,createdAt:at,updatedAt:at,version:1,
      sections:await Promise.all((source.sections||[]).map(async s=>({...await copyMedia(s),id:uid('sec'),questionIds:(s.questionIds||[]).map(q=>mapping.get(q))})))};
    delete data.id;delete data.lockedAt;delete data.publishedAt;delete data.deletedAt;
    await client.query('INSERT INTO exams(id,owner_id,status,locked,data) VALUES($1,$2,$3,false,$4::jsonb)',[id,user.id,'draft',JSON.stringify(data)]);
    await audit(user,'duplicate','exam',id,{sourceId:examId,ownerId:user.id},client);
    return {id};
  });
}

export async function prepareExamForEditing(user,{examId}){
  if(!isTeacher(user))throw appError(403,'Không có quyền sửa đề.');
  return withTx(async client=>{
    const row=(await client.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE',[examId])).rows[0];
    if(!row||row.status==='trash')throw appError(404,'Không tìm thấy đề.');
    if(user.role!=='master'&&row.owner_id!==user.id)throw appError(403,'Không có quyền sửa đề.');
    const ids=[...new Set((row.data.sections||[]).flatMap(s=>s.questionIds||[]))];
    const questions=ids.length?(await client.query('SELECT * FROM questions WHERE id=ANY($1::text[]) FOR SHARE',[ids])).rows:[];
    if(questions.length!==ids.length)throw appError(409,'Đề thiếu câu hỏi, chưa thể tách bản độc lập.');
    const mismatch=questions.some(q=>q.owner_id!==row.owner_id);
    if(!mismatch&&(!row.data.copiedFrom||row.data.independentCopyVersion===1))return {changed:false};
    await preserveAttemptSnapshots(client,[{collection:'exams',id:examId}]);
    const owner=(await client.query('SELECT data FROM users WHERE id=$1',[row.owner_id])).rows[0];
    const copyMedia=createMediaCopier(),mapping=new Map(),at=now();
    for(const question of questions){
      const id=uid('q'),data={...await copyMedia(question.data),ownerId:row.owner_id,ownerName:owner?.data?.name||row.data.ownerName||'',status:'active',locked:false,usedCount:0,correctRate:null,createdAt:at,updatedAt:at};
      delete data.id;delete data.lockedAt;
      await client.query('INSERT INTO questions(id,owner_id,status,locked,data) VALUES($1,$2,$3,false,$4::jsonb)',[id,row.owner_id,'active',JSON.stringify(data)]);
      mapping.set(question.id,id);
    }
    const data=await copyMedia(row.data);
    data.sections=(data.sections||[]).map(s=>({...s,questionIds:(s.questionIds||[]).map(id=>mapping.get(id))}));
    data.independentCopyVersion=1;data.updatedAt=at;
    await client.query('UPDATE exams SET data=$2::jsonb,updated_at=now() WHERE id=$1',[examId,JSON.stringify(data)]);
    await audit(user,'isolate_exam_copy','exam',examId,{questions:ids.length,previousData:row.data,questionMapping:Object.fromEntries(mapping)},client);
    return {changed:true};
  });
}
