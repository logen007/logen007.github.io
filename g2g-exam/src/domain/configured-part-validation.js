import {isPrefilledQuestion} from './question-display.js';
import {letterAnswerError} from './letter-answers.js';
import {partAudioQuestions} from './part-audio.js';

export function configuredPartErrors(section,questions){
  const profile=section.questionProfile||{},errors=[];
  // A2 approved profiles explicitly request examples; legacy parts stay unchanged.
  if(!profile.example&&!profile.manualPerPart)return errors;
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q]));
  const rows=(section.questionIds||[]).map(id=>map.get(id)).filter(Boolean);
  const scoredCount=rows.filter(q=>!isPrefilledQuestion(q)).length;
  if(scoredCount!==section.questionLimit)errors.push(`${section.name}: cần đúng ${section.questionLimit} câu tính điểm, hiện có ${scoredCount}. Thêm hoặc bỏ câu tính điểm cho đủ số lượng; câu ví dụ không được tính.`);
  if(profile.example&&rows.filter(q=>isPrefilledQuestion(q)).length<1)errors.push(`${section.name}: cần ít nhất một câu ví dụ. Bật lựa chọn Ví dụ ở câu mẫu.`);
  if(profile.uniqueLetters){
    const error=letterAnswerError(section,map,Object.fromEntries(rows.map(q=>[q.id,q.correctAnswer])));
    if(error)errors.push(`${section.name}: kiểm tra dropdown Đáp án đúng. Chọn một chữ cái hợp lệ cho mỗi câu; các đáp án đúng không được trùng nhau, kể cả câu ví dụ (Beispiel).`);
  }
  if(section.audioPolicy&&partAudioQuestions(section,rows).some(q=>!String(q.audioUrl||'').trim()))errors.push(`${section.name}: hãy tải đủ audio cho Beispiel và ${section.audioPolicy.sharedPart?'audio toàn bài':'từng câu hỏi'}.`);
  return errors;
}
