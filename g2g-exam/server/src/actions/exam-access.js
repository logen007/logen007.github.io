import crypto from 'node:crypto';
import {query,withTx,uid,appError,audit} from '../db.js';
import {examById,isTeacher} from './shared.js';
import {STUDENT_LEVELS} from '../../../src/domain/student-profile.js';

export const codeHash=code=>crypto.createHash('sha256').update(String(code||'').trim().toUpperCase()).digest('hex');
export async function expireCodes(client={query}){
  await client.query('UPDATE exam_codes SET code=NULL WHERE expires_at<=now() AND code IS NOT NULL');
}
function assertOwner(user,exam){
  if(!isTeacher(user)||(user.role!=='master'&&exam.ownerId!==user.id))throw appError(403,'Chỉ người tạo đề hoặc quản trị viên được cài đặt đề.');
}
export async function saveExamAccess(user,{examId,hidden,learningLevel}){
  if(typeof hidden!=='boolean'||(learningLevel&&!STUDENT_LEVELS.includes(learningLevel)))throw appError(400,'Cài đặt đề không hợp lệ.');
  return withTx(async client=>{
    await client.query('SELECT id FROM exams WHERE id=$1 FOR UPDATE',[examId]);
    const exam=await examById(examId,client);assertOwner(user,exam);
    await client.query('UPDATE exams SET data=data||$2::jsonb,updated_at=now() WHERE id=$1',[examId,JSON.stringify({hidden,learningLevel:learningLevel||null})]);
    await audit(user,'exam_access_settings','exam',examId,{hidden,learningLevel},client);
    return {ok:true};
  });
}
export async function listExamCodes(user,{examId}){
  const exam=await examById(examId);assertOwner(user,exam);await expireCodes();
  return (await query('SELECT id,code,expires_at AS "expiresAt" FROM exam_codes WHERE exam_id=$1 AND expires_at>now() ORDER BY created_at DESC',[examId])).rows;
}
export async function createExamCode(user,{examId,expiresAt}){
  const exam=await examById(examId);assertOwner(user,exam);
  const expiry=new Date(expiresAt);
  if(!Number.isFinite(expiry.getTime())||expiry.getTime()<=Date.now())throw appError(400,'Hạn dùng phải ở tương lai.');
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let retry=0;retry<8;retry++){
    const code=Array.from({length:5},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
    const id=uid('code');
    const inserted=await query('INSERT INTO exam_codes(id,exam_id,code,code_hash,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code_hash) DO NOTHING RETURNING id',[id,examId,code,codeHash(code),expiry.toISOString(),user.id]);
    if(inserted.rowCount){await audit(user,'create_exam_code','exam',examId,{codeId:id,expiresAt:expiry.toISOString()});return {id,code,expiresAt:expiry.toISOString()};}
  }
  throw appError(503,'Chưa tạo được mã, vui lòng thử lại.');
}
export async function checkCodeRate(user){
  const r=await query(`INSERT INTO exam_code_checks(student_id) VALUES($1) ON CONFLICT(student_id) DO UPDATE SET
    checks=CASE WHEN exam_code_checks.window_at<now()-interval '5 minutes' THEN 1 ELSE exam_code_checks.checks+1 END,
    window_at=CASE WHEN exam_code_checks.window_at<now()-interval '5 minutes' THEN now() ELSE exam_code_checks.window_at END RETURNING checks`,[user.id]);
  if(r.rows[0].checks>10)throw appError(429,'Bạn đã thử quá nhiều mã. Vui lòng chờ 5 phút.');
}
export async function acknowledgePromotion(user,{attemptId}){
  await query('UPDATE level_promotions SET acknowledged_at=now() WHERE attempt_id=$1 AND student_id=$2 AND acknowledged_at IS NULL',[attemptId,user.id]);
  return {ok:true};
}
