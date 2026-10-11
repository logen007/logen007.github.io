export function isPrefilledQuestion(question){
  return Boolean(question&&(question.example||(question.maxScore!=null&&Number(question.maxScore)===0)));
}

export function imageMaxWidth(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.round(n):null;
}

export function shortChoiceColumns(choices){
  const limit={2:18,3:10,4:6}[choices.length];
  if(!limit)return 0;
  return choices.every(choice=>{
    if(choice?.imageUrl)return false;
    const text=String(typeof choice==='object'?choice?.text||'':choice||'').replace(/\[\/?b\]/gi,'').trim();
    return text.length>0&&!/[\r\n]/.test(text)&&[...text].length<=limit;
  })?choices.length:0;
}
