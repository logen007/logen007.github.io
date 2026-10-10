import {isPrefilledQuestion} from './question-display.js';
// Shared-part audio is stored on the first scored question, after the example.
export function partAudioQuestions(section,questions){
  const ordered=[...questions].sort((a,b)=>Number(Boolean(isPrefilledQuestion(b)))-Number(Boolean(isPrefilledQuestion(a))));
  if(!section.audioPolicy?.sharedPart)return ordered;
  return [...ordered.filter(q=>isPrefilledQuestion(q)),...ordered.filter(q=>!isPrefilledQuestion(q)).slice(0,1)];
}

export function partAudioSegments(section,questions){
  let taskNumber=0;
  return [...(section.instructionAudioUrl?[{url:section.instructionAudioUrl,repeat:1,label:'Aufgabenstellung'}]:[]),...partAudioQuestions(section,questions).filter(q=>q.audioUrl).map(q=>({
    url:q.audioUrl,repeat:isPrefilledQuestion(q)?1:Math.max(1,Number(section.audioPolicy?.segmentRepeat)||1),
    label:isPrefilledQuestion(q)?'Beispiel':section.audioPolicy?.sharedPart?'Hörtext':`Aufgabe ${++taskNumber}`,
  }))];
}
