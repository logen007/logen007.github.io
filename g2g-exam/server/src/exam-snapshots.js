// Preserve legacy attempts before authoring changes. New attempts already snapshot at start.
export async function preserveAttemptSnapshots(client,operations){
  const examIds=operations.filter(op=>op.collection==='exams').map(op=>op.id);
  const questionIds=new Set(operations.filter(op=>op.collection==='questions').map(op=>op.id));
  if(!examIds.length&&!questionIds.size)return;
  const exams=(await client.query(`SELECT * FROM exams WHERE id=ANY($1::text[]) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(data->'sections','[]'::jsonb)) AS section
    WHERE COALESCE(section->'questionIds','[]'::jsonb) ?| $2::text[]
  ) ORDER BY id FOR UPDATE`,[examIds,[...questionIds]])).rows;
  for(const row of exams){
    const ids=[...new Set((row.data.sections||[]).flatMap(section=>section.questionIds||[]))];
    if(!examIds.includes(row.id)&&!ids.some(id=>questionIds.has(id)))continue;
    const legacy=await client.query("SELECT id FROM attempts WHERE exam_id=$1 AND NOT(private_data ? 'examSnapshot')",[row.id]);
    if(!legacy.rowCount)continue;
    const questions=ids.length?(await client.query('SELECT id,data FROM questions WHERE id=ANY($1::text[])',[ids])).rows:[];
    const snapshot={...row.data,id:row.id,ownerId:row.owner_id,status:row.status,questionSnapshot:questions.map(q=>({...q.data,id:q.id})),scoringPolicyVersion:1};
    await client.query("UPDATE attempts SET private_data=private_data||$2::jsonb WHERE exam_id=$1 AND NOT(private_data ? 'examSnapshot')",[row.id,JSON.stringify({examSnapshot:snapshot})]);
  }
}
