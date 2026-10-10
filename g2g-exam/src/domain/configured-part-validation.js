import {letterAnswerError} from './letter-answers.js';
import {partAudioQuestions} from './part-audio.js';

export function configuredPartErrors(section,questions){
  const profile=section.questionProfile||{},errors=[];
  // A2 approved profiles explicitly request examples; legacy parts stay unchanged.
  if(!profile.example&&!profile.manualPerPart)return errors;
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q]));
  const rows=(section.questionIds||[]).map(id=>map.get(id)).filter(Boolean);
  if(rows.filter(q=>!q.example).length!==section.questionLimit)errors.push(`${section.name}: cần đúng ${section.questionLimit} câu tính điểm.`);
  if(profile.example&&rows.filter(q=>q.example).length!==1)errors.push(`${section.name}: cần một câu Beispiel.`);
  if(profile.uniqueLetters){
    const error=letterAnswerError(section,map,Object.fromEntries(rows.map(q=>[q.id,q.correctAnswer])));
    if(error)errors.push(`${section.name}: các đáp án đúng không được trùng nhau, kể cả Beispiel.`);
  }
  if(section.audioPolicy&&partAudioQuestions(section,rows).some(q=>!String(q.audioUrl||'').trim()))errors.push(`${section.name}: hãy tải đủ audio cho Beispiel và ${section.audioPolicy.sharedPart?'audio toàn bài':'từng câu hỏi'}.`);
  return errors;
}
