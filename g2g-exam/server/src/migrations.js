const LEGACY_QUESTION_KEYS=['groupId','groupType','groupOrder','groupInstruction','groupAudioPolicy','deletedByGroupId'];

const clone=value=>structuredClone(value??{});
const ids=value=>new Set(Array.isArray(value)?value:[]);
const overlapCount=(a,b)=>{let n=0;for(const id of a)if(b.has(id))n++;return n;};

function bestGroupForSection(groups,section){
  const sectionIds=ids(section?.questionIds);let best=null,bestScore=0;
  for(const group of groups){
    const data=group.data||{},overlap=overlapCount(sectionIds,ids(data.questionIds));
    if(!overlap)continue;
    const templateMatch=section?.templateType&&data.structureType===section.templateType?10:0;
    const partMatch=Number(section?.partOrder||0)&&Number(section.partOrder)===Number(data.partOrder||0)?1:0;
    const score=overlap*100+templateMatch+partMatch;
    if(score>bestScore){best=group;bestScore=score;}
  }
  return best;
}

function bestSectionForGroup(exam,group){
  const groupIds=ids(group?.data?.questionIds);let best=null,bestScore=0;
  for(const section of exam?.data?.sections||[]){
    const overlap=overlapCount(groupIds,ids(section.questionIds));if(!overlap)continue;
    const templateMatch=section.templateType&&group?.data?.structureType===section.templateType?10:0;
    const partMatch=Number(section.partOrder||0)&&Number(section.partOrder)===Number(group?.data?.partOrder||0)?1:0;
    const score=overlap*100+templateMatch+partMatch;
    if(score>bestScore){best=section;bestScore=score;}
  }
  return best;
}

export function migrateRetiredQuestionGroupData({groups=[],exams=[],questions=[],attempts=[]}={}){
  const migratedExams=exams.map(row=>({ ...row, data:clone(row.data) }));
  const migratedQuestions=questions.map(row=>({ ...row, data:clone(row.data) }));
  const migratedAttempts=attempts.map(row=>({ ...row, public_data:clone(row.public_data) }));
  const examById=new Map(migratedExams.map(row=>[row.id,row]));

  for(const exam of migratedExams){
    for(const section of exam.data?.sections||[]){
      if(String(section.instruction||'').trim())continue;
      const group=bestGroupForSection(groups,section);
      const instruction=String(group?.data?.instruction||'').trim();
      if(instruction)section.instruction=instruction;
    }
  }

  for(const question of migratedQuestions){
    for(const key of LEGACY_QUESTION_KEYS)delete question.data[key];
  }

  const groupsById=new Map(groups.map(group=>[group.id,group]));
  for(const attempt of migratedAttempts){
    const sessions=clone(attempt.public_data?.audioSessions||{}),exam=examById.get(attempt.exam_id);let changed=false;
    for(const [groupId,group] of groupsById){
      const legacy=sessions[groupId];if(!legacy)continue;
      const section=bestSectionForGroup(exam,group);
      if(section?.id&&!sessions[section.id])sessions[section.id]=legacy;
      delete sessions[groupId];changed=true;
    }
    if(changed)attempt.public_data.audioSessions=sessions;
  }

  return {exams:migratedExams,questions:migratedQuestions,attempts:migratedAttempts};
}

export async function migrateRetiredQuestionGroups(client){
  const exists=await client.query(`SELECT to_regclass('public.question_groups') AS name`);
  if(!exists.rows[0]?.name)return {migrated:false};

  const groups=(await client.query(`SELECT id,data FROM question_groups`)).rows;
  const exams=(await client.query(`SELECT id,data FROM exams`)).rows;
  const questions=(await client.query(`SELECT id,data FROM questions`)).rows;
  const attempts=(await client.query(`SELECT id,exam_id,public_data FROM attempts`)).rows;
  const out=migrateRetiredQuestionGroupData({groups,exams,questions,attempts});

  for(const row of out.exams)await client.query(`UPDATE exams SET data=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(row.data)]);
  for(const row of out.questions)await client.query(`UPDATE questions SET data=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(row.data)]);
  for(const row of out.attempts)await client.query(`UPDATE attempts SET public_data=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(row.public_data)]);
  await client.query(`DROP TABLE question_groups`);
  console.info(`Migrated and removed retired question_groups table (${groups.length} rows).`);
  return {migrated:true,groups:groups.length};
}
