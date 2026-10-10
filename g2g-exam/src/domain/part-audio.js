// Shared-part audio is stored on the first scored question, after the example.
export function partAudioQuestions(section,questions){
  const ordered=[...questions].sort((a,b)=>Number(Boolean(b.example))-Number(Boolean(a.example)));
  if(!section.audioPolicy?.sharedPart)return ordered;
  return [...ordered.filter(q=>q.example),...ordered.filter(q=>!q.example).slice(0,1)];
}

export function partAudioSegments(section,questions){
  let taskNumber=0;
  return partAudioQuestions(section,questions).filter(q=>q.audioUrl).map(q=>({
    url:q.audioUrl,repeat:q.example?1:Math.max(1,Number(section.audioPolicy?.segmentRepeat)||1),
    label:q.example?'Beispiel':section.audioPolicy?.sharedPart?'Hörtext':`Aufgabe ${++taskNumber}`,
  }));
}
