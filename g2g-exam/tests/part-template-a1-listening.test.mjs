import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadApprovedPartSpec} from '../src/exam-specs/spec-loader.js';
import {getA1ListeningPart1Spec} from '../src/part-templates/a1-listening-part-1/spec.js';
import {validateA1ListeningPart1} from '../src/part-templates/a1-listening-part-1/validator.js';

const questions=[1,2,3].map(n=>({id:`q${n}`,title:`Câu ${n}`,prompt:`Prompt ${n}`,audioUrl:`/audio/${n}.mp3`,choices:['A','B','C'].map(key=>({key,text:key,imageUrl:''})),correctAnswer:0,maxScore:n===3?2:1,status:'active',ownerId:'teacher-1'}));
const spec=await loadApprovedPartSpec('../../specs/goethe/a1/listening/part-01.json');
const moduleSpec=await getA1ListeningPart1Spec();
assert.deepEqual(moduleSpec,spec);

const part={id:'section-1',instruction:'Nghe và chọn đáp án đúng.',templateType:spec.template,questionIds:questions.map(q=>q.id)};
assert.equal(validateA1ListeningPart1({part,questions,spec}),true);
assert.equal(questions.reduce((sum,q)=>sum+Number(q.maxScore||0),0),4);

const badAudio=questions.map(q=>({...q}));
badAudio[0]={...badAudio[0],audioUrl:''};
assert.throws(()=>validateA1ListeningPart1({part,questions:badAudio,spec}),/audio/i);

const tooMany=Array.from({length:11},(_,index)=>({...questions[0],id:`x${index}`}));
assert.throws(()=>validateA1ListeningPart1({part:{...part,questionIds:tooMany.map(q=>q.id)},questions:tooMany,spec}),/1.*10|10 câu/i);

assert.equal(spec.audio.segmentRepeat,2);
assert.equal(spec.audio.pauseAllowed,false);
assert.equal(spec.audio.replayAllowed,false);
const editorSource=fs.readFileSync(new URL('../src/part-templates/a1-listening-part-1/editor.js',import.meta.url),'utf8');
assert.match(editorSource,/id="tplInstructionAudio"/);
assert.match(editorSource,/instructionAudioUrl:part\.instructionAudioUrl/);
assert.match(editorSource,/instructionAudioName:part\.instructionAudioName/);
console.log('✓ A1 Nghe Phần 1 dùng Part + spec trực tiếp.');
