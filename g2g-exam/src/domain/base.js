export const ROLES=Object.freeze({STUDENT:'student',TEACHER:'teacher',MASTER:'master'});
export const ATTEMPT_STATUS=Object.freeze({IN_PROGRESS:'in_progress',SUBMITTED:'submitted',GRADING:'grading',READY:'ready',PUBLISHED:'published',ABANDONED:'abandoned'});

export const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
export const nowIso=()=>new Date().toISOString();
export const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export const byId=(items,id)=>(items||[]).find(x=>x.id===id);
export const active=items=>(items||[]).filter(x=>x.status!=='trash');
export const isTeacher=user=>user?.role===ROLES.TEACHER||user?.role===ROLES.MASTER;
export const isMaster=user=>user?.role===ROLES.MASTER;
export const isStudent=user=>user?.role===ROLES.STUDENT;

export function normalizeState(input){
  const state=clone(input||{});
  state.schemaVersion||=2;
  state.revision||=1;
  for(const key of ['users','questions','exams','attempts','gradingRequests','notifications','auditLog'])state[key]||=[];
  return state;
}

export function audit(state,user,action,entityType,entityId,detail={}){
  state.auditLog||=[];
  state.auditLog.unshift({
    id:uid('audit'),at:nowIso(),userId:user?.id||'system',userName:user?.name||'Hệ thống',
    action,entityType,entityId,detail:clone(detail),
  });
  if(state.auditLog.length>1000)state.auditLog.length=1000;
}

export function canEditQuestion(user,question){
  return Boolean(user&&question&&(isMaster(user)||(isTeacher(user)&&question.ownerId===user.id&&question.locked!==true)));
}
export function canDeleteQuestion(user,question){return canEditQuestion(user,question);}
export function canPermanentlyDelete(user){return isMaster(user);}
export function canEditExam(user,exam){return Boolean(user&&exam&&(isMaster(user)||(isTeacher(user)&&exam.ownerId===user.id)));}
export function canSeeTrash(user){return isMaster(user);}
export function canPublishExamResult(user,exam){return Boolean(isTeacher(user)&&exam);}

export function canGradeExam(state,user,exam){
  return Boolean(isTeacher(user)&&exam);
}

export function getPublishedExams(state){return (state.exams||[]).filter(x=>x.status==='published');}
export function getVisibleQuestions(state,user,{includeTrash=false}={}){
  return (state.questions||[]).filter(q=>includeTrash?(isMaster(user)&&q.status==='trash'):q.status!=='trash');
}
