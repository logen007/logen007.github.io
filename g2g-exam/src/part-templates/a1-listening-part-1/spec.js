import {loadApprovedPartSpec} from '../../exam-specs/spec-loader.js';

let cached=null;
export async function getA1ListeningPart1Spec(){
  cached ||= loadApprovedPartSpec('../../../specs/goethe/a1/listening/part-01.json');
  return cached;
}

export function audioPolicyFromSpec(spec){
  const audio=spec?.audio||{};
  return Object.freeze({
    maxSessions:Number(audio.maxSessions||1),
    segmentRepeat:Number(audio.segmentRepeat||1),
    controls:Boolean(audio.controls),
    pauseAllowed:Boolean(audio.pauseAllowed),
    replayAllowed:Boolean(audio.replayAllowed),
  });
}
