import {TELC_SCORING} from '../../specs/telc/scoring.js';

export function isStandardTelc(exam){
  return String(exam?.provider).toUpperCase()==='TELC'&&TELC_SCORING.levels.includes(String(exam.level).toUpperCase());
}

export function telcResult(skills){
  // Never reinterpret an incomplete/custom exam as an official 300-point test.
  if(Object.entries(TELC_SCORING.written).some(([key,max])=>skills[key]?.max!==max))return 'Chưa đủ cấu trúc điểm TELC';
  if(!skills.speaking)return 'Chờ điểm Nói';
  if(skills.speaking.max!==TELC_SCORING.oralMax)return 'Chưa đủ cấu trúc điểm TELC';
  const written=Object.keys(TELC_SCORING.written).reduce((sum,key)=>sum+skills[key].score,0);
  if(written<TELC_SCORING.writtenPass||skills.speaking.score<TELC_SCORING.oralPass)return 'nicht bestanden';
  return gradeBand(written+skills.speaking.score,TELC_SCORING.totalMax).label;
}

export function examResult(exam,skills){
  return isStandardTelc(exam)?telcResult(skills):skillPassResult(skills);
}

export function resultClass(result){
  if(['Đạt','sehr gut','gut','befriedigend','ausreichend'].includes(result))return 'passed';
  if(['Chưa đạt','Trượt','nicht bestanden'].includes(result))return 'failed';
  return '';
}

export function canonicalSkill(value=''){
  const text=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
  if(/horen|nghe|listening/.test(text))return 'listening';
  if(/lesen|doc|reading/.test(text))return 'reading';
  if(/schreiben|viet|writing/.test(text))return 'writing';
  if(/sprechen|noi|speaking/.test(text))return 'speaking';
  if(/gramm|ngu phap|sprachbausteine/.test(text))return 'grammar';
  return text.replace(/\b(teil|part|phan|bai)\s*\d+\b/g,'').trim()||'other';
}

export function skillScores(exam,questions,attempt){
  const map=questions instanceof Map?questions:new Map(questions.map(item=>[item.id,item]));
  const skills={};
  for(const section of exam.sections||[]){
    const key=canonicalSkill(section.skillKey||section.skill||section.name);
    const entry=skills[key]||={score:0,max:0};
    entry.score+=Number(attempt.sectionScores?.[section.name]||0);
    for(const id of section.questionIds||[]){
      const question=map.get(id);
      if(question&&!question.example)entry.max+=Number(question.maxScore||0);
    }
  }
  for(const [key,score] of Object.entries(attempt.manualScores||{})){
    const skill=canonicalSkill(key);
    // Pre-v2 historical records included manual marks in sectionScores already.
    const entry=skills[skill]||={score:0,max:0};
    if(attempt.scoringVersion||entry.score===0)entry.score+=Number(score||0);
  }
  if(attempt.oralScore!=null){
    skills.speaking={score:Number(attempt.oralScore),max:Number(attempt.oralMax||skills.speaking?.max||(String(exam.provider).toUpperCase()==='TELC'?75:15))};
  }
  for(const entry of Object.values(skills)){
    entry.score=Math.round(entry.score*100)/100;entry.max=Math.round(entry.max*100)/100;
  }
  return skills;
}

export function gradeBand(score,max){
  if(score==null||!Number.isFinite(Number(score))||!(max>0))return null;
  const percent=Number(score)/max*100;
  if(percent>=90)return {key:'excellent',label:'sehr gut'};
  if(percent>=80)return {key:'good',label:'gut'};
  if(percent>=70)return {key:'satisfactory',label:'befriedigend'};
  if(percent>=60)return {key:'sufficient',label:'ausreichend'};
  return {key:'failed',label:'nicht bestanden'};
}

export function skillPassResult(skills){
  const scored=Object.values(skills).filter(item=>item.max>0);
  return scored.length&&scored.every(item=>item.score+1e-9>=item.max*0.6)?'Đạt':'Chưa đạt';
}

export function filteredGradebook(data,filters={}){
  const provider=filters.provider||'GOETHE';
  const exams=new Map(data.exams.map(exam=>[exam.id,exam]));
  const rows=[];
  for(const student of data.users.filter(user=>user.role==='student')){
    if(filters.level&&(student.level||'A1.1')!==filters.level)continue;
    if(filters.classId&&student.classId!==filters.classId)continue;
    if(filters.studentId&&student.id!==filters.studentId)continue;
    const attempts=data.attempts.filter(attempt=>attempt.studentId===student.id&&attempt.status==='published'&&String(exams.get(attempt.examId)?.provider||'').toUpperCase()===provider&&(!filters.reviewerId||attempt.reviewerId===filters.reviewerId));
    attempts.sort((a,b)=>String(b.submittedAt||b.startedAt).localeCompare(String(a.submittedAt||a.startedAt))||Number(b.attemptNo)-Number(a.attemptNo));
    const attempt=attempts[0];
    if(filters.reviewerId&&!attempt)continue;
    const exam=attempt&&exams.get(attempt.examId);
    rows.push({student,attempt,exam,skills:attempt?skillScores(exam,data.questions,attempt):{},classCode:data.classes?.find(item=>item.id===student.classId)?.code||'—'});
  }
  return rows.sort((a,b)=>a.student.name.localeCompare(b.student.name,'vi'));
}
