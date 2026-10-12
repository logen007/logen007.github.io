// Shared arithmetic only. Callers retain their own example/visibility policies.
export function scoreQuestion(question,answer){
  if(!question?.autoGrade||question.example||answer==null||answer==='')return 0;
  if(['single','truefalse','cloze'].includes(question.type)){
    return Number(answer)===Number(question.correctAnswer)?Number(question.maxScore||0):0;
  }
  if(question.type==='matching'){
    if(!Array.isArray(answer)||!Array.isArray(question.pairs)||!question.pairs.length)return 0;
    let correct=0;
    question.pairs.forEach((pair,index)=>{if(answer[index]===pair[1])correct++;});
    return Math.round(correct/question.pairs.length*Number(question.maxScore||0)*100)/100;
  }
  return 0;
}
