export function examDurationSeconds(exam){
  const counted=new Set(),settings=exam.settings?.skillSettings||{};
  const minutes=(exam.sections||[]).reduce((sum,section)=>{
    const skill=section.skill||section.skillKey;
    const configured=Number(settings[skill]?.timeMinutes);
    if(Number.isFinite(configured)&&configured>0){
      if(counted.has(skill))return sum;
      counted.add(skill);return sum+configured;
    }
    return sum+Math.max(0,Number(section.timeMinutes)||0);
  },0);
  return Math.max(60,minutes*60);
}
export function examDeadlineMs(attempt,exam){
  return Number(attempt.examDeadlineMs)||Date.parse(attempt.startedAt)+examDurationSeconds(exam)*1000;
}
export function submissionTiming(attempt,exam,now=Date.now()){
  const deadline=examDeadlineMs(attempt,exam),end=Math.min(now,deadline);
  return {timedOut:now>=deadline,durationSeconds:Math.max(0,Math.floor((end-Date.parse(attempt.startedAt))/1000)),submittedAt:new Date(end).toISOString()};
}
