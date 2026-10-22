export function examSkillDurations(exam){
  const skills=new Map(),settings=exam.settings?.skillSettings||{};
  for(const [index,section] of (exam.sections||[]).entries()){
    const skill=section.skill||section.skillKey;
    const configured=Number(settings[skill]?.timeMinutes);
    const key=skill||(Number.isFinite(configured)&&configured>0?undefined:`section:${index}`);
    const previous=skills.get(key);
    const minutes=Number.isFinite(configured)&&configured>0?configured:(previous?.minutes||0)+Math.max(0,Number(section.timeMinutes)||0);
    skills.set(key,{name:skill||section.name||`Phần ${index+1}`,minutes});
  }
  return [...skills.values()];
}
export function examDurationSeconds(exam){
  const minutes=examSkillDurations(exam).reduce((sum,skill)=>sum+skill.minutes,0);
  return Math.max(60,minutes*60);
}
export function examDeadlineMs(attempt,exam){
  return Number(attempt.examDeadlineMs)||Date.parse(attempt.startedAt)+examDurationSeconds(exam)*1000;
}
export function submissionTiming(attempt,exam,now=Date.now()){
  const deadline=examDeadlineMs(attempt,exam),end=Math.min(now,deadline);
  return {timedOut:now>=deadline,durationSeconds:Math.max(0,Math.floor((end-Date.parse(attempt.startedAt))/1000)),submittedAt:new Date(end).toISOString()};
}
