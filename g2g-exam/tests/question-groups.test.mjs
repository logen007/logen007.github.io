import assert from 'node:assert/strict';
import {
  createQuestionGroup,updateQuestionGroup,groupTotalScore,
  QUESTION_GROUP_TYPES,DEFAULT_AUDIO_POLICY
} from '../src/core.js';

const user={id:'teacher-1',name:'Giáo viên',role:'teacher'};
const questions=[1,2,3].map((n)=>({id:`q${n}`,title:`Câu ${n}`,maxScore:n===3?2:1,status:'active',ownerId:user.id}));
const state={users:[user],questionGroups:[],questions,exams:[],attempts:[],gradingRequests:[],notifications:[],auditLog:[]};

const group=createQuestionGroup(state,user,{
  id:'g1',level:'A1',skill:'Nghe',skillKey:'listening',part:'Phần 1',partOrder:1,
  title:'A1 · Nghe · Phần 1',instruction:'Nghe và chọn đáp án đúng.',
  structureType:QUESTION_GROUP_TYPES.A1_LISTENING_PART_1,
  audioPolicy:{...DEFAULT_AUDIO_POLICY},defaultScore:1,questionIds:['q1','q2','q3']
});
assert.equal(group.questionIds.length,3);
assert.equal(groupTotalScore(group,state),4);

updateQuestionGroup(state,user,'g1',{defaultScore:1.5});
assert.equal(state.questionGroups[0].defaultScore,1.5);

assert.throws(()=>createQuestionGroup({...state,questionGroups:[]},user,{
  level:'A1',skill:'Nghe',partOrder:1,structureType:QUESTION_GROUP_TYPES.A1_LISTENING_PART_1,
  audioPolicy:{...DEFAULT_AUDIO_POLICY,segmentRepeat:1},questionIds:['q1']
}),/audio|A1 Nghe Phần 1/i);

assert.throws(()=>createQuestionGroup({...state,questionGroups:[]},user,{
  level:'A1',skill:'Nghe',partOrder:1,structureType:QUESTION_GROUP_TYPES.A1_LISTENING_PART_1,
  audioPolicy:{...DEFAULT_AUDIO_POLICY},questionIds:Array.from({length:11},(_,i)=>`x${i}`)
}),/1 đến 10/i);

console.log('✓ Cụm A1 Nghe Phần 1: 1–10 câu, điểm linh hoạt và audio policy đã khóa.');
