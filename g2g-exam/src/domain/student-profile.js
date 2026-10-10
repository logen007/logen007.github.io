export const STUDENT_LEVELS=Object.freeze(['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2','C2.1','C2.2']);
export function promotionTarget(current,examLevel,passed){
  const index=STUDENT_LEVELS.indexOf(examLevel);
  if(!passed||index<0)return null;
  const target=STUDENT_LEVELS[Math.min(index+1,STUDENT_LEVELS.length-1)];
  return STUDENT_LEVELS.indexOf(target)>STUDENT_LEVELS.indexOf(current)?target:null;
}
export function validateStudentProfile({name,classId,level='A1.1'},classes){
  name=String(name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>120)throw new Error('Vui lòng điền họ và tên đầy đủ (2–120 ký tự).');
  if(!classes.some(item=>item.id===classId&&item.active!==false))throw new Error('Vui lòng chọn mã lớp trong danh sách.');
  if(!STUDENT_LEVELS.includes(level))throw new Error('Trình độ không hợp lệ.');
  return {name,classId,level};
}
