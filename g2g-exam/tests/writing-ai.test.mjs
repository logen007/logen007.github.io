import assert from 'node:assert/strict';
import {parseWritingSuggestion,suggestWritingGrade} from '../server/src/writing-ai.js';

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
console.log('Writing AI: rubric required, bounded structured suggestions and configurable provider fallback passed.');
