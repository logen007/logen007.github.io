import {skillScores,examResult,resultClass,isStandardTelc,canonicalSkill} from './gradebook.js';

export function resultSummary(exam,questions,attempt){
  const skills=skillScores(exam,questions,attempt);
  const oralRecorded=attempt.oralScore!=null||Object.keys(attempt.manualScores||{}).some(key=>canonicalSkill(key)==='speaking'&&attempt.manualScores[key]!=null);
  const requireOral=Boolean(exam.learningLevel)||isStandardTelc(exam);
  if(requireOral&&!oralRecorded)delete skills.speaking;
  let result=requireOral&&!oralRecorded?'Chờ điểm Nói':examResult(exam,skills);
  if(exam.learningLevel&&['reading','listening','writing'].some(key=>!(skills[key]?.max>0)))result='Chưa đủ cấu trúc điểm';
  const written=Object.entries(skills).filter(([key])=>key!=='speaking').reduce((sum,[,entry])=>({score:sum.score+entry.score,max:sum.max+entry.max}),{score:0,max:0});
  const total=Number((written.score+(skills.speaking?.score||0)).toFixed(2));
  return {provider:exam.provider,level:exam.level,learningLevel:exam.learningLevel||null,skills,written,total,result,
    passed:resultClass(result)==='passed',complete:Boolean(resultClass(result)),
    condition:isStandardTelc(exam)?'Phần viết ít nhất 135/225 và Nói ít nhất 45/75. Phải đạt cả hai phần.':'Mỗi kỹ năng đạt ít nhất 60% điểm tối đa.'};
}
export const SKILL_LABELS={reading:'Đọc',grammar:'Ngữ pháp',listening:'Nghe',writing:'Viết',speaking:'Nói'};
export function scoreDetails(summary){
  return Object.entries(summary.skills).map(([key,value])=>`${SKILL_LABELS[key]||key}: ${value.score}/${value.max}`).concat(summary.provider==='TELC'?[`Tổng phần viết: ${summary.written.score}/${summary.written.max}`]:[]).join('\n');
}
