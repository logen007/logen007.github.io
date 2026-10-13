import {isPrefilledQuestion} from './question-display.js';
import {letterAnswerIssue} from './letter-answers.js';
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
      if(example&&group.length>0&&group.length!==2)errors.push(`${section.name}: cần đúng 2 câu ví dụ trong một cặp.`);
      if(group.length%2||group.some((q,index)=>q.type!==profile.pairProfiles[index%2].type))errors.push(`${section.name}: mỗi Text cần một cặp Đúng/Sai rồi A/B/C.`);
    }
  }
  if(scoredCount!==section.questionLimit)errors.push(`${section.name}: cần đúng ${section.questionLimit} câu tính điểm, hiện có ${scoredCount}. Thêm hoặc bỏ câu tính điểm cho đủ số lượng; câu ví dụ không được tính.`);
  if(profile.uniqueLetters){
    const issue=letterAnswerIssue(section,map,Object.fromEntries(rows.map(q=>[q.id,q.correctAnswer])));
    if(issue){
      const label=id=>isPrefilledQuestion(map.get(id))?'câu ví dụ':`câu ${rows.filter(q=>!isPrefilledQuestion(q)).findIndex(q=>q.id===id)+1}`;
      const exception=profile.repeatableLetters?.length?` ${profile.repeatableLetters.join(', ')} được phép lặp lại.`:'';
      errors.push(issue.kind==='invalid'?`${section.name}: ${label(issue.id)} chưa chọn đáp án đúng hợp lệ.${exception}`:`${section.name}: ${label(issue.previousId)} và ${label(issue.id)} trùng đáp án ${issue.letter}; đáp án này chỉ dùng một lần.${exception}`);
    }
  }
  return errors;
}
