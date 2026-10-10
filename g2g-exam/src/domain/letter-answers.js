import {isPrefilledQuestion} from './question-display.js';
export const choiceLetter=choice=>String(typeof choice==='object'?choice?.text||'':choice||'').trim().toUpperCase();

export function letterAnswerError(section,questions,answers){
  if(!section.questionProfile?.uniqueLetters)return '';
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q])),used=new Set();
  for(const id of section.questionIds||[]){
    const q=map.get(id);if(!q)continue;
    const value=isPrefilledQuestion(q)?q.correctAnswer:answers[id];
    if(value==null||value==='')continue;
    if(!Number.isInteger(Number(value))||Number(value)<0)return 'Bitte wählen Sie einen gültigen Buchstaben.';
    const letter=choiceLetter(q.choices?.[Number(value)]);
    if(!/^[A-Z]$/.test(letter))return 'Bitte wählen Sie einen gültigen Buchstaben.';
    if(used.has(letter))return 'Jeden Buchstaben dürfen Sie nur einmal verwenden.';
    used.add(letter);
  }
  return '';
}
