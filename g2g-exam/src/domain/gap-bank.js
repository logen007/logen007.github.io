// Keep authoring separate from the public, shuffled answer bank.
export const distractorLines=text=>String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);

export function splitGapBank(section,questions){
  const used=new Set(questions.filter(q=>q.correctAnswer!=null&&q.correctAnswer!==''&&Number(q.correctAnswer)>=0).map(q=>Number(q.correctAnswer)));
  return {
    answers:questions.map(q=>q.correctAnswer!=null&&q.correctAnswer!==''?section.gapOptions?.[Number(q.correctAnswer)]||'':''),
    distractors:(section.gapOptions||[]).filter((_,index)=>!used.has(index)),
  };
}

export function buildGapBank(answers,distractorText,maximum=25){
  const options=[],correct=answers.map(answer=>{
    const text=String(answer||'').trim();if(!text)return -1;
    if(!options.includes(text))options.push(text);
    return options.indexOf(text);
  });
  for(const text of distractorLines(distractorText)){
    if(options.includes(text))throw new Error('Đáp án nhiễu bị trùng: '+text);
    options.push(text);
  }
  if(options.length>maximum)throw new Error('Tối đa '+maximum+' đáp án, gồm đáp án đúng và đáp án nhiễu.');
  // Do not persist a bank whose order reveals which options answer questions 1, 2…
  const ordered=[...options].sort((a,b)=>a.localeCompare(b,'de'));
  return {options:ordered,correct:correct.map(index=>index<0?-1:ordered.indexOf(options[index]))};
}

// Shuffle only a fresh snapshot; never mutate a published exam or existing attempt.
export function shuffledGapSnapshot(exam,questions,random=Math.random){
  if(typeof random==='string'){
    let seed=2166136261;for(const char of random)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
    random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }
  const ids=new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]));
  const copy=structuredClone({...exam,questionSnapshot:questions.filter(q=>ids.has(q.id))});
  const byId=new Map(copy.questionSnapshot.map(q=>[q.id,q]));
  for(const section of copy.sections||[]){
    if(section.questionProfile?.layout!=='inline-gaps'||section.questionProfile.gapChoicesPerQuestion)continue;
    const options=section.gapOptions||[],order=options.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    section.gapOptions=order.map(i=>options[i]);
    for(const id of section.questionIds||[]){
      const q=byId.get(id);if(!q)continue;
      q.correctAnswer=q.correctAnswer==null||q.correctAnswer===''?-1:order.indexOf(Number(q.correctAnswer));
      q.choices=order.map((_,i)=>String.fromCharCode(65+i));
    }
  }
  return copy;
}
