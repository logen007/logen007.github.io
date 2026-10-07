import assert from 'node:assert/strict';
import {createQuestionGroup,updateQuestionGroup,groupTotalScore} from '../src/core.js';
import {loadApprovedPartSpec} from '../src/exam-specs/spec-loader.js';
import {validateA1ListeningPart1} from '../src/part-templates/a1-listening-part-1/validator.js';

const user={id:'teacher-1',name:'Giáo viên',role:'teacher'};
const questions=[1,2,3].map(n=>({id:`q${n}`,title:`Câu ${n}`,prompt:`Prompt ${n}`,audioUrl:`/audio/${n}.mp3`,choices:['A','B','C'].map(key=>({key,text:key,imageUrl:''})),correctAnswer:0,maxScore:n===3?2:1,status:'active',ownerId:user.id}));
const state={users:[user],questionGroups:[],questions,exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};
const spec=await loadApprovedPartSpec('../../specs/goethe/a1/listening/part-01.json');
const group=createQuestionGroup(state,user,{id:'g1',level:'A1',skill:'Nghe',skillKey:'listening',part:'Phần 1',partOrder:1,title:'A1 · Nghe · Phần 1',instruction:'Nghe và chọn đáp án đúng.',structureType:spec.template,audioPolicy:{...spec.audio},defaultScore:1,questionIds:['q1','q2','q3']});
assert.equal(group.questionIds.length,3);assert.equal(groupTotalScore(group,state),4);
updateQuestionGroup(state,user,'g1',{defaultScore:1.5});assert.equal(state.questionGroups[0].defaultScore,1.5);
assert.equal(validateA1ListeningPart1({group,questions,spec}),true);
const badAudio=questions.map(q=>({...q}));badAudio[0]={...badAudio[0],audioUrl:''};assert.throws(()=>validateA1ListeningPart1({group,questions:badAudio,spec}),/audio/i);
const tooMany=Array.from({length:11},(_,index)=>({...questions[0],id:`x${index}`}));assert.throws(()=>validateA1ListeningPart1({group,questions:tooMany,spec}),/1.*10|10 câu/i);
assert.equal(spec.audio.segmentRepeat,2);assert.equal(spec.audio.pauseAllowed,false);assert.equal(spec.audio.replayAllowed,false);
console.log('✓ A1 Nghe Phần 1 dùng spec chung cho validator, audio policy và điểm.');
