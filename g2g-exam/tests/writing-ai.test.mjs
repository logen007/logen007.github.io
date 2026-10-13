import assert from 'node:assert/strict';
import {parseWritingSuggestion,suggestWritingGrade} from '../server/src/writing-ai.js';

const parsed=parseWritingSuggestion('{"suggestedScore":12,"findings":[{"met":true,"text":"Có lời chào"},{"met":false,"text":"Thiếu câu hỏi khách sạn"}]}',10);
assert.equal(parsed.suggestedScore,10);
assert.deepEqual(parsed.findings,[{met:true,text:'Có lời chào'},{met:false,text:'Thiếu câu hỏi khách sạn'}]);
assert.throws(()=>parseWritingSuggestion('không phải JSON',10),error=>error.statusCode===502);
await assert.rejects(suggestWritingGrade({rule:'',answer:'Hallo',maxScore:10,apiKey:'key'}),error=>error.statusCode===409);
await assert.rejects(suggestWritingGrade({rule:'Chấm lời chào',answer:'Hallo',maxScore:10,apiKey:'',fetchImpl:async()=>null}),error=>error.statusCode===503);
const suggestion=await suggestWritingGrade({rule:'Lời chào 1đ',answer:'Hallo',maxScore:10,apiKey:'key',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"suggestedScore":1,"findings":[{"met":true,"text":"Có lời chào"}]}'}}]})})});
assert.deepEqual(suggestion,{suggestedScore:1,findings:[{met:true,text:'Có lời chào'}]});
console.log('Writing AI: rubric required, bounded structured suggestions and provider failures passed.');
