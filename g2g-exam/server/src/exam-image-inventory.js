import {createHash} from 'node:crypto';

const IMAGE=/\.(?:png|jpe?g|webp|gif|avif|bmp|svg|tiff?)$/i;
const OTHER_MEDIA=/\.(?:mp3|wav|m4a|ogg|mp4|webm|pdf)$/i;
const imageField=key=>/(?:^images?$|image_?urls?$)/i.test(key);
const privateMetadata=new Set(['ownerId','ownerName','ownerEmail','ownerPicture','picture','avatar','aiGradingRules','correctAnswer','acceptedAnswers','answerKey']);
const pointerPart=value=>String(value).replace(/~/g,'~0').replace(/\//g,'~1');
export const imageSourceId=url=>createHash('sha256').update(url).digest('hex');

// URL identity is not a file checksum. The restoration worker records a separate
// source SHA-256 in Sheets after downloading bytes, to reuse renamed duplicates.
export function canonicalImageUrl(value,origin,{hint=false}={}){
  let url;try{url=new URL(value.replace(/&amp;/g,'&'),origin);}catch{return null;}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  if(OTHER_MEDIA.test(url.pathname)||(!hint&&!IMAGE.test(url.pathname)))return null;
  url.hash='';
  if(url.origin===new URL(origin).origin&&/^\/uploads\/[A-Za-z0-9._-]+$/.test(url.pathname))url.searchParams.delete('delivery');
  return url.href;
}

export function buildExamImageInventory({exams,questions,origin,generatedAt=new Date().toISOString()}){
  origin=new URL(origin).origin;
  const assets=new Map(),usages=[],warnings=[],questionMap=new Map(questions.map(q=>[q.id,q]));
  const visit=(value,context,pointer='',hint=false)=>{
    if(typeof value==='string'){
      if(/data:image\//i.test(value))warnings.push({...context,pointer,reason:'embedded-image-without-url'});
      if(/^data:image\//i.test(value))return;
      const single=value.trim(),exact=hint&&(/^(?:https?:\/\/|\/)/i.test(single)||IMAGE.test(single.split(/[?#]/)[0]));
      const candidates=exact?[single]:[...value.matchAll(/(?:https?:\/\/|\/\/|\/uploads\/)[^\s<>"'()]+/gi)].map(m=>m[0]);
      const seen=new Set();
      for(const candidate of candidates){
        const sourceUrl=canonicalImageUrl(candidate,origin,{hint});
        if(!sourceUrl||seen.has(sourceUrl))continue;seen.add(sourceUrl);
        const sourceId=imageSourceId(sourceUrl);
        if(!assets.has(sourceId))assets.set(sourceId,{sourceId,sourceUrl});
        usages.push({...context,pointer,sourceId});
      }
    }else if(Array.isArray(value))value.forEach((item,i)=>visit(item,context,pointer+'/'+i,hint));
    else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))if(!privateMetadata.has(key))visit(item,context,pointer+'/'+pointerPart(key),imageField(key));
  };
  let examCount=0;
  for(const row of exams){
    if(row.status==='trash')continue;examCount++;
    if(row.status==='published'&&row.data?.publicationVersion&&!row.snapshot)throw Error('Missing published image snapshot: '+row.id);
    const content=row.status==='published'&&row.snapshot?row.snapshot:row.data;
    const {questionSnapshot,...exam}=content||{};
    const context={examId:row.id,examTitle:String(exam.title||''),provider:String(exam.provider||''),level:String(exam.level||''),examStatus:row.status,publicationVersion:row.status==='published'?exam.publicationVersion||null:null};
    visit(exam,{...context,entity:'exam',entityId:row.id});
    const snapshotQuestions=questionSnapshot?new Map(questionSnapshot.map(q=>[q.id,q])):null;
    const ids=[...new Set((exam.sections||[]).flatMap(section=>section.questionIds||[]))];
    for(const id of ids){
      const question=(snapshotQuestions||questionMap).get(id);
      if(!question)throw Error('Missing question in image inventory: '+id);
      visit(question,{...context,entity:'question',entityId:id});
    }
  }
  return {schemaVersion:1,origin,generatedAt,examCount,assetCount:assets.size,assets:[...assets.values()].sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),usages,warnings};
}

export function registerExamImageInventoryRoute(app,{authenticate,withTx,origin}){
  app.get('/api/exam-images/export',async(request,reply)=>{
    await authenticate(request);
    const inventory=await withTx(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const {rows:exams}=await client.query(`SELECT e.id,e.status,e.data,r.snapshot FROM exams e LEFT JOIN exam_releases r
        ON r.exam_id=e.id AND r.version=NULLIF(e.data->>'publicationVersion','')::integer
        WHERE e.status<>'trash' ORDER BY e.id`);
      const ids=[...new Set(exams.flatMap(e=>(e.data.sections||[]).flatMap(s=>s.questionIds||[])))];
      const {rows:questionRows}=ids.length?await client.query('SELECT id,data FROM questions WHERE id=ANY($1::text[]) ORDER BY id',[ids]):{rows:[]};
      return buildExamImageInventory({exams,questions:questionRows.map(q=>({...q.data,id:q.id})),origin});
    });
    reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff');
    reply.header('Content-Disposition','attachment; filename="g2g-exam-images.json"');
    return reply.type('application/json; charset=utf-8').send(inventory);
  });
}
