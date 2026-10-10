import {query,now,appError} from '../db.js';
import {skillScores,examResult} from '../../../src/domain/gradebook.js';

export const isTeacher=user=>user?.role==='teacher'||user?.role==='master';

export async function examById(id,client={query}){
  const result=await client.query(`SELECT id,owner_id,status,locked,data FROM exams WHERE id=$1`,[id]);
  if(!result.rowCount)throw appError(404,'Không tìm thấy bài thi.');
  const row=result.rows[0];
  return {id:row.id,ownerId:row.owner_id,status:row.status,locked:row.locked,...row.data};
}

export async function canGrade(user,exam){
  return Boolean(isTeacher(user)&&exam);
}

export function scoreQuestion(question,answer){
  if(!question?.autoGrade||question.example)return 0;
  if(['single','truefalse','cloze'].includes(question.type)){
    return Number(answer)===Number(question.correctAnswer)?Number(question.maxScore||0):0;
  }
  if(question.type==='matching'){
    if(!Array.isArray(answer)||!Array.isArray(question.pairs)||!question.pairs.length)return 0;
    let correct=0;
    question.pairs.forEach((pair,index)=>{if(answer[index]===pair[1])correct++;});
    return Math.round(correct/question.pairs.length*Number(question.maxScore||0)*100)/100;
  }
  return 0;
}

export function resultFor(exam,questions,sectionScores={},manualScores={}){
  return examResult(exam,skillScores(exam,questions,{sectionScores,manualScores,scoringVersion:2}));
}

export async function questionMap(exam){
  const ids=[...new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]))];
  if(!ids.length)return new Map();
  const result=await query(`SELECT id,data FROM questions WHERE id=ANY($1::text[])`,[ids]);
  return new Map(result.rows.map(row=>[row.id,{id:row.id,...row.data}]));
}

export function sectionMeta(exam,index,previous={}){
  const section=exam.sections?.[index];
  if(!section)return {sectionStates:previous,currentSectionId:null,currentQuestionIds:[],currentDeadlineMs:null};
  const states={...(previous||{})};
  let state=states[section.id];
  if(!state){
    const startedAt=now();
    const deadlineMs=Date.now()+Math.max(1,Number(section.timeMinutes||30))*60000;
    state={startedAt,deadlineAt:new Date(deadlineMs).toISOString()};
    states[section.id]=state;
  }
  return {
    sectionStates:states,
    currentSectionId:section.id,
    currentQuestionIds:[...(section.questionIds||[])],
    currentDeadlineMs:Date.parse(state.deadlineAt),
  };
}
