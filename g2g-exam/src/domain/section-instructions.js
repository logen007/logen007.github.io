import {imageMaxWidth} from './question-display.js';

export function normalizeInstructions(blocks){
  return (Array.isArray(blocks)?blocks:[]).map((block,index)=>({
    id:String(block.id||`prompt-${index+1}`),text:String(block.text||''),
    imageUrl:String(block.imageUrl||''),imageMaxWidth:imageMaxWidth(block.imageMaxWidth),
    audioUrl:String(block.audioUrl||''),audioName:String(block.audioName||''),
  }));
}

// The first prompt retains legacy fields so old exams and frozen attempts need no migration.
export function sectionInstructions(section){
  return normalizeInstructions([{id:'main',text:section.instruction||'',imageUrl:section.instructionImageUrl||'',
    imageMaxWidth:section.instructionImageMaxWidth,audioUrl:section.instructionAudioUrl||'',
    audioName:section.instructionAudioName||''},...normalizeInstructions(section.additionalInstructions)]);
}

export function instructionPatch(blocks){
  const [first,...rest]=normalizeInstructions(blocks);
  return {instruction:first?.text||'',instructionImageUrl:first?.imageUrl||'',
    instructionImageMaxWidth:first?.imageMaxWidth??null,instructionAudioUrl:first?.audioUrl||'',
    instructionAudioName:first?.audioName||'',additionalInstructions:rest.map((block,index)=>({...block,id:`prompt-${index+1}`}))};
}

export function changeInstructions(section,index,action){
  const blocks=sectionInstructions(section);
  if(!Number.isInteger(index)||index<0||index>=blocks.length)return instructionPatch(blocks);
  if(action==='add')blocks.splice(index+1,0,{text:''});
  if(action==='remove'&&blocks.length>1)blocks.splice(index,1);
  const next=index+(action==='up'?-1:1);
  if(['up','down'].includes(action)&&next>=0&&next<blocks.length)[blocks[index],blocks[next]]=[blocks[next],blocks[index]];
  return instructionPatch(blocks);
}

export const instructionAudioKey=(section,id)=>id==='main'?`section:${section.id}`:`instruction:${section.id}:${id}`;
