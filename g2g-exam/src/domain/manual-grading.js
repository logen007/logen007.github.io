import {isPrefilledQuestion} from './question-display.js';
import {isAutomaticWritingForm} from './writing-form.js';

export function manualGroups(exam,questions){
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q])),groups=new Map();
  for(const section of exam.sections||[])for(const id of section.questionIds||[]){
    const q=map.get(id);
    if(!q||isPrefilledQuestion(q)||q.autoGrade||isAutomaticWritingForm(exam,section,q))continue;
    const key=section.questionProfile?.manualPerPart?section.name:q.skill;
    if(!groups.has(key))groups.set(key,{key,max:0,questions:[],section});
    const group=groups.get(key);group.max+=Number(q.maxScore||0);group.questions.push(q);
  }
  return [...groups.values()];
}
