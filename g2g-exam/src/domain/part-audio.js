import {isPrefilledQuestion} from './question-display.js';
export function normalizeAudioFlow(value){
  if(value==null)return null;
  const repeat=(key)=>{const n=Number(value[key]??1);if(!Number.isInteger(n)||n<1||n>3)throw new Error('Số lần phát phải từ 1 đến 3.');return n;};
  if(!['question','pair','part'].includes(value.source))throw new Error('Cách chia audio không hợp lệ.');
  if(!['consecutive','round'].includes(value.repeatOrder))throw new Error('Thứ tự lặp audio không hợp lệ.');
  return {source:value.source,repeatOrder:value.repeatOrder,segmentRepeat:repeat('segmentRepeat'),instructionRepeat:repeat('instructionRepeat'),exampleRepeat:repeat('exampleRepeat')};
}
export function effectiveAudioPolicy(section){
  const policy=section.audioPolicy||{},flow=normalizeAudioFlow(section.audioFlow);
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

export function partAudioSegments(section,questions){
  const policy=effectiveAudioPolicy(section),prefix=[],tasks=[];
  let taskNumber=0;
  if(section.instructionAudioUrl)prefix.push({url:section.instructionAudioUrl,repeat:policy.instructionRepeat||1,label:'Aufgabenstellung'});
  for(const q of partAudioQuestions(section,questions).filter(q=>q.audioUrl)){
    const example=isPrefilledQuestion(q);
    (example?prefix:tasks).push({url:q.audioUrl,repeat:example?(policy.exampleRepeat||1):Math.max(1,Number(policy.segmentRepeat)||1),label:example?'Beispiel':policy.sharedPart?'Hörtext':`Aufgabe ${++taskNumber}`});
  }
  return [...prefix,...(policy.repeatOrder==='round'?Array.from({length:Math.max(1,Number(policy.segmentRepeat)||1)},()=>tasks.map(segment=>({...segment,repeat:1}))).flat():tasks)];
}
