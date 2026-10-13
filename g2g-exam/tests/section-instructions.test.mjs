import assert from 'node:assert/strict';
import {sectionInstructions,changeInstructions,instructionAudioKey} from '../src/domain/section-instructions.js';
import {createExam,updateSection,duplicateExam} from '../src/domain/exams.js';
import {partAudioSegments} from '../src/domain/part-audio.js';
import {sectionPromptHtml,examHtml} from '../src/views/student.js';
import {imageMaxWidth} from '../src/domain/question-display.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {collectAdditionalInstructions} from '../src/part-templates/default/section-instruction-editor.js';
import {seedState} from '../src/seed.js';
import {referencedUploadNames} from '../server/src/media-gc.js';

const state=structuredClone(seedState),teacher=state.users.find(u=>u.role==='teacher');
const exam=createExam(state,teacher,{title:'Prompt blocks',sections:[{id:'prompts',skill:'Nghe',skillKey:'listening',instruction:'First [img]',instructionImageUrl:'/uploads/first.jpg',instructionAudioUrl:'/uploads/first.mp3'}]});
const section=exam.sections[0];
assert.equal(sectionInstructions(section).length,1);
updateSection(state,teacher,exam.id,section.id,changeInstructions(section,0,'add'));
assert.equal(section.additionalInstructions.length,1);
assert.deepEqual(section.questionIds,[],'Adding prompts never creates or attaches questions');
updateSection(state,teacher,exam.id,section.id,{additionalInstructions:[{id:'prompt-1',text:'Second [img]',imageUrl:'/uploads/second.jpg',audioUrl:'/uploads/second.mp3',audioName:'second.mp3',imageMaxWidth:320}]});
const before=structuredClone(section);
updateSection(state,teacher,exam.id,section.id,changeInstructions(section,1,'up'));
assert.equal(section.instruction,'Second [img]');
assert.equal(section.instructionImageUrl,'/uploads/second.jpg');
assert.equal(section.instructionAudioUrl,'/uploads/second.mp3');
assert.equal(section.additionalInstructions[0].text,'First [img]');
assert.deepEqual(partAudioSegments(section,[]).map(segment=>segment.url),['/uploads/second.mp3','/uploads/first.mp3']);
assert.deepEqual(duplicateExam(state,teacher,exam.id).sections[0].additionalInstructions,section.additionalInstructions);
assert.equal(before.instruction,'First [img]','Frozen copies remain unchanged');
const html=sectionPromptHtml(section);
assert.ok(html.indexOf('Second')<html.indexOf('First'));
assert.equal((html.match(/\/uploads\/second.jpg/g)||[]).length,1);
assert.ok(!html.includes('[img]'));
const builder=renderBuilder({data:state,exam,section});
assert.equal((builder.match(/data-section-prompt=/g)||[]).length,2);
assert.equal((builder.match(/data-field="audio"/g)||[]).length,2);
assert.match(builder,/data-section-instruction-action="add"/);
assert.doesNotMatch(builder,/data-action="add-question-instruction"/);
assert.doesNotMatch(renderBuilder({data:state,exam,section:{...section,skill:'Đọc',skillKey:'reading'}}),/data-field="audio"/);
const readOnly=renderBuilder({data:state,exam,section,readOnly:true});
for(const tag of readOnly.match(/<button[^>]*data-section-instruction-action[^>]*>/g))assert.match(tag,/disabled/);

// Removing an attachment is persisted as an explicit empty value, not a fallback.
const input={dataset:{imageRemoved:'true'},files:[]};
const control={dataset:{sectionPrompt:'prompt-1'},querySelector(selector){return {'[data-prompt-image]':input,'[data-prompt-text]':{value:'Saved text'},'[data-prompt-width]':{value:'240'}}[selector];}};
const pending=new Map([[instructionAudioKey(section,'prompt-1'),{promise:Promise.resolve({url:'',name:''})}]]);
const draft=await collectAdditionalInstructions({querySelectorAll:()=>[control]},section,pending,{});
assert.equal(draft.blocks[0].imageUrl,'');assert.equal(draft.blocks[0].audioUrl,'');
assert.equal(pending.size,1,'Uploads retained until persistence succeeds');
updateSection(state,teacher,exam.id,section.id,{additionalInstructions:draft.blocks});draft.complete();
assert.equal(pending.size,0);
assert.equal(section.additionalInstructions[0].text,'Saved text');
updateSection(state,teacher,exam.id,section.id,changeInstructions(section,1,'remove'));
assert.equal(section.additionalInstructions.length,0);
assert.equal(section.instructionImageUrl,'/uploads/second.jpg');
const references=await referencedUploadNames({query:async sql=>({rows:sql==='SELECT data FROM exams'?[{data:{sections:[before]}}]:[]})});
assert.ok(references.has('second.jpg'));assert.ok(references.has('second.mp3'),'Additional prompt media is protected from garbage collection');
console.log('Independent section prompts: add, move, remove, media, copy, render, save and read-only passed.');
{
  const questions=[1,2,3,4].map(n=>({id:'position-'+n,type:'single',title:'Question '+n,choices:['Yes','No'],maxScore:1,audioUrl:n===3?'':'/q'+n+'.mp3'}));
  const part={id:'position',name:'Nghe 3',skill:'Nghe',skillKey:'listening',questionIds:questions.map(q=>q.id),instruction:'Intro',additionalInstructions:[{id:'prompt-1',text:'Between three and four',imageUrl:'/between.jpg',audioUrl:'/between.mp3',afterQuestion:3}],questionProfile:{layout:'choices'}};
  const paper={id:'positions',provider:'TELC',level:'B1',title:'Positions',sections:[part]};
  for(const preview of [false,true]){
    const html=examHtml({exam:paper,attempt:{answers:{}},sectionIndex:0,questions,allQuestions:questions,online:true,preview});
    assert.ok(html.indexOf('Question 3')<html.indexOf('Between three and four'));
    assert.ok(html.indexOf('Between three and four')<html.indexOf('Question 4'));
    assert.equal(html.split('/between.jpg').length-1,1);
  }
  assert.deepEqual(partAudioSegments(part,questions).map(s=>s.url),['/q1.mp3','/q2.mp3','/between.mp3','/q4.mp3'],'Prompt audio retains its position even after a question with no recording');
  assert.match(sectionPromptHtml({...part,instructionImageUrl:'/writing.jpg',instructionImageMaxWidth:1}),/writing.jpg/);
  assert.doesNotMatch(sectionPromptHtml({...part,instructionImageUrl:'/writing.jpg',instructionImageMaxWidth:1}),/max-width:1px/);
  assert.equal(imageMaxWidth(1),null);
  assert.equal(imageMaxWidth(600),600);
  assert.match(renderBuilder({data:{questions},exam:paper,section:part}),/data-tooltip="Chiều rộng tối đa/);
}
