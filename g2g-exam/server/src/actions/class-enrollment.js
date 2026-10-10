import crypto from 'node:crypto';
import {query,withTx,appError,audit} from '../db.js';

export async function externalClassId(client={query}){
  const row=(await client.query("SELECT id FROM classes WHERE lower(code)='extend' AND active=true")).rows[0];
  if(!row)throw appError(503,'Chưa khởi tạo lớp Extend.');
  return row.id;
}

// Codes remain server-side. Only staff state exposes them to teachers.
export async function ensureClassCodes(){
  const students=(await query(`SELECT u.id,u.email FROM users u JOIN classes c ON c.id=u.data->>'classId'
    LEFT JOIN class_confirmation_codes k ON k.student_id=u.id
    WHERE u.role='student' AND u.active=true AND lower(c.code)='extend'
    AND (k.student_id IS NULL OR k.email<>lower(u.email) OR k.used_at IS NOT NULL)`)).rows;
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(const student of students){
    for(let retry=0;retry<8;retry++){
      const code=Array.from({length:5},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
      try{
        await query(`INSERT INTO class_confirmation_codes(student_id,email,code) VALUES($1,lower($2),$3)
          ON CONFLICT(student_id) DO UPDATE SET email=EXCLUDED.email,code=EXCLUDED.code,used_at=NULL,created_at=now()
          WHERE class_confirmation_codes.email<>EXCLUDED.email OR class_confirmation_codes.used_at IS NOT NULL`,[student.id,student.email,code]);
        break;
      }catch(error){if(error.code!=='23505'||retry===7)throw error;}
    }
  }
}

async function checkRate(user){
  if(user.role!=='student'||user.canTestRoles)throw appError(403,'Chỉ tài khoản học viên được chọn lớp.');
  const result=await query(`INSERT INTO class_code_checks(student_id) VALUES($1) ON CONFLICT(student_id) DO UPDATE SET
    checks=CASE WHEN class_code_checks.window_at<now()-interval '5 minutes' THEN 1 ELSE class_code_checks.checks+1 END,
    window_at=CASE WHEN class_code_checks.window_at<now()-interval '5 minutes' THEN now() ELSE class_code_checks.window_at END RETURNING checks`,[user.id]);
  if(result.rows[0].checks>10)throw appError(429,'Bạn đã thử quá nhiều lần. Vui lòng chờ 5 phút.');
}

async function validateCode(client,user,code){
  const student=(await client.query('SELECT email,role,active,data FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
  if(!student||!student.active||student.role!=='student'||!student.data.profileCompletedAt)throw appError(403,'Vui lòng hoàn tất họ tên trước khi chọn lớp.');
  if(student.data.classId!==await externalClassId(client))throw appError(409,'Bạn đã được xếp lớp. Vui lòng liên hệ giáo viên để đổi lớp.');
  const normalized=String(code||'').trim().toUpperCase();
  const found=(await client.query('SELECT * FROM class_confirmation_codes WHERE student_id=$1 FOR UPDATE',[user.id])).rows[0];
  if(!/^[A-Z0-9]{5}$/.test(normalized)||!found||found.used_at||found.code!==normalized||found.email!==student.email.toLowerCase())
    throw appError(403,'Mã xác nhận không đúng với email của bạn hoặc đã được sử dụng.');
}

export async function verifyClassCode(user,{code}){
  await checkRate(user);
  return withTx(async client=>{
    await validateCode(client,user,code);
    return {classes:(await client.query("SELECT id,code,description FROM classes WHERE active=true AND lower(code)<>'extend' ORDER BY lower(code)")).rows};
  });
}

export async function enrollInClass(user,{code,classId}){
  await checkRate(user);
  return withTx(async client=>{
    await validateCode(client,user,code);
    const classroom=(await client.query("SELECT id,code FROM classes WHERE id=$1 AND active=true AND lower(code)<>'extend' FOR SHARE",[classId])).rows[0];
    if(!classroom)throw appError(400,'Vui lòng chọn một lớp đang hoạt động.');
    await client.query("UPDATE users SET data=data||jsonb_build_object('classId',$2::text),updated_at=now() WHERE id=$1",[user.id,classroom.id]);
    await client.query('UPDATE class_confirmation_codes SET used_at=now() WHERE student_id=$1',[user.id]);
    await audit(user,'enroll_in_class','class',classroom.id,{},client);
    return {classId:classroom.id,code:classroom.code};
  });
}
