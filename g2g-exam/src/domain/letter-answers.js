import {isPrefilledQuestion} from './question-display.js';
export const choiceLetter=choice=>String(typeof choice==='object'?choice?.text||'':choice||'').trim().toUpperCase();

export function letterAnswerIssue(section,questions,answers){
  if(!section.questionProfile?.uniqueLetters)return null;
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q])),used=new Map();
  for(const id of section.questionIds||[]){
    const q=map.get(id);if(!q)continue;
    const value=isPrefilledQuestion(q)?q.correctAnswer:answers[id];
    if(value==null||value==='')continue;
    if(!Number.isInteger(Number(value))||Number(value)<0)return {kind:'invalid',id};
    const letter=choiceLetter(q.choices?.[Number(value)]);
    if(!/^[A-Z]$/.test(letter))return {kind:'invalid',id};
    if((section.questionProfile.repeatableLetters||[]).some(value=>choiceLetter(value)===letter))continue;
    if(used.has(letter))return {kind:'duplicate',id,previousId:used.get(letter),letter};
    used.set(letter,id);
  }
  return null;
}

export function letterAnswerError(section,questions,answers){
  const issue=letterAnswerIssue(section,questions,answers);
  return !issue?'':issue.kind==='invalid'?'Bitte wählen Sie einen gültigen Buchstaben.':'Jeden Buchstaben dürfen Sie nur einmal verwenden.';
}
