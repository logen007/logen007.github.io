import assert from 'node:assert/strict';
import {parseWritingSuggestion,suggestWritingGrade} from '../server/src/writing-ai.js';

const parsed=parseWritingSuggestion('{"suggestedScore":12,"findings":[{"met":true,"text":"Có lời chào"},{"met":false,"text":"Thiếu câu hỏi khách sạn"}]}',10);
assert.equal(parsed.suggestedScore,10);
assert.deepEqual(parsed.findings,[{met:true,text:'Có lời chào'},{met:false,text:'Thiếu câu hỏi khách sạn'}]);
assert.throws(()=>parseWritingSuggestion('không phải JSON',10),error=>error.statusCode===502);
await assert.rejects(suggestWritingGrade({rule:'',answer:'Hallo',maxScore:10,groqApiKey:'key'}),error=>error.statusCode===409);
await assert.rejects(suggestWritingGrade({rule:'Chấm lời chào',answer:'Hallo',maxScore:10,groqApiKey:'',geminiApiKey:'',fetchImpl:async()=>null}),error=>error.statusCode===503);
const groq=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,groqApiKey:'key',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"suggestedScore":1,"findings":[{"met":true,"text":"Có lời chào"}]}'}}]})})});
assert.deepEqual(groq,{suggestedScore:1,findings:[{met:true,text:'Có lời chào'}],model:'groq'});
let calls=0;
const gemini=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,groqApiKey:'groq',geminiApiKey:'gemini',fetchImpl:async()=>{
  calls++;
  return calls===1?{ok:false,status:429,json:async()=>({})}:{ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"suggestedScore":1,"findings":[{"met":true,"text":"Có lời chào"}]}' }]}}]})};
}});
assert.deepEqual(gemini,{suggestedScore:1,findings:[{met:true,text:'Có lời chào'}],model:'gemini'});assert.equal(calls,2);
console.log('Writing AI: rubric required, bounded structured suggestions and Groq-to-Gemini fallback passed.');
