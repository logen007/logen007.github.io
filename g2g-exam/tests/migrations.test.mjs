import assert from 'node:assert/strict';
import {migrateRetiredQuestionGroupData} from '../server/src/migrations.js';

const groups=[{id:'g1',data:{instruction:'Nghe và chọn.',structureType:'A1_LISTENING_PART_1',partOrder:1,questionIds:['q1','q2']}}];
const exams=[{id:'e1',data:{sections:[{id:'s1',templateType:'A1_LISTENING_PART_1',partOrder:1,instruction:'',questionIds:['q1','q2']}]}}];
const questions=[{id:'q1',data:{groupId:'g1',groupInstruction:'Nghe và chọn.',prompt:'Q1'}},{id:'q2',data:{groupAudioPolicy:{segmentRepeat:2},prompt:'Q2'}}];
const attempts=[{id:'a1',exam_id:'e1',public_data:{audioSessions:{g1:{startedAt:'t1',completedAt:null}}}}];
const out=migrateRetiredQuestionGroupData({groups,exams,questions,attempts});
assert.equal(out.exams[0].data.sections[0].instruction,'Nghe và chọn.');
assert.equal(out.questions[0].data.groupId,undefined);
assert.equal(out.questions[0].data.groupInstruction,undefined);
assert.equal(out.questions[1].data.groupAudioPolicy,undefined);
assert.deepEqual(out.attempts[0].public_data.audioSessions,{s1:{startedAt:'t1',completedAt:null}});
console.log('✓ Migration chuyển dữ liệu cũ sang Part/Question/Attempt và bỏ metadata trung gian.');
