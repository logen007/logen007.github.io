import {withTx,appError,audit,now} from '../db.js';
import {isTeacher,examById,questionMap,canGrade} from './shared.js';
import {skillScores,examResult} from '../../../src/domain/gradebook.js';

export async function saveOralScore(user,{attemptId,score}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được nhập điểm Nói.');
  if(typeof score!=='number'||!Number.isFinite(score))throw appError(400,'Điểm Nói không hợp lệ.');
  return withTx(async client=>{
    const found=await client.query('SELECT * FROM attempts WHERE id=$1 FOR UPDATE',[attemptId]);
    const row=found.rows[0];
    if(!row||row.status!=='published')throw appError(409,'Hãy công bố điểm bài thi trước khi bổ sung điểm Nói.');
    const exam=await examById(row.exam_id,client),questions=await questionMap(exam);
    if(!(await canGrade(user,exam)))throw appError(403,'Bạn chưa được cấp quyền chấm bài này.');
    const attempt={...row.public_data,...row.private_data};
    const prior=skillScores(exam,questions,attempt);
    const max=prior.speaking?.max||(String(exam.provider).toUpperCase()==='TELC'?75:15);
    if(score<0||score>max)throw appError(400,`Điểm Nói phải từ 0 đến ${max}.`);
    const patch={oralScore:score,oralMax:max,oralReviewerId:user.id,oralReviewerName:user.name,updatedAt:now()};
    const skills=skillScores(exam,questions,{...attempt,...patch});
    patch.totalScore=Number(Object.values(skills).reduce((sum,item)=>sum+item.score,0).toFixed(2));
    patch.result=examResult(exam,skills);
    await client.query('UPDATE attempts SET public_data=public_data||$2::jsonb,private_data=private_data||$2::jsonb,updated_at=now() WHERE id=$1',[attemptId,JSON.stringify(patch)]);
    await audit(user,'save_oral_score','attempt',attemptId,{previous:prior.speaking?.score??null,score,max},client);
    return {ok:true};
  });
}
