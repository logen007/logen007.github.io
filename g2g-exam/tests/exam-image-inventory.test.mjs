import assert from 'node:assert/strict';
import './image-restoration-registry.test.mjs';
import './image-sheet.test.mjs';
import {buildExamImageInventory,canonicalImageUrl,imageSourceId,registerExamImageInventoryRoute} from '../server/src/exam-image-inventory.js';
import {examAdminHtml} from '../src/views/admin.js';

const origin='https://exam.example.test';
const exam={id:'exam',status:'draft',data:{title:'Image exam',provider:'GOETHE',level:'A1',ownerPicture:'/uploads/private-avatar.png',sections:[{id:'part',instructionBlocks:[{imageUrl:'/uploads/prompt.png'}],questionIds:['q','q']}]}},question={id:'q',imageUrl:'/uploads/shared.jpg?delivery=r2',choices:[{imageUrl:origin+'/uploads/shared.jpg'},{imageUrl:'https://cdn.example.test/diagram?id=1'}],prompt:'<img src="/uploads/text.png">',audioUrl:'/uploads/sound.mp3',aiGradingRules:'Use /uploads/private-rules.png'};
const input={origin,exams:[exam],questions:[question],generatedAt:'2026-10-19T00:00:00.000Z'};
const output=buildExamImageInventory(input);
assert.equal(output.examCount,1);assert.equal(output.assetCount,4);assert.equal(output.usages.length,5);
assert.equal(output.usages.filter(u=>u.sourceId===imageSourceId(origin+'/uploads/shared.jpg')).length,2);
assert.ok(output.assets.every(a=>a.sourceUrl.startsWith('https://')));
assert.doesNotMatch(JSON.stringify(output),/private-avatar|private-rules|sound\.mp3|correctAnswer|ownerId|ownerName/);
assert.ok(output.usages.some(u=>u.pointer==='/sections/0/instructionBlocks/0/imageUrl'));
assert.ok(output.usages.some(u=>u.pointer==='/choices/1/imageUrl'));
assert.deepEqual(buildExamImageInventory(input),output,'Repeated export has stable source identities and positions');
const extended=buildExamImageInventory({...input,exams:[exam,{id:'next',status:'draft',data:{title:'Next',sections:[{questionIds:['next-q']}]} }],questions:[question,{id:'next-q',imageUrl:'/uploads/new.png'}]});
assert.equal(extended.assetCount,5);assert.ok(output.assets.every(a=>extended.assets.some(b=>b.sourceId===a.sourceId)),'New exams only add new identities');
assert.equal(buildExamImageInventory({...input,exams:[{...exam,status:'trash'}]}).assetCount,0);
const published={...exam,status:'published',data:{...exam.data,publicationVersion:2},snapshot:{...exam.data,publicationVersion:2,sections:[{questionIds:['frozen']}],questionSnapshot:[{id:'frozen',imageUrl:'/uploads/frozen.png'}]}};
assert.deepEqual(buildExamImageInventory({...input,exams:[published]}).assets.map(a=>a.sourceUrl),[origin+'/uploads/frozen.png'],'Export current published images, never unpublished draft images');
assert.throws(()=>buildExamImageInventory({...input,exams:[{...published,snapshot:null}]}),/Missing published/);
assert.throws(()=>buildExamImageInventory({...input,questions:[]}),/Missing question/);
const embedded=buildExamImageInventory({...input,questions:[{id:'q',imageUrl:'data:image/png;base64,private-bytes'}]});
assert.equal(embedded.warnings.length,1);assert.doesNotMatch(JSON.stringify(embedded),/private-bytes/);
assert.equal(canonicalImageUrl('/uploads/a.png?delivery=r2',origin),origin+'/uploads/a.png');
assert.equal(canonicalImageUrl('/uploads/a.png?delivery=r2&v=2',origin),origin+'/uploads/a.png?v=2','Version-bearing URLs retain their version');
assert.equal(buildExamImageInventory({...input,questions:[{id:'q',imageUrl:'relative.png'}]}).assets.length,2,'Relative image fields are still inventoried');
assert.equal(buildExamImageInventory({...input,questions:[{id:'q',correctAnswer:'/uploads/private-answer.png'}]}).assets.length,1,'Answer keys are not image sources');
assert.equal(buildExamImageInventory({...input,questions:[{id:'q',prompt:'<img src="data:image/png;base64,private">'}]}).warnings.length,1);
assert.equal(canonicalImageUrl('https://cdn.example.test/a.png?v=2#hash',origin),'https://cdn.example.test/a.png?v=2');
for(const value of ['javascript:alert(1)','file:///etc/passwd','https://u:secret@example.test/a.png','/uploads/sound.mp3'])assert.equal(canonicalImageUrl(value,origin,{hint:true}),null);

let handler,queries=0,authenticated=false;
registerExamImageInventoryRoute({get:(route,fn)=>{assert.equal(route,'/api/exam-images/export');handler=fn;}},{origin,authenticate:async()=>{if(!authenticated)throw Error('Forbidden');},withTx:async fn=>fn({query:async(sql,args)=>{
  queries++;assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|FROM users|FROM attempts|FROM settings/i);
  if(sql.startsWith('SET TRANSACTION'))return {rows:[]};
  if(sql.includes('FROM exams'))return {rows:[exam]};
  assert.deepEqual(args,[['q']]);return {rows:[{id:'q',data:question}]};
}})});
const headers={},reply={header(name,value){headers[name]=value;return this;},type(value){headers.type=value;return this;},send:value=>value};
await assert.rejects(handler({},reply),/Forbidden/);assert.equal(queries,0,'Authenticate before reading any exam data');
authenticated=true;assert.equal((await handler({},reply)).assetCount,4);
assert.equal(headers['Cache-Control'],'private, no-store');assert.match(headers['Content-Disposition'],/attachment; filename="g2g-exam-images.json"/);
const previousApi=globalThis.G2G_API_BASE;
try{
  globalThis.G2G_API_BASE='/api';
  const data={exams:[],attempts:[]};
  assert.match(examAdminHtml({data,user:{role:'master'}}),/href="\/api\/exam-images\/export" download="g2g-exam-images.json">Xuất ảnh/);
  assert.doesNotMatch(examAdminHtml({data,user:{role:'teacher'}}),/exam-images\/export/);
  globalThis.G2G_API_BASE='';assert.doesNotMatch(examAdminHtml({data,user:{role:'master'}}),/exam-images\/export/,'No broken export link in local demo');
}finally{if(previousApi===undefined)delete globalThis.G2G_API_BASE;else globalThis.G2G_API_BASE=previousApi;}
console.log('Exam image inventory: stable identities, new exams, shared/nested images, published snapshots, private projection and auth-first export passed.');
