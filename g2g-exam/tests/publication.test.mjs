import assert from 'node:assert/strict';
import {releaseHash,publicationLabel} from '../server/src/exam-release-content.js';
import {streamPublication,publicationProgress} from '../src/ui/publication-progress.js';
const exam={id:'e',title:'Exam',sections:[{questionIds:['q']}]},questions=[{id:'q',title:'Prompt',correctAnswer:0}];
assert.equal(releaseHash(exam,questions),releaseHash({...exam,updatedAt:'later',status:'published',publicationVersion:5},questions.map(q=>({...q,usedCount:99}))));
assert.notEqual(releaseHash(exam,questions),releaseHash(exam,[{...questions[0],correctAnswer:1}]));
assert.equal(publicationLabel(1),'1.0.0');assert.equal(publicationLabel(12),'1.0.11');
const phases=[],encoder=new TextEncoder();
const fetcher=async()=>({ok:true,body:new ReadableStream({start(controller){
  const text=['checking','version','cache'].map(stage=>JSON.stringify({stage})+'\n').join('')+JSON.stringify({stage:'done',version:'1.0.2',examId:'e'})+'\n';
  const bytes=encoder.encode(text);for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();
}})});
assert.equal((await streamPublication('e',stage=>phases.push(stage),{fetcher})).version,'1.0.2');
assert.deepEqual(phases,['checking','version','cache']);
await assert.rejects(streamPublication('e',()=>{},{fetcher:async()=>({ok:true,body:new ReadableStream({start(c){c.close();}})})}),/Kết nối bị ngắt/);
await assert.rejects(streamPublication('e',()=>{},{fetcher:async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(encoder.encode('{"stage":"error","message":"Invalid exam"}\n'));c.close();}})})}),/Invalid exam/);
const saved={document:globalThis.document,setTimeout:globalThis.setTimeout};let delay,remove=0;
try{
  globalThis.document={createElement:()=>({setAttribute(){},append(){},remove(){remove++;}}),body:{append(){}}};
  globalThis.setTimeout=(fn,ms)=>{delay=ms;fn();};
  const notice=publicationProgress();notice.update('cache');notice.done('1.0.2');
  assert.equal(delay,1000);assert.equal(remove,1);
}finally{Object.assign(globalThis,saved);}
console.log('Publication: content identity, real versions, streamed stages, failures and one-second dismissal passed.');
