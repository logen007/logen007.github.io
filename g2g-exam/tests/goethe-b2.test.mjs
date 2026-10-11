import assert from 'node:assert/strict';
import {seedState} from '../src/seed.js';
import {createExamDraft,ensureExamMatchesConfiguredSpec} from '../src/controllers/exam-factory.js';
import {examDurationSeconds} from '../src/domain/exam-clock.js';
import {manualGroups} from '../src/domain/manual-grading.js';
import {oralMaximum} from '../src/domain/gradebook.js';
import {partAudioQuestions,partAudioSegments} from '../src/domain/part-audio.js';
import {letterAnswerError} from '../src/domain/letter-answers.js';
import {gapAuthorText,parseGapText,inlineGapErrors} from '../src/domain/inline-gaps.js';
import {saveInlineGapDraft} from '../src/part-templates/default/inline-gap-builder.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {examHtml} from '../src/views/student.js';
import {bindLetterAnswers} from '../src/ui/letter-answers.js';
import {validateExamForPublish,duplicateExam,startAttempt,submitAttempt,saveManualScore} from '../src/core.js';

const state=structuredClone(seedState),teacher=state.users.find(u=>u.id==='teacher-lan'),student=state.users.find(u=>u.id==='student-a');
const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'B2',title:'B2 regression'});
const rows=s=>s.questionIds.map(id=>state.questions.find(q=>q.id===id));
assert.equal(exam.sections.length,11);
assert.equal(examDurationSeconds(exam),180*60);
assert.equal(oralMaximum(exam),100);
assert.deepEqual(exam.sections.map(s=>rows(s).filter(q=>!q.example).length),[9,6,6,6,3,10,6,6,8,1,1]);
assert.deepEqual(manualGroups(exam,state.questions).map(g=>[g.key,g.max]),[['Viết 1',60],['Viết 2',40]]);
for(const section of exam.sections){
  rows(section).forEach((q,i)=>{
    q.title='Question '+i;
    if(section.questionProfile.uniqueLetters)q.correctAnswer=i;
    else if(section.questionProfile.layout!=='letter-select'&&q.type==='single')q.choices=['Option A','Option B','Option C'];
  });
  if(section.audioPolicy){
    partAudioQuestions(section,rows(section)).forEach((q,i)=>q.audioUrl='/uploads/b2-'+section.id+'-'+i+'.mp3');
    const repeats={'Nghe 1':[1,2,2,2,2,2],'Nghe 2':[1,1,1,1,1,1,1],'Nghe 3':[2],'Nghe 4':[1,2,2,2,2,2,2,2,2]};
    assert.deepEqual(partAudioSegments(section,rows(section)).map(s=>s.repeat),repeats[section.name]);
  }
}
const gap=exam.sections[1],qs=rows(gap),text='Vorher [z]. Dann [d] und [a].\nWeiter [h] [b] [f] [c].';
const fields={'[data-gap-text]':{value:text},'[data-gap-option="z"]':{value:'Gehen wir 200 Jahre zurück.'}};
for(const key of 'abcdefgh')fields['[data-gap-option="'+key+'"]']={value:'Sentence '+key};
saveInlineGapDraft({querySelector:key=>fields[key]},state,teacher,exam,gap);
assert.equal(gapAuthorText(gap,qs),text);
assert.deepEqual(qs.map(q=>q.correctAnswer),[3,0,7,1,5,2]);
assert.equal(qs.some(q=>q.example),false);
assert.deepEqual(inlineGapErrors(gap),[]);
assert.deepEqual(validateExamForPublish(state,exam),[]);
assert.doesNotMatch(JSON.stringify(gap.gapPassage),/\[[a-h]\]/);
assert.throws(()=>parseGapText('[a]'.repeat(7),6),/6 ô/);
assert.equal(parseGapText('[z] [b]',6).keys.length,1);
assert.ok(inlineGapErrors({...gap,gapExample:''}).length);
assert.ok(inlineGapErrors({...gap,gapOptions:['a']}).length);
assert.ok(inlineGapErrors({...gap,gapPassage:[]}).length);
const builder=renderBuilder({data:state,exam,section:gap});
assert.match(builder,/data-gap-option="z"/);
assert.equal((builder.match(/data-gap-option=/g)||[]).length,9);
assert.match(builder,/\[z\]/);
const publicQuestions=qs.map(({correctAnswer,...q})=>q);
const html=examHtml({exam,attempt:{answers:{}},sectionIndex:1,questions:publicQuestions,allQuestions:state.questions,online:true});
assert.equal((html.match(/data-letter-answer/g)||[]).length,6);
assert.match(html,/Gehen wir 200 Jahre zurück/);
assert.match(html,/<b>10<\/b>/);
assert.doesNotMatch(html,/\[[a-hz]\]/);
const r1=exam.sections[0],r4=exam.sections[3],real=rows(r4).filter(q=>!q.example);
assert.equal(letterAnswerError(r1,rows(r1),Object.fromEntries(rows(r1).map(q=>[q.id,0]))),'');
assert.match(letterAnswerError(r4,rows(r4),{[real[0].id]:8,[real[1].id]:8}),/einmal/);
assert.equal(letterAnswerError(gap,qs,{[qs[0].id]:0}),''); // z reserves no a–h.
assert.match(letterAnswerError(gap,qs,{[qs[0].id]:0,[qs[1].id]:0}),/einmal/);
// Exercise the actual dropdown binding without opening a browser.
for(const unique of [false,true]){
  const answers={},saved=[],feedback={textContent:''};
  const controls=qs.slice(0,2).map(q=>({
    dataset:{q:q.id},tagName:'SELECT',value:'',
    options:['',...q.choices.map((_,i)=>String(i))].map(value=>({value,disabled:false})),
    querySelectorAll(){return this.options;}
  }));
  const root={querySelectorAll:()=>controls,querySelector:s=>s==='[data-letter-section]'?{dataset:{uniqueLetters:String(unique)}}:feedback};
  bindLetterAnswers(root,qs,answers,(id,value)=>saved.push([id,value]));
  controls[0].value='0';controls[0].onchange();
  assert.equal(controls[1].options[1].disabled,unique);
  controls[1].value='0';controls[1].onchange();
  assert.equal(saved.length,unique?1:2);
  controls[0].value='';controls[0].onchange();
  assert.equal(controls[1].options[1].disabled,false);
}
const originalPassage=structuredClone(gap.gapPassage);
fields['[data-gap-text]'].value='Partial [z] [a] and [';
saveInlineGapDraft({querySelector:key=>fields[key]},state,teacher,exam,gap);
assert.equal(gapAuthorText(gap,qs),'Partial [z] [a] and [');
assert.ok(inlineGapErrors(gap).length);
fields['[data-gap-text]'].value=text;
saveInlineGapDraft({querySelector:key=>fields[key]},state,teacher,exam,gap);
assert.deepEqual(gap.gapPassage,originalPassage);
const copy=duplicateExam(state,teacher,exam.id);
assert.equal(gapAuthorText(copy.sections[1],rows(copy.sections[1])),text);
assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,exam.id),false);
const writingHtml=examHtml({exam,attempt:{answers:{}},sectionIndex:10,questions:rows(exam.sections[10]),allQuestions:state.questions,online:true});
assert.match(writingHtml,/lined-writing-paper/);
exam.status='published';
const attempt=startAttempt(state,student,exam.id);
submitAttempt(state,student,attempt.id);
assert.equal(attempt.autoScore,0);
assert.throws(()=>saveManualScore(state,teacher,attempt.id,{scores:{'Viết 2':41}}),/0–40/);
saveManualScore(state,teacher,attempt.id,{scores:{'Viết 1':50,'Viết 2':30}});
console.log('B2: structure, audio, inline gaps, demo z, answer privacy, copy, unique X and writing grades passed.');
