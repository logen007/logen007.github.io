// Attempts touch the database row too; prefer the exam's authoring timestamp.
export function examLastEdit(exam,fallback,questionEdits){
  let edited=new Date(exam.updatedAt||fallback).getTime()||0;
  for(const section of exam.sections||[])for(const id of section.questionIds||[])edited=Math.max(edited,questionEdits.get(id)||0);
  return edited?new Date(edited).toISOString():null;
}
