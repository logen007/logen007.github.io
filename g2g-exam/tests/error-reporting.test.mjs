import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Fastify from '../server/node_modules/fastify/fastify.js';
import {safeErrorRecord,errorStatus,reportSafeError,registerSafeErrorHandler} from '../server/src/error-reporting.js';
const marker='SYNTHETIC_PRIVATE_SENTINEL';
const issue=new Error('Provider token '+marker);
Object.assign(issue,{name:marker,code:marker,config:{headers:{Authorization:marker},data:{client_secret:marker}},response:{data:marker},cause:new Error(marker),detail:marker,query:marker});
issue.circular=issue;
assert.deepEqual(safeErrorRecord(issue,marker),{event:'application_failure',operation:'api_request',status:500,code:'UNCLASSIFIED'});
assert.equal(safeErrorRecord({statusCode:503,code:'ECONNRESET'},'ai_job').code,'ECONNRESET');
for(const statusCode of [undefined,0,200,399,600,NaN,Infinity,'bad',Symbol('invalid')])assert.equal(errorStatus({statusCode}),500);
for(const statusCode of [400,401,403,404,409,413,429,500,503,599])assert.equal(errorStatus({statusCode}),statusCode);
const collected=[],logger={error:(...args)=>collected.push(['error',...args]),warn:(...args)=>collected.push(['warn',...args])};
for(const operation of ['api_request','monitor_sample','attempt_expiry','media_gc','trash_gc','ai_backfill','ai_job','ai_worker','ai_recovery','email_worker']){
  reportSafeError(logger,issue,operation);assert.equal(collected.at(-1)[1].operation,operation);
}
reportSafeError(logger,{statusCode:403,message:marker});assert.equal(collected.at(-1)[0],'warn');
assert.ok(!JSON.stringify(collected).includes(marker));reportSafeError(undefined,issue);
let log='';
const app=Fastify({logger:{stream:{write(line){log+=line;}}}});
registerSafeErrorHandler(app);
app.get('/provider',async()=>{throw issue;});
app.post('/validation',async()=>{throw Object.assign(new Error('Mã không hợp lệ.'),{statusCode:400});});
try{
  const response=await app.inject({url:'/provider',headers:{authorization:marker}});
  assert.equal(response.statusCode,500);
  assert.deepEqual(response.json(),{error:'Lỗi máy chủ. Vui lòng thử lại.',code:500});
  assert.ok(!response.body.includes(marker));
  const validation=await app.inject({method:'POST',url:'/validation'});
  assert.equal(validation.statusCode,400);assert.equal(validation.json().error,'Mã không hợp lệ.');
  assert.ok(!log.includes(marker),'Provider messages, stack, causes, credentials and nested/circular fields never reach Pino');
  assert.ok(log.includes('application_failure'));
}finally{await app.close();}
for(const file of ['index.js','monitor-history.js','media-gc.js','trash-gc.js','writing-ai-queue.js','actions/grading.js']){
  const source=readFileSync(new URL('../server/src/'+file,import.meta.url),'utf8');
  assert.match(source,/reportSafeError|registerSafeErrorHandler/);
  assert.doesNotMatch(source,/(?:logger|app\.log)\??\.(?:error|warn)(?:\?\.)?\((?:error\b|\{err:error)/);
}
console.log('Safe error reporting: real Fastify/Pino credential-leak regression, nested/circular errors, generic 5xx, preserved validation and worker wiring passed; no live credentials used.');
