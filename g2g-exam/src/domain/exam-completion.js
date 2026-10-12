import {isPrefilledQuestion} from './question-display.js';
import {isRequiredWritingField} from './writing-form.js';

export const MIN_COMPLETION_PERCENT=80;
export function answerPresent(answer,q){
  if(q.type==='writing'){
    if(Array.isArray(q.rubric)&&q.rubric.length)return q.rubric.every((row,index)=>!isRequiredWritingField(row)||Boolean(String(answer?.[index]??'').trim()));
    return typeof answer==='string'&&Boolean(answer.trim());
  }
  if(q.type==='matching')return Array.isArray(answer)&&(q.pairs||[]).every((_,index)=>Boolean(String(answer[index]??'').trim()));
  if(answer===undefined||answer===null||String(answer).trim()==='')return false;
  if(Array.isArray(q.choices)&&q.choices.length)return (typeof answer==='number'||typeof answer==='string')&&Number.isInteger(Number(answer))&&Number(answer)>=0&&Number(answer)<q.choices.length;
  return typeof answer==='number'?Number.isFinite(answer):typeof answer==='string';
}
export function examCompletion(exam,questions,answers={}){
  const map=questions instanceof Map?questions:new Map((questions||[]).map(q=>[q.id,q]));
  const ids=[...new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]))];
  // Speaking is graded outside the online answer form; examples never count.
  const required=ids.map(id=>map.get(id)).filter(q=>q&&!isPrefilledQuestion(q)&&q.type!=='speaking');
  const total=required.length,answered=required.filter(q=>answerPresent(answers[q.id],q)).length;
  const minimum=Math.ceil(total*MIN_COMPLETION_PERCENT/100);
  return {total,answered,minimum,percent:MIN_COMPLETION_PERCENT,eligible:answered>=minimum};
}
export function completionMessage(progress){
  return `Sie haben ${progress.answered} von ${progress.total} Aufgaben beantwortet. Für die Abgabe sind mindestens ${progress.minimum} Aufgaben (${progress.percent} %) erforderlich.`;
}
