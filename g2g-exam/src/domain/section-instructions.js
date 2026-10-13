import {imageMaxWidth} from './question-display.js';
import {isPrefilledQuestion} from './question-display.js';

// Upgrade a legacy question-owned prompt only when the author moves it.
export function moveLegacyInstruction(section,question,index,direction,questions){
  const source=[...(question.instructionBlocks||[])],block=source[index];if(!block)return null;
  const delta=direction==='up'?-1:1,neighbor=index+delta;
  let sectionPatch=null;
  if(neighbor>=0&&neighbor<source.length)[source[index],source[neighbor]]=[source[neighbor],source[index]];
  else{
    const map=new Map(questions.map(q=>[q.id,q])),scored=(section.questionIds||[]).filter(id=>!isPrefilledQuestion(map.get(id)));
    const at=Math.max(0,scored.indexOf(question.id)),count=instructionSlotCount(section,scored.length);
    source.splice(index,1);
    const prompts=[...sectionInstructions(section),{...block,afterQuestion:Math.max(0,Math.min(count,at+delta))}];
    prompts.sort((a,b)=>(a.afterQuestion||0)-(b.afterQuestion||0));sectionPatch=instructionPatch(prompts);
  }
  const first=source[0]||{};
  return {sectionPatch,questionPatch:{instructionBlocks:source,prompt:first.text||'',instructionImageUrl:first.imageUrl||''}};
}

export function normalizeInstructions(blocks){
  return (Array.isArray(blocks)?blocks:[]).map((block,index)=>({
    id:String(block.id||`prompt-${index+1}`),text:String(block.text||''),
    imageUrl:String(block.imageUrl||''),imageMaxWidth:imageMaxWidth(block.imageMaxWidth),
    audioUrl:String(block.audioUrl||''),audioName:String(block.audioName||''),
    afterQuestion:Math.max(0,Math.floor(Number(block.afterQuestion)||0)),
  }));
}

// The first prompt retains legacy fields so old exams and frozen attempts need no migration.
export function sectionInstructions(section){
  return normalizeInstructions([{id:'main',text:section.instruction||'',imageUrl:section.instructionImageUrl||'',
    imageMaxWidth:section.instructionImageMaxWidth,audioUrl:section.instructionAudioUrl||'',
    audioName:section.instructionAudioName||'',afterQuestion:section.instructionAfterQuestion},...normalizeInstructions(section.additionalInstructions)]);
}

export function instructionPatch(blocks){
  const [first,...rest]=normalizeInstructions(blocks);
  return {instruction:first?.text||'',instructionImageUrl:first?.imageUrl||'',instructionAfterQuestion:first?.afterQuestion||0,
    instructionImageMaxWidth:first?.imageMaxWidth??null,instructionAudioUrl:first?.audioUrl||'',
    instructionAudioName:first?.audioName||'',additionalInstructions:rest.map((block,index)=>({...block,id:`prompt-${index+1}`}))};
}

export function changeInstructions(section,index,action,questionCount=0){
  const blocks=sectionInstructions(section);
  if(!Number.isInteger(index)||index<0||index>=blocks.length)return instructionPatch(blocks);
  const count=instructionSlotCount(section,questionCount);
  blocks.forEach(block=>{block.afterQuestion=instructionPosition(block,count);});
  if(action==='add')blocks.splice(index+1,0,{text:'',afterQuestion:blocks[index].afterQuestion});
  if(action==='remove')blocks.splice(index,1);
  if(['up','down'].includes(action)){
    const current=blocks[index],ordered=[...blocks].sort((a,b)=>a.afterQuestion-b.afterQuestion);
    const at=ordered.indexOf(current),direction=action==='up'?-1:1,neighbor=ordered[at+direction];
    if(neighbor&&neighbor.afterQuestion===current.afterQuestion){
      const other=blocks.indexOf(neighbor);
      [blocks[index],blocks[other]]=[blocks[other],blocks[index]];
    }else current.afterQuestion=Math.max(0,Math.min(count,current.afterQuestion+direction));
  }
  blocks.sort((a,b)=>a.afterQuestion-b.afterQuestion);
  return instructionPatch(blocks);
}

export const instructionAudioKey=(section,id)=>id==='main'?`section:${section.id}`:`instruction:${section.id}:${id}`;

// Embedded gaps and horizontal tables move as one content block.
export const instructionSlotCount=(section,count)=>['inline-gaps','letter-table'].includes(section.questionProfile?.layout)?(count?1:0):count;
export const supportsInstructionPositions=()=>true;
export const instructionPosition=(block,count)=>Math.min(count,Math.max(0,Number(block.afterQuestion)||0));
