export function examDurationSeconds(exam){
  return Math.max(60,(exam.sections||[]).reduce((sum,section)=>sum+Math.max(0,Number(section.timeMinutes)||0),0)*60);
}
export function examDeadlineMs(attempt,exam){
  return Number(attempt.examDeadlineMs)||Date.parse(attempt.startedAt)+examDurationSeconds(exam)*1000;
}
export function submissionTiming(attempt,exam,now=Date.now()){
  const deadline=examDeadlineMs(attempt,exam),end=Math.min(now,deadline);
  return {timedOut:now>=deadline,durationSeconds:Math.max(0,Math.floor((end-Date.parse(attempt.startedAt))/1000)),submittedAt:new Date(end).toISOString()};
}
