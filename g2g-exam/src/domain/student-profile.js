export const STUDENT_LEVELS=Object.freeze(['A1','A2','B1','B2','C1','C2']);
export const EXTERNAL_CLASS='Extend';
export const normalizeStudentLevel=value=>/^([ABC][12])(?:\.[12])?$/.exec(String(value||''))?.[1]||null;
export const examLearningLevel=exam=>normalizeStudentLevel(exam.learningLevel)||normalizeStudentLevel(exam.level);
export function promotionTarget(current,examLevel,passed){
  const target=normalizeStudentLevel(examLevel);
  return passed&&target?target:null;
}
export function validateStudentProfile({name,classId,level='A1'},classes){
  name=validateStudentName(name);
  if(!classes.some(item=>item.id===classId&&item.active!==false))throw new Error('Vui lòng chọn mã lớp trong danh sách.');
  if(!STUDENT_LEVELS.includes(level))throw new Error('Trình độ không hợp lệ.');
  return {name,classId,level};
}
export function validateStudentName(value){
  const name=String(value||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>120||name.split(' ').length<2)throw new Error('Vui lòng điền đầy đủ họ và tên (tối đa 120 ký tự).');
  return name;
}
