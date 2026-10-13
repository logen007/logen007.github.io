export function validateA1ListeningPart1({part,section,group,questions,spec,startNumber=0}){
  const context=part||section||group;
  const min=Math.max(1,Number(spec?.questions?.min||1));
  const max=Math.max(min,Number(spec?.questions?.max||min));
  const keys=Array.isArray(spec?.answers?.keys)?spec.answers.keys:['A','B','C'];
  if(!String(context?.instruction||'').trim())throw new Error('Cần nhập đề bài chung.');
  const realQuestions=Array.isArray(questions)?questions.filter(question=>!question?.example):[];
  if(realQuestions.length<min||realQuestions.length>max)throw new Error(`Phần này phải có từ ${min} đến ${max} câu tính điểm.`);
  for(let index=0;index<questions.length;index++){
    const question=questions[index];
    const label=question.example?'Câu ví dụ':`Câu ${startNumber+questions.slice(0,index+1).filter(q=>!q.example).length}`;
    if(!String(question?.prompt||'').trim())throw new Error(`${label} chưa có nội dung câu hỏi.`);
    if(!Array.isArray(question?.choices)||question.choices.length!==keys.length)throw new Error(`${label} phải có đủ đáp án ${keys.join('/')} .`);
    if(question.choices.some(choice=>!String(choice?.text??choice??'').trim()))throw new Error(`${label} cần đủ nội dung ${keys.join(', ')}.`);
    const correct=Number(question.correctAnswer);
    if(!Number.isInteger(correct)||correct<0||correct>=keys.length)throw new Error(`${label} chưa có đáp án đúng hợp lệ.`);
    const score=Number(question.maxScore);
    if(!Number.isFinite(score)||score<0)throw new Error(`Điểm ${label.toLowerCase()} không hợp lệ.`);
  }
  return true;
}
