import {isPrefilledQuestion} from './question-display.js';
import {scoreQuestion} from './question-score.js';
import {isAutomaticWritingForm,scoreWritingForm} from './writing-form.js';

// Owner-only projection. Never mix AI estimates with unpublished teacher marks.
export function provisionalResult(exam,questions,attempt,privateData=attempt){
  if(!['submitted','grading','ready'].includes(attempt.status))return null;
  const map=new Map(questions.map(q=>[q.id,q])),parts=[];
  for(const section of exam.sections||[]){
    const automatic={label:section.name,score:0,max:0,source:'automatic'},writing=[];
    for(const id of section.questionIds||[]){
      const q=map.get(id);if(!q||isPrefilledQuestion(q))continue;
      const max=Math.max(0,Number(q.maxScore)||0),answer=attempt.answers?.[id];
      if(isAutomaticWritingForm(exam,section,q)||q.autoGrade){
        automatic.max+=max;
        automatic.score+=isAutomaticWritingForm(exam,section,q)?scoreWritingForm(q.rubric,answer):scoreQuestion(q,answer);
      }else if(q.type==='writing'){
        const suggestion=privateData.aiWritingSuggestions?.[id],value=suggestion?.suggestedScore;
        const complete=suggestion?.status==='completed'&&value!=null&&value!==''&&Number.isFinite(Number(value));
        writing.push({label:section.name,source:'ai',max,score:complete?Math.round(Math.max(0,Math.min(max,Number(value)))*100)/100:null,
          status:complete?'completed':suggestion?.status==='failed'?'failed':String(q.aiGradingRules||'').trim()&&String(answer||'').trim()?'pending':'unavailable'});
      }
    }
    if(automatic.max>0)parts.push({...automatic,score:Math.round(automatic.score*100)/100});
    writing.forEach((item,i)=>parts.push({...item,label:writing.length>1?`${item.label} · Bài ${i+1}`:item.label}));
  }
  return {parts};
}
