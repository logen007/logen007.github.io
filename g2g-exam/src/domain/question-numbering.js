import {isPrefilledQuestion} from './question-display.js';

// Display numbers belong to the whole exam, never to a part or skill.
export function examQuestionNumbers(exam,questions){
  const map=questions instanceof Map?questions:new Map((questions||[]).map(q=>[q.id,q]));
  const numbers=new Map();let number=0;
  for(const section of exam?.sections||[])for(const id of section.questionIds||[]){
    if(!isPrefilledQuestion(map.get(id)))numbers.set(id,++number);
  }
  return numbers;
}

export function sectionQuestionOffset(exam,section,questions){
  const map=questions instanceof Map?questions:new Map((questions||[]).map(q=>[q.id,q]));
  let number=0;
  for(const part of exam?.sections||[]){
    if(part===section||part.id===section.id)return number;
    number+=(part.questionIds||[]).filter(id=>!isPrefilledQuestion(map.get(id))).length;
  }
  return number;
}
