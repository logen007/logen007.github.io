import {query} from './db.js';
import {examDurationSeconds} from '../../src/domain/exam-clock.js';
import {isPrefilledQuestion} from '../../src/domain/question-display.js';

// Project in SQL: never move passages, answer keys, media or attempt snapshots
// through the catalog path, even temporarily in the application server.
export async function loadExamCatalog(user){
  const student=user.role==='student';
  const [exams,counts,attempts,classes,promotions]=await Promise.all([
    query(`SELECT e.id,e.owner_id,e.status,e.locked,e.updated_at,u.data->>'name' AS owner_name,
      jsonb_build_object('title',e.data->'title','provider',e.data->'provider','updatedAt',e.data->'updatedAt',
        'level',e.data->'level','learningLevel',e.data->'learningLevel',
        'hidden',e.data->'hidden','settings',jsonb_build_object('skillSettings',e.data->'settings'->'skillSettings'),
        'sections',coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id',s->'id','name',s->'name','skill',s->'skill','skillKey',s->'skillKey',
          'timeMinutes',s->'timeMinutes','questionIds',s->'questionIds') ORDER BY ord)
          FROM jsonb_array_elements(coalesce(e.data->'sections','[]')) WITH ORDINALITY AS parts(s,ord)),'[]')) AS data,
      CASE WHEN $3 THEN 0 ELSE (SELECT count(*)::int FROM attempts a WHERE a.exam_id=e.id AND a.status<>'abandoned') END AS attempt_count,
      EXISTS(SELECT 1 FROM exam_codes c WHERE c.exam_id=e.id AND c.expires_at>now()) AS has_codes,
      EXISTS(SELECT 1 FROM exam_codes c WHERE c.exam_id=e.id AND c.expires_at>now()
        AND NOT EXISTS(SELECT 1 FROM exam_code_uses cu WHERE cu.code_id=c.id AND cu.student_id=$1)) AS unused_codes
      FROM exams e LEFT JOIN users u ON u.id=e.owner_id
      WHERE e.status=ANY($2::text[]) ORDER BY e.updated_at DESC,e.id`,
      [user.id,student?['published']:['published','draft'],student]),
    query("SELECT id,updated_at,jsonb_build_object('example',data->'example','maxScore',data->'maxScore') AS data FROM questions WHERE status<>'trash'"),
    student?query(`SELECT id,exam_id,status,jsonb_build_object(
      'studentId',student_id,'examId',exam_id,'status',status,
      'startedAt',public_data->'startedAt','submittedAt',public_data->'submittedAt',
      'publishedAt',public_data->'publishedAt','totalScore',public_data->'totalScore',
      'result',public_data->'result') AS data
      FROM attempts WHERE student_id=$1 ORDER BY created_at DESC,id`,[user.id]):Promise.resolve({rows:[]}),
    student?query('SELECT id,code,active FROM classes WHERE active=true ORDER BY lower(code),id'):Promise.resolve({rows:[]}),
    student?query('SELECT attempt_id AS "attemptId",from_level AS "fromLevel",to_level AS "toLevel" FROM level_promotions WHERE student_id=$1 AND acknowledged_at IS NULL ORDER BY created_at',[user.id]):Promise.resolve({rows:[]})
  ]);
  const scored=new Set(counts.rows.filter(q=>!isPrefilledQuestion(q.data)).map(q=>q.id));
  const questionEdits=new Map(counts.rows.map(q=>[q.id,new Date(q.updated_at).getTime()||0]));
  return {schemaVersion:6,scope:'catalog',revision:1,users:[user],questions:[],auditLog:[],
    notifications:[],gradingRequests:[],classes:classes.rows,promotions:promotions.rows,
    attempts:attempts.rows.map(r=>({id:r.id,...r.data})),
    exams:exams.rows.map(r=>{
      const exam={...r.data,id:r.id,ownerId:r.owner_id,ownerName:r.owner_name,status:r.status,locked:r.locked};
      if(!student){
        // Starting an attempt also touches e.updated_at; prefer its authoring timestamp.
        let edited=new Date(exam.updatedAt||r.updated_at).getTime()||0;
        for(const section of exam.sections)for(const id of section.questionIds||[])edited=Math.max(edited,questionEdits.get(id)||0);
        exam.updatedAt=edited?new Date(edited).toISOString():null;
      }else delete exam.updatedAt;
      exam.questionCount=exam.sections.reduce((count,s)=>count+(s.questionIds||[]).filter(id=>scored.has(id)).length,0);
      exam.durationSeconds=examDurationSeconds(exam);
      exam.sections=exam.sections.map(({questionIds,...s})=>s);
      if(!student)exam.attemptCount=r.attempt_count;
      if(student){exam.hasActiveCodes=r.has_codes;exam.allCodesUsed=r.has_codes&&!r.unused_codes;}
      return exam;
    })};
}
