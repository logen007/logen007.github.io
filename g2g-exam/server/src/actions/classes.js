import {withTx,appError,audit,uid,now} from '../db.js';
import {isTeacher} from './shared.js';
import {validateStudentProfile} from '../../../src/domain/student-profile.js';

export async function saveClass(user,{id,code}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được quản lý lớp.');
  code=String(code||'').trim();
  if(!code||code.length>60)throw appError(400,'Mã lớp cần từ 1–60 ký tự.');
  return withTx(async client=>{
    if(id){
      const found=await client.query('SELECT id FROM classes WHERE id=$1 FOR UPDATE',[id]);
      if(!found.rowCount)throw appError(404,'Không tìm thấy lớp.');
    }else id=uid('class');
    try{
      await client.query(`INSERT INTO classes(id,code,created_by) VALUES($1,$2,$3)
        ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,updated_at=now()`,[id,code,user.id]);
    }catch(error){if(error.code==='23505')throw appError(409,'Mã lớp đã tồn tại.');throw error;}
    await audit(user,'save_class','class',id,{code},client);
    return {id,code};
  });
}

export async function saveStudentProfile(user,payload){
  const own=user.role==='student';
  if(!own&&!isTeacher(user))throw appError(403,'Không có quyền sửa hồ sơ.');
  const studentId=own?user.id:payload.studentId;
  return withTx(async client=>{
    const found=await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[studentId]);
    const row=found.rows[0];
    if(!row||row.role!=='student')throw appError(404,'Không tìm thấy học viên.');
    if(own&&row.data?.profileCompletedAt)throw appError(403,'Vui lòng nhờ giáo viên cập nhật hồ sơ.');
    const classes=(await client.query('SELECT id,active FROM classes WHERE active=true FOR SHARE')).rows;
    let profile;
    try{profile=validateStudentProfile({...payload,level:own?(row.data?.level||'A1.1'):payload.level},classes);}
    catch(error){throw appError(400,error.message);}
    const data={...row.data,...profile,profileCompletedAt:row.data?.profileCompletedAt||now()};
    await client.query('UPDATE users SET data=$2::jsonb,updated_at=now() WHERE id=$1',[studentId,JSON.stringify(data)]);
    await audit(user,'save_student_profile','user',studentId,profile,client);
    return {id:studentId,...profile};
  });
}
