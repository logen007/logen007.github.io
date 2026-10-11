import {withTx,appError,audit,uid,now} from '../db.js';
import {isTeacher} from './shared.js';
import {validateStudentProfile,validateStudentName} from '../../../src/domain/student-profile.js';
import {nameChangePatch} from '../../../src/domain/account-name.js';

export async function saveClass(user,{id,code,description,teacherIds}){
  if(!isTeacher(user))throw appError(403,'Chỉ giáo viên được quản lý lớp.');
  code=String(code||'').trim();
  if(!code||code.length>60)throw appError(400,'Mã lớp cần từ 1–60 ký tự.');
  if(description!==undefined&&(typeof description!=='string'||description.length>2000))throw appError(400,'Mô tả tối đa 2.000 ký tự.');
  if(teacherIds!==undefined&&(!Array.isArray(teacherIds)||teacherIds.some(value=>typeof value!=='string')||teacherIds.length>100))throw appError(400,'Danh sách giáo viên không hợp lệ.');
  return withTx(async client=>{
    let previous={};
    if(id){
      const found=await client.query('SELECT * FROM classes WHERE id=$1 FOR UPDATE',[id]);
      if(!found.rowCount)throw appError(404,'Không tìm thấy lớp.');
      previous=found.rows[0];
      if(previous.code.toLowerCase()==='extend'&&code!=='Extend')throw appError(400,'Không thể đổi mã lớp mặc định Extend.');
    }else id=uid('class');
    description=description===undefined?previous.description||'':description.trim();
    teacherIds=[...new Set(teacherIds===undefined?previous.teacher_ids||[]:teacherIds)];
    if(teacherIds.length){
      const teachers=await client.query("SELECT id FROM users WHERE id=ANY($1::text[]) AND role='teacher' AND active=true FOR SHARE",[teacherIds]);
      if(teachers.rowCount!==teacherIds.length)throw appError(400,'Vui lòng chọn giáo viên đang hoạt động.');
    }
    try{
      await client.query(`INSERT INTO classes(id,code,created_by,description,teacher_ids) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,description=EXCLUDED.description,teacher_ids=EXCLUDED.teacher_ids,updated_at=now()`,[id,code,user.id,description,teacherIds]);
    }catch(error){if(error.code==='23505')throw appError(409,'Mã lớp đã tồn tại.');throw error;}
    await audit(user,'save_class','class',id,{code},client);
    return {id,code,description,teacherIds};
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
    try{profile=validateStudentProfile({...payload,classId:own?null:payload.classId,level:row.data?.level||'A1'},classes);}
    catch(error){throw appError(400,error.message);}
    let namePatch={};
    try{if(row.data?.profileCompletedAt)namePatch=nameChangePatch(row.data,profile.name,{admin:user.role==='master'});}catch(error){throw appError(400,error.message);}
    const data={...row.data,...profile,...namePatch,profileCompletedAt:row.data?.profileCompletedAt||now()};
    await client.query('UPDATE users SET data=$2::jsonb,updated_at=now() WHERE id=$1',[studentId,JSON.stringify(data)]);
    await audit(user,'save_student_profile','user',studentId,{classId:profile.classId,level:profile.level},client);
    return {id:studentId,...profile};
  });
}

async function saveName(user,name,studentOnly=false){
  return withTx(async client=>{
    const row=(await client.query('SELECT role,active,data FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
    if(!row?.active)throw appError(403,'Tài khoản không hoạt động.');
    if(studentOnly&&(row.role!=='student'||!row.data.profileCompletedAt))throw appError(403,'Vui lòng hoàn tất hồ sơ trước.');
    let patch;
    try{patch=nameChangePatch(row.data||{},name,{admin:row.role==='master'});}
    catch(error){throw appError(400,error.message);}
    if(patch.name)await client.query('UPDATE users SET data=data||$2::jsonb,updated_at=now() WHERE id=$1',[user.id,JSON.stringify(patch)]);
    return {name:patch.name||row.data.name,...patch};
  });
}
export async function saveStudentName(user,{name}){
  if(user.role!=='student'||user.canTestRoles)throw appError(403,'Chỉ học viên được sửa tên của mình.');
  return saveName(user,name,true);
}
export async function saveAccountName(user,{name}){return saveName(user,name);}
