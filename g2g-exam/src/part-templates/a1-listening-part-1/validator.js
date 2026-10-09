export function validateA1ListeningPart1({part,section,group,questions,spec}){
  const context=part||section||group;
  const min=Math.max(1,Number(spec?.questions?.min||1));
  const max=Math.max(min,Number(spec?.questions?.max||min));
  const keys=Array.isArray(spec?.answers?.keys)?spec.answers.keys:['A','B','C'];
  if(!String(context?.instruction||'').trim())throw new Error('Cần nhập đề bài chung.');
  const realQuestions=Array.isArray(questions)?questions.filter(question=>!question?.example):[];
  if(realQuestions.length<min||realQuestions.length>max)throw new Error(`Phần này phải có từ ${min} đến ${max} câu tính điểm.`);
  for(let index=0;index<questions.length;index++){
    const question=questions[index];
    if(!String(question?.prompt||'').trim())throw new Error(`Câu ${index+1} chưa có nội dung câu hỏi.`);
    if(!String(question?.audioUrl||'').trim())throw new Error(`Câu ${index+1} chưa có mảnh audio.`);
    if(!Array.isArray(question?.choices)||question.choices.length!==keys.length)throw new Error(`Câu ${index+1} phải có đủ đáp án ${keys.join('/')} .`);
    if(question.choices.some(choice=>!String(choice?.text??choice??'').trim()))throw new Error(`Câu ${index+1} cần đủ nội dung ${keys.join(', ')}.`);
    const correct=Number(question.correctAnswer);
    if(!Number.isInteger(correct)||correct<0||correct>=keys.length)throw new Error(`Câu ${index+1} chưa có đáp án đúng hợp lệ.`);
    const score=Number(question.maxScore);
    if(!Number.isFinite(score)||score<0)throw new Error(`Điểm câu ${index+1} không hợp lệ.`);
  }
  return true;
}
