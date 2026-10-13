import {isPrefilledQuestion} from './question-display.js';
import {sectionInstructions,supportsInstructionPositions,instructionPosition,instructionSlotCount} from './section-instructions.js';
export function normalizeAudioFlow(value){
  if(value==null)return null;
  // Compact settings; keep the legacy format readable for frozen attempts.
  if(!Object.hasOwn(value,'source')){
    const segmentRepeat=Number(value.segmentRepeat);
    if(![1,2].includes(segmentRepeat))throw new Error('Chọn Không lặp hoặc Lặp 1 lần.');
    return {segmentRepeat};
  }
  const repeat=(key)=>{const n=Number(value[key]??1);if(!Number.isInteger(n)||n<1||n>3)throw new Error('Số lần phát phải từ 1 đến 3.');return n;};
  if(!['question','pair','part'].includes(value.source))throw new Error('Cách chia audio không hợp lệ.');
  if(!['consecutive','round'].includes(value.repeatOrder))throw new Error('Thứ tự lặp audio không hợp lệ.');
  return {source:value.source,repeatOrder:value.repeatOrder,segmentRepeat:repeat('segmentRepeat'),instructionRepeat:repeat('instructionRepeat'),exampleRepeat:repeat('exampleRepeat')};
}
export function effectiveAudioPolicy(section){
  const policy=section.audioPolicy||{},flow=normalizeAudioFlow(section.audioFlow);
  if(flow&&!flow.source)return {...policy,segmentRepeat:flow.segmentRepeat,instructionRepeat:1,exampleRepeat:1,repeatOrder:'consecutive'};
  return flow?{...policy,...flow,mode:'per_question_segment',sharedPart:flow.source==='part',questionsPerSegment:flow.source==='pair'?2:1}:policy;
}
// Shared-part audio is stored on the first scored question, after the example.
export function partAudioQuestions(section,questions){
  const policy=effectiveAudioPolicy(section);
  const ordered=[...questions].sort((a,b)=>Number(Boolean(isPrefilledQuestion(b)))-Number(Boolean(isPrefilledQuestion(a))));
  if(policy.questionsPerSegment===2){
    return [true,false].flatMap(example=>ordered.filter(q=>isPrefilledQuestion(q)===example).filter((_,index)=>index%2===0));
  }
  if(!policy.sharedPart)return ordered;
  return [...ordered.filter(q=>isPrefilledQuestion(q)),...ordered.filter(q=>!isPrefilledQuestion(q)).slice(0,1)];
}

export function partAudioSegments(section,questions,{startNumber=0}={}){
  const policy=effectiveAudioPolicy(section),prefix=[],tasks=[];
  let taskNumber=startNumber;
  const count=questions.filter(q=>!isPrefilledQuestion(q)).length,positioned=supportsInstructionPositions(section);
  const prompts=sectionInstructions(section).filter(block=>block.audioUrl);
  const slots=instructionSlotCount(section,count);
  const promptSegments=position=>prompts.filter(block=>{const slot=positioned?instructionPosition(block,slots):0;return (slots!==count&&slot?count:slot)===position;}).map(block=>({url:block.audioUrl,repeat:policy.instructionRepeat||1,label:'Aufgabenstellung'}));
  prefix.push(...promptSegments(0));
  // Explicit recordings on any question are playable, including legacy non-carriers.
  const recordings=[...questions].sort((a,b)=>Number(isPrefilledQuestion(b))-Number(isPrefilledQuestion(a)));
  const instructionSegments=new Set();let questionIndex=0;
  for(const q of recordings){
    const example=isPrefilledQuestion(q);if(!example)taskNumber++;
    for(const block of q.instructionBlocks||[])if(block.audioUrl){
      const segment={url:block.audioUrl,repeat:policy.instructionRepeat||1,label:'Aufgabenstellung'};
      (example?prefix:tasks).push(segment);instructionSegments.add(segment);
    }
    if(q.audioUrl)(example?prefix:tasks).push({url:q.audioUrl,repeat:example?(policy.exampleRepeat||1):Math.max(1,Number(policy.segmentRepeat)||1),label:example?'Beispiel':policy.sharedPart?'Hörtext':`Aufgabe ${taskNumber}`});
    if(!example)for(const segment of promptSegments(++questionIndex)){tasks.push(segment);instructionSegments.add(segment);}
  }
  return [...prefix,...(policy.repeatOrder==='round'?Array.from({length:Math.max(1,Number(policy.segmentRepeat)||1)},(_,round)=>tasks.filter(segment=>!round||!instructionSegments.has(segment)).map(segment=>instructionSegments.has(segment)?segment:{...segment,repeat:1})).flat():tasks)];
}
