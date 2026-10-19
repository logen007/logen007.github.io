import assert from 'node:assert/strict';
import {parseWritingSuggestion,suggestWritingGrade} from '../server/src/writing-ai.js';
import {writingQueueState} from '../server/src/actions/settings.js';
import './provider-job-pump.test.mjs';
import {AI_PROVIDER_IDS,normalizeAiProvider} from '../src/domain/ai-providers.js';
import {aiApiKeys,setAiApiKey} from '../server/src/ai-settings.js';

assert.deepEqual(AI_PROVIDER_IDS,['groq','gemini','grok','mistral']);
assert.equal(normalizeAiProvider('cerebras'),'groq','Retired preference falls back to an active provider');
await assert.rejects(suggestWritingGrade({rule:'10đ',answer:'Hallo',maxScore:10,cerebrasApiKey:'retired-key',providerOnly:'cerebras',fetchImpl:async()=>{throw Error('Retired provider must never be called');}}),error=>error.statusCode===400);
await assert.rejects(aiApiKeys('cerebras'),error=>error.statusCode===400);
await assert.rejects(setAiApiKey('cerebras','retired-key','master'),error=>error.statusCode===400);
let activeCalls=0;
await assert.rejects(suggestWritingGrade({rule:'10đ',answer:'Hallo',maxScore:10,groqApiKey:'test',cerebrasApiKey:'retired-key',providerPreference:'cerebras',fetchImpl:async url=>{activeCalls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');return {ok:false,status:429,json:async()=>({})};}}),error=>error.statusCode===429);
assert.equal(activeCalls,1,'Quota fallback must not call retired Cerebras even when an old key is supplied');
const cerebrasQueue=writingQueueState({ai:{providerPreference:'cerebras'}}, {cerebras:{configured:true}},{rows:[{status:'completed',model:'cerebras',count:3}]},{rows:[]});
assert.equal(cerebrasQueue.providers.cerebras,undefined);assert.equal(cerebrasQueue.successfulByProvider.cerebras,undefined);
assert.equal(cerebrasQueue.jobs.completed.count,3,'Historical completed jobs remain counted');
assert.equal(cerebrasQueue.providerPreference,'groq');

const queue=writingQueueState({ai:{providerPreference:'gemini'}},{},{rows:[
  {status:'completed',model:'groq',count:4},{status:'completed',model:'gemini',count:2},
  {status:'completed',model:null,count:1},{status:'failed',model:'groq',count:3},
  {status:'queued',model:'gemini',count:1}
]},{rows:[]});
assert.deepEqual(queue.successfulByProvider,{groq:4,gemini:2,grok:0,mistral:0});
assert.equal(queue.jobs.completed.count,7,'Grouped providers must preserve the total successful-job count');
assert.deepEqual(queue.jobs.completed.models,['groq','gemini']);
assert.equal(queue.jobs.failed.count,3);

const parsed=parseWritingSuggestion('{"suggestedScore":12,"findings":[{"met":true,"text":"Có lời chào"},{"met":false,"text":"Thiếu câu hỏi khách sạn"}]}',10);
assert.equal(parsed.suggestedScore,10);
assert.deepEqual(parsed.findings,[{met:true,text:'Có lời chào'},{met:false,text:'Thiếu câu hỏi khách sạn'}]);
assert.throws(()=>parseWritingSuggestion('không phải JSON',10),error=>error.statusCode===502);
await assert.rejects(suggestWritingGrade({rule:'',answer:'Hallo',maxScore:10,groqApiKey:'key'}),error=>error.statusCode===409);
await assert.rejects(suggestWritingGrade({rule:'Chấm lời chào',answer:'Hallo',maxScore:10,groqApiKey:'',geminiApiKey:'',fetchImpl:async()=>null}),error=>error.statusCode===503);
await assert.rejects(suggestWritingGrade({rule:'Chấm lời chào',answer:'Hallo',maxScore:10,groqApiKey:'key',fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'Invalid API Key'}})})}),error=>error.statusCode===503&&/Invalid API Key/.test(error.message));
let groqBody;
const groq=await suggestWritingGrade({task:'Viết thư hỏi Touristinformation.',level:'A1',rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,groqApiKey:'key',fetchImpl:async(_url,options)=>{groqBody=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"suggestedScore":1,"findings":[{"met":true,"text":"Có lời chào"}]}'}}]})};}});
assert.deepEqual(groq,{suggestedScore:1,findings:[{met:true,text:'Có lời chào'}],model:'groq'});
assert.match(groqBody.messages[0].content,/Viết thư hỏi Touristinformation/);assert.match(groqBody.messages[0].content,/Điểm tối đa: 10/);
let calls=0;
const gemini=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,groqApiKey:'groq',geminiApiKey:'gemini',fetchImpl:async()=>{
  calls++;
  return calls===1?{ok:false,status:429,json:async()=>({})}:{ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"suggestedScore":1,"findings":[{"met":true,"text":"Có lời chào"}]}' }]}}]})};
}});
assert.deepEqual(gemini,{suggestedScore:1,findings:[{met:true,text:'Có lời chào'}],model:'gemini'});assert.equal(calls,2);
let preferredCalls=0;
const preferredGemini=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,groqApiKey:'groq',geminiApiKey:'gemini',providerPreference:'gemini',fetchImpl:async(url)=>{
  preferredCalls++;
  assert.match(url,/generativelanguage/);
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"suggestedScore":1,"findings":[]}' }]}}]})};
}});
assert.equal(preferredGemini.model,'gemini');assert.equal(preferredCalls,1);
const preferredGrok=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,grokApiKey:'grok',providerPreference:'grok',fetchImpl:async(url)=>{
  assert.match(url,/api\.x\.ai\/v1\/chat\/completions/);
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{"suggestedScore":1,"findings":[]}'}}]})};
}});
assert.equal(preferredGrok.model,'grok');
const mistralSuccess={ok:true,status:200,json:async()=>({choices:[{message:{content:'{"suggestedScore":8,"findings":[{"met":true,"text":"Đủ ý"}]}'}}]})};
const mistral=await suggestWritingGrade({task:'München',rule:'Ý chính 10đ',answer:'Hallo',maxScore:10,mistralApiKey:'test-mistral',providerPreference:'mistral',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.mistral.ai/v1/chat/completions');
  assert.equal(options.headers.authorization,'Bearer test-mistral');
  const body=JSON.parse(options.body);
  assert.equal(body.model,'mistral-small-latest');
  assert.deepEqual(body.response_format,{type:'json_object'});
  assert.match(body.messages[0].content,/München/);
  return mistralSuccess;
}});
assert.equal(mistral.model,'mistral');assert.equal(mistral.suggestedScore,8);
for(const preferred of ['groq','mistral']){
  const urls=[];
  const result=await suggestWritingGrade({rule:'Ý chính 10đ',answer:'Hallo',maxScore:10,groqApiKey:'g',mistralApiKey:'m',providerPreference:preferred,fetchImpl:async url=>{
    urls.push(url);return urls.length===1?{ok:false,status:429,json:async()=>({})}:mistralSuccess;
  }});
  assert.equal(urls.length,2);
  assert.equal(result.model,preferred==='mistral'?'groq':'mistral','Quota fallback works in both directions');
}
await assert.rejects(suggestWritingGrade({rule:'Ý 10đ',answer:'Hallo',maxScore:10,mistralApiKey:'bad',fetchImpl:async()=>({ok:false,status:401,json:async()=>({})})}),error=>error.statusCode===503&&/Mistral từ chối/.test(error.message));
await assert.rejects(suggestWritingGrade({rule:'Ý 10đ',answer:'Hallo',maxScore:10,mistralApiKey:'m',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'invalid'}}]})})}),error=>error.statusCode===502);
const mistralQueue=writingQueueState({ai:{providerPreference:'mistral'}},{mistral:{configured:true}},{rows:[{status:'completed',model:'mistral',count:4},{status:'failed',model:'mistral',count:2}]},{rows:[]});
assert.equal(mistralQueue.providerPreference,'mistral');
assert.equal(mistralQueue.providers.mistral,true);
assert.equal(mistralQueue.successfulByProvider.mistral,4);
let singleCalls=0;
await assert.rejects(suggestWritingGrade({rule:'Ý 10đ',answer:'Hallo',maxScore:10,groqApiKey:'g',mistralApiKey:'m',providerOnly:'mistral',fetchImpl:async(url,options)=>{
  singleCalls++;assert.match(url,/mistral/);assert.ok(options.signal instanceof AbortSignal);
  return {ok:false,status:429,headers:{get:()=> '120'},json:async()=>({})};
}}),error=>error.statusCode===429&&error.retryAfterMs===120000);
assert.equal(singleCalls,1,'An assigned lane never falls back into another occupied provider');
console.log('Writing AI: rubric required, bounded structured suggestions and configurable provider fallback passed.');
