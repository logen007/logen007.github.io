import {canGradeExam,ATTEMPT_STATUS} from './base.js';

export function gradingNeighbors(data,user,current){
  const users=new Map((data.users||[]).map(u=>[u.id,u]));
  const classId=users.get(current?.studentId)?.classId;
  if(!classId||!(data.classes||[]).some(c=>c.id===classId&&c.code!=='Extend'))return {};
  const exams=new Map((data.exams||[]).map(e=>[e.id,e]));
  const pending=a=>[ATTEMPT_STATUS.GRADING,ATTEMPT_STATUS.READY].includes(a.status);
  const queue=(data.attempts||[]).filter(a=>users.get(a.studentId)?.classId===classId&&(pending(a)||a.status===ATTEMPT_STATUS.PUBLISHED)&&canGradeExam(data,user,exams.get(a.examId)))
    .sort((a,b)=>String(a.submittedAt||a.startedAt||'').localeCompare(String(b.submittedAt||b.startedAt||''))||a.id.localeCompare(b.id));
  const index=queue.findIndex(a=>a.id===current.id);
  if(index<0)return {};
  const others=queue.slice(index+1).concat(queue.slice(0,index));
  return {previous:queue[index-1],next:queue[index+1],nextPending:others.find(a=>pending(a)&&a.studentId!==current.studentId)};
}
