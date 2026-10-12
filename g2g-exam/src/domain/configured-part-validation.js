import {isPrefilledQuestion} from './question-display.js';
import {letterAnswerError} from './letter-answers.js';
import {partAudioQuestions,effectiveAudioPolicy} from './part-audio.js';
import {inlineGapErrors} from './inline-gaps.js';

export function configuredPartErrors(section,questions){
  const profile=section.questionProfile||{},errors=[];
  // A2 approved profiles explicitly request examples; legacy parts stay unchanged.
  if(!profile.example&&!profile.manualPerPart&&!section.audioPolicy&&!['inline-gaps','heading-match'].includes(profile.layout))return errors;
  if(profile.layout==='heading-match'){
    const options=section.headingOptions||[],minimum=profile.dynamicHeadingOptions?section.questionLimit:profile.choices.length,maximum=profile.dynamicHeadingOptions?26:minimum;
    if(options.length<minimum||options.length>maximum||options.some(text=>!String(text||'').trim()))errors.push(`${section.name}: nhập đầy đủ danh sách đáp án (${minimum}–${maximum}), không để trống.`);
  }
  errors.push(...inlineGapErrors(section));
  const map=questions instanceof Map?questions:new Map(questions.map(q=>[q.id,q]));
  const rows=(section.questionIds||[]).map(id=>map.get(id)).filter(Boolean);
  const scoredCount=rows.filter(q=>!isPrefilledQuestion(q)).length;
  if(profile.pairedQuestions){
    for(const example of [true,false]){
      const group=rows.filter(q=>isPrefilledQuestion(q)===example);
      if(example&&group.length!==2)errors.push(`${section.name}: cần đúng 2 câu ví dụ trong một cặp.`);
      if(group.length%2||group.some((q,index)=>q.type!==profile.pairProfiles[index%2].type))errors.push(`${section.name}: mỗi Text cần một cặp Đúng/Sai rồi A/B/C.`);
    }
  }
  if(scoredCount!==section.questionLimit)errors.push(`${section.name}: cần đúng ${section.questionLimit} câu tính điểm, hiện có ${scoredCount}. Thêm hoặc bỏ câu tính điểm cho đủ số lượng; câu ví dụ không được tính.`);
  if(profile.example&&rows.filter(q=>isPrefilledQuestion(q)).length<1)errors.push(`${section.name}: cần ít nhất một câu ví dụ. Bật lựa chọn Ví dụ ở câu mẫu.`);
  if(profile.uniqueLetters){
    const error=letterAnswerError(section,map,Object.fromEntries(rows.map(q=>[q.id,q.correctAnswer])));
    if(error)errors.push(profile.layout==='inline-gaps'?`${section.name}: mỗi ký hiệu đáp án chỉ dùng một lần. Kiểm tra các chỗ trống trong đoạn văn.`:`${section.name}: kiểm tra đáp án đúng. Chọn một chữ cái hợp lệ cho mỗi câu; các đáp án đúng không được trùng nhau, kể cả câu ví dụ (Beispiel).`);
  }
  if((section.audioPolicy||section.audioFlow)&&partAudioQuestions(section,rows).some(q=>!String(q.audioUrl||'').trim()))errors.push(`${section.name}: hãy tải đủ audio cho Beispiel và ${effectiveAudioPolicy(section).sharedPart?'audio toàn bài':'từng câu hỏi'}.`);
  return errors;
}
