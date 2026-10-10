export function isPrefilledQuestion(question){
  return Boolean(question&&(question.example||(question.maxScore!=null&&Number(question.maxScore)===0)));
}

export function imageMaxWidth(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.round(n):null;
}
