import {canonicalSkill} from './gradebook.js';
import {isPrefilledQuestion} from './question-display.js';
import {resultSummary} from './result-summary.js';

// A read-only projection shared by local mode and the authenticated review API.
// Never send grading keys or private feedback before publication.
export function buildAttemptReview({exam={},questions=[],attempt={},privateData=attempt,student={}}){
  const published=attempt.status==='published';
  const map=new Map(questions.map(q=>[q.id,q]));
  const scoredIds=section=>(section.questionIds||[]).filter(id=>map.has(id)&&!isPrefilledQuestion(map.get(id))&&map.get(id).type!=='speaking');
  return {
    attempt:{id:attempt.id,status:attempt.status,examTitle:attempt.examTitle||exam.title,
      studentName:student.name||attempt.studentName,studentPicture:student.picture||'',
      provider:exam.provider,level:exam.level,attemptNo:attempt.attemptNo,
      submittedAt:attempt.submittedAt,startedAt:attempt.startedAt,completion:attempt.completion},
    sections:(exam.sections||[]).map((section,sectionIndex)=>({name:section.name,
      skill:canonicalSkill(section.questionProfile?.scoringSkill||section.skillKey||section.skill||section.name),
      questions:scoredIds(section).map(id=>map.get(id)).map((q,index)=>({
        id:q.id,number:1+index+(exam.sections||[]).slice(0,sectionIndex).filter(s=>!section.questionProfile?.numberWithinSkill||s.skillKey===section.skillKey).reduce((sum,s)=>sum+scoredIds(s).length,0),title:q.title||q.prompt||'',type:q.type||'',maxScore:q.maxScore,
        answer:attempt.answers?.[q.id],
        correct:published&&q.writingFormVersion!==1?q.correctAnswer:null,
        pairs:q.type==='matching'?(q.pairs||[]).map(pair=>[pair[0],published?pair[1]:null]):[],
        choices:(q.choices||[]).map(choice=>({text:typeof choice==='object'?String(choice.text||''):String(choice??''),imageUrl:typeof choice==='object'?choice.imageUrl||'':''})),
        fields:q.writingFormVersion===1?(q.rubric||[]).map((field,index)=>({index,label:field.label||'',type:field.type||'text',expected:published?field.answers||field.options?.[field.correctIndex]||'':null})):[],
      }))})),
    score:published?{summary:privateData.resultSummary||resultSummary(exam,questions,{...attempt,...privateData}),
      promotion:privateData.promotion,total:privateData.totalScore,sections:privateData.sectionScores,
      feedback:privateData.feedback,result:privateData.result,reviewerName:attempt.reviewerName}:null,
  };
}

export function questionVerdict(q){
  if(!['single','truefalse','cloze'].includes(q.type)||q.correct==null)return null;
  if(q.answer==null||String(q.answer).trim()==='')return 'blank';
  return Number(q.answer)===Number(q.correct)?'correct':'wrong';
}
export function reviewCounts(questions){
  const counts={total:questions.length,objective:0,correct:0,wrong:0,blank:0};
  for(const q of questions){const verdict=questionVerdict(q);if(verdict){counts.objective++;counts[verdict]++;}}
  return counts;
}
