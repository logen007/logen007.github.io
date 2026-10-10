import {withTx,appError,audit,now,uid} from '../db.js';
import {isTeacher,attemptExam,questionMap,canGrade} from './shared.js';
import {skillScores,examResult,oralMaximum} from '../../../src/domain/gradebook.js';
import {finalizeOutcome} from '../result-outcome.js';
import {deliverResultEmail} from './grading.js';

export async function saveOralScore(user,{attemptId,score}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được nhập điểm Nói.');
  if(typeof score!=='number'||!Number.isFinite(score))throw appError(400,'Điểm Nói không hợp lệ.');
  const out=await withTx(async client=>{
    const found=await client.query('SELECT * FROM attempts WHERE id=$1 FOR UPDATE',[attemptId]);
    const row=found.rows[0];
    if(!row||!['grading','ready','published'].includes(row.status))throw appError(409,'Bài chưa ở trạng thái chấm điểm.');
    const exam=await attemptExam(row,client),questions=await questionMap(exam);
    if(!(await canGrade(user,exam)))throw appError(403,'Bạn chưa được cấp quyền chấm bài này.');
    const attempt={...row.public_data,...row.private_data};
    const prior=skillScores(exam,questions,attempt);
    if(attempt.oralScore===score)return {ok:true};
    const max=prior.speaking?.max||oralMaximum(exam);
    if(score<0||score>max)throw appError(400,`Điểm Nói phải từ 0 đến ${max}.`);
    const patch={oralScore:score,oralMax:max,oralReviewerId:user.id,oralReviewerName:user.name,updatedAt:now()};
    const skills=skillScores(exam,questions,{...attempt,...patch});
    patch.totalScore=Number(Object.values(skills).reduce((sum,item)=>sum+item.score,0).toFixed(2));
    patch.result=examResult(exam,skills);
    let notificationId;
    if(row.status==='published'){
      notificationId=`result-${attemptId}-${uid('oral')}`;
      const result=await finalizeOutcome(client,row,exam,{...attempt,...patch},user,{notificationId});
      Object.assign(patch,result.patch);
    }
    await client.query('UPDATE attempts SET private_data=private_data||$2::jsonb,public_data=public_data||$3::jsonb,updated_at=now() WHERE id=$1',[attemptId,JSON.stringify(patch),JSON.stringify(row.status==='published'?patch:{})]);
    await audit(user,'save_oral_score','attempt',attemptId,{previous:prior.speaking?.score??null,score,max},client);
    return {ok:true,notificationId};
  });
  if(out.notificationId)await deliverResultEmail(attemptId,out.notificationId);
  return out;
}
