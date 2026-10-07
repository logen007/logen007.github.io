import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'g2g-exam');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const replaceOnce=(source,from,to,label)=>{
  if(!source.includes(from))throw new Error(`Missing expected block: ${label}`);
  return source.replace(from,to);
};

// 1) One-time/idempotent DB migration: move any useful legacy data to Part/Question/Attempt, then drop table.
write('server/src/migrations.js',`const LEGACY_QUESTION_KEYS=['groupId','groupType','groupOrder','groupInstruction','groupAudioPolicy','deletedByGroupId'];

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
  const exists=await client.query(\`SELECT to_regclass('public.question_groups') AS name\`);
  if(!exists.rows[0]?.name)return {migrated:false};

  const groups=(await client.query(\`SELECT id,data FROM question_groups\`)).rows;
  const exams=(await client.query(\`SELECT id,data FROM exams\`)).rows;
  const questions=(await client.query(\`SELECT id,data FROM questions\`)).rows;
  const attempts=(await client.query(\`SELECT id,exam_id,public_data FROM attempts\`)).rows;
  const out=migrateRetiredQuestionGroupData({groups,exams,questions,attempts});

  for(const row of out.exams)await client.query(\`UPDATE exams SET data=$2::jsonb WHERE id=$1\`,[row.id,JSON.stringify(row.data)]);
  for(const row of out.questions)await client.query(\`UPDATE questions SET data=$2::jsonb WHERE id=$1\`,[row.id,JSON.stringify(row.data)]);
  for(const row of out.attempts)await client.query(\`UPDATE attempts SET public_data=$2::jsonb WHERE id=$1\`,[row.id,JSON.stringify(row.public_data)]);
  await client.query(\`DROP TABLE question_groups\`);
  console.info(\`Migrated and removed retired question_groups table (\${groups.length} rows).\`);
  return {migrated:true,groups:groups.length};
}
`);

// 2) Run schema + migration in one transaction on startup.
let db=read('server/src/db.js');
db=replaceOnce(db,"import { DEFAULT_SETTINGS,mergeSettings } from './defaults.js';","import { DEFAULT_SETTINGS,mergeSettings } from './defaults.js';\nimport {migrateRetiredQuestionGroups} from './migrations.js';",'db migration import');
db=replaceOnce(db,`export async function initDb(){\n  const here=path.dirname(fileURLToPath(import.meta.url));\n  const sql=await fs.readFile(path.resolve(here,'../schema.sql'),'utf8');\n  await pool.query(sql);\n  await pool.query(\`INSERT INTO settings(id,data) VALUES('global',$1::jsonb) ON CONFLICT(id) DO NOTHING\`,[JSON.stringify(DEFAULT_SETTINGS)]);\n}`,
`export async function initDb(){\n  const here=path.dirname(fileURLToPath(import.meta.url));\n  const sql=await fs.readFile(path.resolve(here,'../schema.sql'),'utf8');\n  const client=await pool.connect();\n  try{\n    await client.query('BEGIN');\n    await client.query(sql);\n    await migrateRetiredQuestionGroups(client);\n    await client.query(\`INSERT INTO settings(id,data) VALUES('global',$1::jsonb) ON CONFLICT(id) DO NOTHING\`,[JSON.stringify(DEFAULT_SETTINGS)]);\n    await client.query('COMMIT');\n  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}\n}`,'initDb');
write('server/src/db.js',db);

// 3) New installations no longer create the retired table.
let schema=read('server/schema.sql');
schema=schema.replace(/\nCREATE TABLE IF NOT EXISTS question_groups \([\s\S]*?CREATE INDEX IF NOT EXISTS question_groups_status_idx ON question_groups\(status\);\n/,'\n');
if(schema.includes('question_groups'))throw new Error('schema still contains question_groups');
write('server/schema.sql',schema);

// 4) Remove cached-client compatibility endpoints and legacy session keys.
let attempts=read('server/src/actions/attempts.js');
const finalAudio=`async function partAudioContext(client,attempt,sectionId){\n  const exam=await examById(attempt.exam_id,client);\n  const section=(exam.sections||[]).find(item=>item.id===sectionId);\n  if(!section)throw appError(404,'Không tìm thấy Part audio.');\n  if(attempt.public_data?.currentSectionId!==section.id)throw appError(409,'Part audio không thuộc phần thi hiện tại.');\n  const spec=await getA1ListeningPart1Spec();\n  if(section.templateType!==spec.template)throw appError(409,'Part này không dùng template audio hiện tại.');\n  const policy=spec.audio||{};\n  if(Number(policy.maxSessions)<1||Number(policy.segmentRepeat)<1)throw appError(500,'Specification audio không hợp lệ.');\n  const allowed=new Set(attempt.public_data.currentQuestionIds||[]);\n  const ids=(section.questionIds||[]).filter(id=>allowed.has(id));\n  if(!ids.length)throw appError(409,'Part audio không có câu hỏi trong phần thi hiện tại.');\n  return section;\n}\n\nexport async function startPartAudio(user,{attemptId,sectionId}){\n  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');\n  return withTx(async client=>{\n    const result=await client.query(\`SELECT * FROM attempts WHERE id=$1 FOR UPDATE\`,[attemptId]);\n    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');\n    const attempt=result.rows[0];\n    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền phát audio của lượt thi này.');\n    const section=await partAudioContext(client,attempt,sectionId);\n    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};\n    if(sessions?.[section.id]?.startedAt)throw appError(409,'Audio của phần này đã được bắt đầu và không thể phát lại.');\n    const startedAt=now();\n    sessions[section.id]={startedAt,completedAt:null};\n    const out={...publicData,audioSessions:sessions,updatedAt:startedAt};\n    await client.query(\`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1\`,[attemptId,JSON.stringify(out)]);\n    await audit(user,'start_part_audio','attempt',attemptId,{sectionId:section.id},client);\n    return {ok:true,startedAt};\n  });\n}\n\nexport async function completePartAudio(user,{attemptId,sectionId}){\n  if(!attemptId||!sectionId)throw appError(400,'Thiếu thông tin phiên audio.');\n  return withTx(async client=>{\n    const result=await client.query(\`SELECT * FROM attempts WHERE id=$1 FOR UPDATE\`,[attemptId]);\n    if(!result.rowCount)throw appError(404,'Không tìm thấy lượt thi.');\n    const attempt=result.rows[0];\n    if(attempt.student_id!==user.id||attempt.status!=='in_progress')throw appError(403,'Không có quyền cập nhật audio của lượt thi này.');\n    const section=await partAudioContext(client,attempt,sectionId);\n    const publicData=attempt.public_data||{},sessions={...(publicData.audioSessions||{})};\n    const session=sessions[section.id];\n    if(!session?.startedAt)throw appError(409,'Phiên audio chưa được bắt đầu.');\n    if(session.completedAt)return {ok:true,completedAt:session.completedAt};\n    const completedAt=now();\n    sessions[section.id]={...session,completedAt};\n    const out={...publicData,audioSessions:sessions,updatedAt:completedAt};\n    await client.query(\`UPDATE attempts SET public_data=$2::jsonb,updated_at=now() WHERE id=$1\`,[attemptId,JSON.stringify(out)]);\n    await audit(user,'complete_part_audio','attempt',attemptId,{sectionId:section.id},client);\n    return {ok:true,completedAt};\n  });\n}\n\n`;
attempts=attempts.replace(/async function partAudioContext[\s\S]*?(?=export async function setAttemptSection)/,finalAudio);
if(attempts.includes('question_groups')||attempts.includes('startAudioGroup')||attempts.includes('completeAudioGroup'))throw new Error('legacy audio compatibility still present');
write('server/src/actions/attempts.js',attempts);

let actions=read('server/src/actions/index.js');
actions=actions.replace('startPartAudio,completePartAudio,startAudioGroup,completeAudioGroup,setAttemptSection','startPartAudio,completePartAudio,setAttemptSection');
actions=actions.replace("    case 'startAudioGroup': return startAudioGroup(user,data);\n    case 'completeAudioGroup': return completeAudioGroup(user,data);\n",'');
write('server/src/actions/index.js',actions);

// 5) Remove frontend fallbacks to the retired entity/fields.
let editor=read('src/part-templates/a1-listening-part-1/editor.js');
editor=editor.replace(/const stripLegacyGroupFields=.*?;\n/,'');
editor=editor.replace(/  const legacyGroupId=.*?\n  const legacyGroup=.*?\n/,'');
editor=editor.replace(/  const defaultScore=.*?;\n/,"  const defaultScore=Math.max(0,Number(uniformScores.length===1?uniformScores[0]:specDefaultScore)||0);\n");
editor=editor.replace("    instruction:section.instruction||legacyGroup?.instruction||originalQuestions[0]?.groupInstruction||'',","    instruction:section.instruction||'',");
editor=editor.replace('const item=stripLegacyGroupFields({','const item={');
editor=editor.replace('createdAt:q.createdAt||now,updatedAt:now});\n        ops.push','createdAt:q.createdAt||now,updatedAt:now};\n        ops.push');
if(/questionGroups|groupId|groupInstruction|groupAudioPolicy|legacyGroup/.test(editor))throw new Error('editor still contains legacy group references');
write('src/part-templates/a1-listening-part-1/editor.js',editor);

let student=read('src/part-templates/a1-listening-part-1/student.js');
student=student.replace(/  const legacyGroupId=.*?\n  const legacyGroup=.*?\n/,'');
student=student.replace("  const legacySession=legacyGroupId?attempt.audioSessions?.[legacyGroupId]:null;\n  const started=sectionSession?.startedAt||legacySession?.startedAt;\n  const instruction=section.instruction||legacyGroup?.instruction||partQuestions[0].groupInstruction||'';","  const started=sectionSession?.startedAt;\n  const instruction=section.instruction||'';");
if(/questionGroups|groupId|groupInstruction|legacyGroup|legacySession/.test(student))throw new Error('student runtime still contains legacy group references');
write('src/part-templates/a1-listening-part-1/student.js',student);

// 6) Retire dead domain module and rename the remaining Part test.
const domainPath=path.join(root,'src/domain/question-groups.js');if(fs.existsSync(domainPath))fs.unlinkSync(domainPath);
const oldTest=path.join(root,'tests/question-groups.test.mjs');
if(fs.existsSync(oldTest)){
  let partTest=fs.readFileSync(oldTest,'utf8').replace('không cần QuestionGroup domain.','dùng Part + spec trực tiếp.');
  fs.writeFileSync(path.join(root,'tests/part-template-a1-listening.test.mjs'),partTest);fs.unlinkSync(oldTest);
}
let pkg=read('package.json').replace('node tests/question-groups.test.mjs && ','node tests/part-template-a1-listening.test.mjs && node tests/migrations.test.mjs && ');write('package.json',pkg);

write('tests/migrations.test.mjs',`import assert from 'node:assert/strict';\nimport {migrateRetiredQuestionGroupData} from '../server/src/migrations.js';\n\nconst groups=[{id:'g1',data:{instruction:'Nghe và chọn.',structureType:'A1_LISTENING_PART_1',partOrder:1,questionIds:['q1','q2']}}];\nconst exams=[{id:'e1',data:{sections:[{id:'s1',templateType:'A1_LISTENING_PART_1',partOrder:1,instruction:'',questionIds:['q1','q2']}]}}];\nconst questions=[{id:'q1',data:{groupId:'g1',groupInstruction:'Nghe và chọn.',prompt:'Q1'}},{id:'q2',data:{groupAudioPolicy:{segmentRepeat:2},prompt:'Q2'}}];\nconst attempts=[{id:'a1',exam_id:'e1',public_data:{audioSessions:{g1:{startedAt:'t1',completedAt:null}}}}];\nconst out=migrateRetiredQuestionGroupData({groups,exams,questions,attempts});\nassert.equal(out.exams[0].data.sections[0].instruction,'Nghe và chọn.');\nassert.equal(out.questions[0].data.groupId,undefined);\nassert.equal(out.questions[0].data.groupInstruction,undefined);\nassert.equal(out.questions[1].data.groupAudioPolicy,undefined);\nassert.deepEqual(out.attempts[0].public_data.audioSessions,{s1:{startedAt:'t1',completedAt:null}});\nconsole.log('✓ Migration chuyển dữ liệu cũ sang Part/Question/Attempt và bỏ metadata trung gian.');\n`);

// 7) Update architecture guardrails to the final state.
let architecture=read('tests/architecture.test.mjs');
architecture=architecture.replace(/test\('Step 9A[\s\S]*?(?=test\('Media garbage collector)/,`test('A1 Nghe 1 vận hành trực tiếp bằng Part',()=>{\n  const editor=read('src/part-templates/a1-listening-part-1/editor.js');\n  const student=read('src/part-templates/a1-listening-part-1/student.js');\n  const attempts=read('server/src/actions/attempts.js');\n  const actions=read('server/src/actions/index.js');\n  assert.ok(editor.includes('sectionPatch'));\n  assert.equal(/questionGroups|groupId|groupInstruction|groupAudioPolicy/.test(editor),false);\n  assert.ok(student.includes('attempt.currentSectionId'));\n  assert.ok(student.includes("/actions/startPartAudio"));\n  assert.equal(/questionGroups|groupId|groupInstruction/.test(student),false);\n  assert.ok(attempts.includes('sessions[section.id]'));\n  assert.equal(attempts.includes('startAudioGroup'),false);\n  assert.equal(actions.includes("case 'startAudioGroup'"),false);\n});\n\ntest('Step 9B2 hoàn tất migration và loại bỏ QuestionGroup khỏi runtime/schema',()=>{\n  const schema=read('server/schema.sql'),db=read('server/src/db.js'),migration=read('server/src/migrations.js'),pkg=read('package.json');\n  assert.equal(fs.existsSync(path.join(root,'src/domain/question-groups.js')),false);\n  assert.equal(schema.includes('question_groups'),false);\n  assert.ok(db.includes('migrateRetiredQuestionGroups'));\n  assert.ok(migration.includes('DROP TABLE question_groups'));\n  assert.equal(read('server/src/actions/attempts.js').includes('question_groups'),false);\n  assert.equal(read('server/src/actions/index.js').includes('AudioGroup'),false);\n  assert.equal(pkg.includes('question-groups.test.mjs'),false);\n  assert.ok(fs.existsSync(path.join(root,'tests/part-template-a1-listening.test.mjs')));\n  assert.ok(fs.existsSync(path.join(root,'tests/migrations.test.mjs')));\n});\n\n`);
write('tests/architecture.test.mjs',architecture);

console.log('Step 9B2 source migration prepared.');
