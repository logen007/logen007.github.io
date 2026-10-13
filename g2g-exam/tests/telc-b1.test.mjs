import assert from 'node:assert/strict';
import {seedState} from '../src/seed.js';
import {telcFixture} from './telc-b1-fixture.mjs';
import {getExamSpec} from '../src/exam-specs/index.js';
import {examDurationSeconds} from '../src/domain/exam-clock.js';
import {examCompletion} from '../src/domain/exam-completion.js';
import {skillScores,oralMaximum} from '../src/domain/gradebook.js';
import {manualGroups} from '../src/domain/manual-grading.js';
import {partAudioSegments} from '../src/domain/part-audio.js';
import {parseGapText,gapAuthorText,inlineGapErrors} from '../src/domain/inline-gaps.js';
import {letterAnswerError} from '../src/domain/letter-answers.js';
import {headingMatchHtml} from '../src/ui/heading-match.js';
import {sectionLabel} from '../src/ui/section-label.js';
for(const level of ['B1','B2']){
  const section={name:'Đọc 4',id:'unchanged'};
  assert.equal(sectionLabel({provider:'TELC',level},section),'SB 1');
  assert.equal(sectionLabel({provider:'TELC',level},{name:'Đọc 5'}),'SB 2');
  assert.deepEqual(section,{name:'Đọc 4',id:'unchanged'});
}
assert.equal(sectionLabel({provider:'GOETHE',level:'B1'},{name:'Đọc 4'}),'Đọc 4');
import {inlineGapsHtml} from '../src/ui/inline-gaps.js';
import {renderBuilder} from '../src/part-templates/default/builder.js';
import {saveHeadingMatchDraft,resizeHeadingOptions} from '../src/part-templates/default/heading-match-builder.js';
import {resizeGapOptions,saveInlineGapDraft,bindGapPositions} from '../src/part-templates/default/inline-gap-builder.js';
import {examHtml} from '../src/views/student.js';
import {createExamDraft} from '../src/controllers/exam-factory.js';
import {syncLetterPicker} from '../src/ui/letter-picker.js';
import {letterAnswerControl} from '../src/ui/letter-answers.js';
import {ensureExamMatchesConfiguredSpec} from '../src/controllers/exam-factory.js';
import {validateExamForPublish,duplicateExam,startAttempt,submitAttempt,saveManualScore,createExam} from '../src/core.js';
const state=structuredClone(seedState),teacher=state.users.find(u=>u.id==='teacher-lan'),student=state.users.find(u=>u.id==='student-a');
globalThis.sessionStorage={getItem:()=>null};
const {exam,rows}=telcFixture(state,teacher);
{
  const local=structuredClone(state),localExam=local.exams.find(e=>e.id===exam.id);
  const question=local.questions.find(q=>q.id===localExam.sections[1].questionIds[2]);
  assert.ok(question.instructionBlocks.length,'New reading part 2 has its initial second stimulus');
  question.instructionBlocks=[];question.prompt='';question.instructionImageUrl='';
  const saved=JSON.stringify(question);
  localExam.sections[1].questionProfile={...localExam.sections[1].questionProfile,staleLayout:true};
  for(let i=0;i<2;i++)ensureExamMatchesConfiguredSpec(local,teacher,exam.id);
  assert.equal(JSON.stringify(local.questions.find(q=>q.id===question.id)),saved,'Deleted stimulus must not be recreated during normalization');
  const reloaded=JSON.parse(JSON.stringify(local));
  ensureExamMatchesConfiguredSpec(reloaded,teacher,exam.id);
  assert.deepEqual(reloaded.questions.find(q=>q.id===question.id).instructionBlocks,[]);
  delete local.questions.find(q=>q.id===question.id).instructionBlocks;
  local.exams.find(e=>e.id===exam.id).sections[1].questionProfile.staleLayout=true;
  ensureExamMatchesConfiguredSpec(local,teacher,exam.id);
  assert.equal(local.questions.find(q=>q.id===question.id).instructionBlocks.length,1,'Legacy missing field still initializes');
}
assert.equal(getExamSpec('TELC','B1').configured,true);
assert.equal(getExamSpec('TELC','B2').configured,true);
assert.strictEqual(getExamSpec('TELC','B2').skills,getExamSpec('TELC','B1').skills,'Both levels use the same structure source');
assert.deepEqual({...getExamSpec('TELC','B2'),level:'B1'},getExamSpec('TELC','B1'));
{
  const draftState=structuredClone(seedState);
  const b2=createExamDraft(draftState,teacher,{provider:'TELC',level:'B2',title:'Shared B2'});
  assert.equal(b2.level,'B2');
  assert.deepEqual(b2.sections.map(s=>s.questionLimit),[5,5,10,10,10,5,10,5,1]);
  assert.equal(examDurationSeconds(b2),150*60);
  assert.equal(oralMaximum(b2),75);
  const maxima=skillScores(b2,draftState.questions,{});
  assert.deepEqual(Object.fromEntries(Object.entries(maxima).map(([key,v])=>[key,v.max])),{reading:75,grammar:30,listening:75,writing:45});
  for(const section of b2.sections)assert.ok(renderBuilder({data:draftState,exam:b2,section}).length);
  assert.equal(duplicateExam(draftState,teacher,b2.id).level,'B2');
}
assert.deepEqual(exam.sections.map(s=>rows(s).filter(q=>!q.example).length),[5,5,10,10,10,5,10,5,1]);
assert.deepEqual(exam.sections.map(s=>rows(s).reduce((sum,q)=>sum+q.maxScore,0)),[25,25,25,15,15,25,25,25,45]);
assert.equal(examDurationSeconds(exam),150*60);
assert.equal(oralMaximum(exam),75);
assert.deepEqual(manualGroups(exam,state.questions).map(g=>[g.key,g.max]),[['Viết 1',45]]);
assert.deepEqual(exam.sections[1].questionProfile.choices,['A','B','C'],'User correction: Reading 2 has three choices');
assert.equal(exam.sections[1].questionProfile.layout,'choices');
for(const section of exam.sections.slice(5,8)){
  assert.deepEqual(rows(section)[0].choices,['Ja','Nein']);
  assert.deepEqual(partAudioSegments(section,rows(section)).map(s=>s.repeat),[1,2]);
}
assert.equal(exam.sections[8].questionProfile.layout,'free-response');
assert.deepEqual(exam.sections[8].questionProfile.wordRange,[20,30]);
assert.deepEqual(validateExamForPublish(state,exam),[]);
const [heading,,,gap3,gapBank]=exam.sections;
const before=JSON.stringify(exam);
assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,exam.id),false);
assert.equal(JSON.stringify(exam),before);
assert.equal(gapBank.gapOptions.length,12,'Extra distractors preserved');
assert.equal(heading.headingOptions.length,10);
assert.ok(rows(heading).every(q=>q.choices.join('')==='ABCDEFGHIJ'));
const savedKeys=rows(heading).map(q=>q.correctAnswer);
const headingCards=rows(heading).map(q=>({dataset:{questionId:q.id},querySelector:selector=>({value:selector==='[data-heading-score]'?String(q.maxScore):selector==='[data-heading-answer]'?String(q.correctAnswer):q.title})}));
saveHeadingMatchDraft({querySelectorAll:()=>headingCards,querySelector:key=>({value:heading.headingOptions[Number(key.split('"')[1])]})},state,teacher,exam,heading);
assert.deepEqual(rows(heading).map(q=>q.correctAnswer),savedKeys,'Autosave must preserve the private mapping');
rows(heading).forEach((q,i)=>assert.equal(heading.headingOptions[q.correctAnswer],'Heading '+(i+5)));
const publicRows=rows(heading).map(({correctAnswer,...q})=>q);
const publicHtml=headingMatchHtml(heading,publicRows,{},0);
assert.equal((publicHtml.match(/<select /g)||[]).length,5);
assert.equal(publicHtml.split('<option value="">Überschrift wählen</option>').length-1,5);
assert.equal((renderBuilder({data:state,exam,section:heading}).match(/data-heading-score/g)||[]).length,5);
assert.match(publicHtml,/Heading 0/);assert.match(publicHtml,/Passage 0/);
assert.doesNotMatch(publicHtml,/correctAnswer|data-correct/);
assert.equal((publicHtml.match(/data-full-selection="true"/g)||[]).length,5);
const trigger={dataset:{},setAttribute(){}};
const selection={dataset:{fullSelection:'true'},value:'0',selectedOptions:[{dataset:{letter:'a'},textContent:'a. The complete selected heading'}],parentElement:{querySelector:()=>trigger},getAttribute:()=> 'Antwort'};
syncLetterPicker(selection);assert.equal(trigger.textContent,'a. The complete selected heading');
selection.selectedOptions=[{dataset:{},textContent:'1'}];selection.value='';
syncLetterPicker(selection);assert.equal(trigger.textContent,'1');assert.equal(trigger.dataset.answered,'false');
selection.dataset={};selection.value='0';selection.selectedOptions=[{dataset:{letter:'a'},textContent:'a. The complete selected heading'}];
syncLetterPicker(selection);assert.equal(trigger.textContent,'a','Other inline gap pickers remain compact');
selection.selectedOptions=[{dataset:{letter:'f',shortText:'Anzeige'},textContent:'f. Anzeige'}];
syncLetterPicker(selection);assert.equal(trigger.textContent,'Anzeige');
assert.match(letterAnswerControl(rows(gap3)[0],0,'letter-select',{optionTexts:['Anzeige']}),/data-short-text="Anzeige"/);
const compactOptions={nativeText:true,number:28,optionTexts:['nett','wiedersehen','obwohl']};
assert.match(letterAnswerControl(rows(gap3)[0],null,'letter-select',compactOptions),/width:4ch/);
assert.match(letterAnswerControl(rows(gap3)[0],0,'letter-select',compactOptions),/width:9ch/);
assert.match(letterAnswerControl(rows(gap3)[0],1,'letter-select',compactOptions),/width:16ch/);
assert.doesNotMatch(letterAnswerControl(rows(gap3)[0],0,'letter-select',{optionTexts:['A sentence too long for a compact inline field']}),/data-short-text/);
assert.deepEqual(exam.sections[2].questionProfile.choices,[...'ABCDEFGHIJKL','X']);
{
  const legacy=structuredClone(state),part=legacy.exams.find(e=>e.id===exam.id).sections[2];
  part.questionProfile.choices=[...'ABCDEFGHIJ','X'];
  const question=legacy.questions.find(q=>q.id===part.questionIds[0]);
  question.choices=[...'ABCDEFGHIJ','X'];question.correctAnswer=10;
  ensureExamMatchesConfiguredSpec(legacy,teacher,exam.id);
  assert.equal(question.choices[question.correctAnswer],'X');
  assert.ok(question.choices.includes('K')&&question.choices.includes('L'));
}
assert.equal((renderBuilder({data:state,exam,section:heading}).match(/data-heading-answer/g)||[]).length,5);
assert.equal((renderBuilder({data:state,exam,section:heading}).match(/data-heading-option=/g)||[]).length,10);
assert.equal((publicHtml.match(/data-letter="j"/g)||[]).length,5);
assert.equal((renderBuilder({data:state,exam,section:gap3}).match(/data-gap-choice=/g)||[]).length,30);
for(let i=0;i<exam.sections.length;i++){
  const html=examHtml({attempt:{answers:{}},exam,sectionIndex:i,questions:rows(exam.sections[i]),allQuestions:state.questions,online:true,preview:true});
  assert.ok(html.length>100);
  if(i===3)assert.match(html,/>SB 1<\/h1>/);
  if(i===4){
    assert.doesNotMatch(html,/exam-reading-split|gap-sentences|gap-choice-bank/);
    assert.match(html,/inline-gap-native-text/);
    assert.equal((html.match(/data-letter-answer/g)||[]).length,rows(exam.sections[i]).length);
  }
  if(i===3){
    assert.doesNotMatch(html,/exam-reading-split|gap-choice-bank|data-full-options/);
    assert.match(html,/inline-gap-native-text/);
    const b2=examHtml({attempt:{answers:{}},exam:{...exam,level:'B2'},sectionIndex:i,questions:rows(exam.sections[i]),allQuestions:state.questions,online:true,preview:true});
    assert.match(b2,/gap-choice-bank/);
    assert.match(b2,/exam-reading-split/);
  }
  if(i===4)assert.match(html,/>SB 2<\/h1>/);
  if(i===1)assert.match(html,/exam-reading-split/,'Reading 2 uses the shared split layout');
  if(i===0){
    assert.doesNotMatch(html,/exam-reading-split/);
    assert.match(html,/heading-match-question/);
    assert.equal((html.match(/class="gap-sentences heading-options"/g)||[]).length,0);
    assert.equal((html.match(/data-letter="j"/g)||[]).length,5,'All choices remain in each answer picker');
    const b2=examHtml({attempt:{answers:{}},exam:{...exam,level:'B2'},sectionIndex:i,questions:rows(exam.sections[i]),allQuestions:state.questions,online:true,preview:true});
    assert.match(b2,/exam-reading-split/,'B2 presentation is unchanged');
    assert.match(b2,/heading-options/);
  }
  if(i===8)assert.match(html,/lined-writing-paper/);
}
assert.match(renderBuilder({data:state,exam,section:gapBank}),/data-gap-options/);
for(const section of [gap3,gapBank]){
  const editor=renderBuilder({data:state,exam,section});
  assert.doesNotMatch(editor,/data-gap-option="z"|Nhập đoạn văn có \[z\]/);
  assert.doesNotMatch(inlineGapsHtml(section,rows(section),{},20),/gap-demo|<b>0<\/b>/);
  assert.deepEqual(inlineGapErrors(section),[]);
}
assert.equal((renderBuilder({data:state,exam,section:gapBank}).match(/data-gap-option="/g)||[]).length,12);
const previousKeys=rows(gapBank).map(q=>q.correctAnswer);
resizeGapOptions(state,teacher,exam.id,gapBank.id,'add');
{
  const local=structuredClone(state);
  const section=()=>local.exams.find(e=>e.id===exam.id).sections.find(s=>s.id===gapBank.id);
  const mapped=()=>section().questionIds.map(id=>{const q=local.questions.find(q=>q.id===id);return section().gapOptions[q.correctAnswer];});
  const before=mapped(),originalOptions=[...section().gapOptions];
  resizeGapOptions(local,teacher,exam.id,gapBank.id,'add',1);
  assert.equal(section().gapOptions[2],'');
  assert.deepEqual(mapped(),before,'Insert in the middle preserves correct answer content');
  resizeGapOptions(local,teacher,exam.id,gapBank.id,'remove',2);
  assert.deepEqual(section().gapOptions,originalOptions);
  assert.deepEqual(mapped(),before,'Removing the inserted row restores original answer mapping');
  const used=local.questions.find(q=>q.id===section().questionIds[0]).correctAnswer;
  assert.throws(()=>resizeGapOptions(local,teacher,exam.id,gapBank.id,'remove',used),/đang được dùng/);
  const markup=renderBuilder({data:local,exam:local.exams.find(e=>e.id===exam.id),section:section()});
  assert.equal((markup.match(/data-gap-resize="add"/g)||[]).length,originalOptions.length);
  assert.equal((markup.match(/data-gap-resize="remove"/g)||[]).length,originalOptions.length);
}
assert.equal(gapBank.gapOptions.length,13);
resizeGapOptions(state,teacher,exam.id,gapBank.id,'remove');
assert.equal(gapBank.gapOptions.length,12);
assert.deepEqual(rows(gapBank).map(q=>q.correctAnswer),previousKeys);
const legacyGap={...gapBank,gapExample:'Old text',gapPassage:[{example:true},...gapBank.gapPassage]};
assert.ok(gapAuthorText(legacyGap,rows(gapBank)).startsWith('Old text'));
assert.doesNotMatch(gapAuthorText(legacyGap,rows(gapBank)),/\[z\]/);
const gapHtml=inlineGapsHtml(gap3,rows(gap3),{},20);
const shortPicker=letterAnswerControl(rows(gap3)[0],1,'letter-select',{number:21,optionTexts:['FÜR','NACH','c']});
assert.doesNotMatch(shortPicker,/data-full-options/);
assert.match(shortPicker,/data-option-texts/);
assert.match(shortPicker,/>b\. NACH<\/option>/);
assert.match(letterAnswerControl(rows(gap3)[0],null,'letter-select',{optionTexts:['A very long sentence that must still wrap inside the existing accessible dialog.']}),/data-full-options/);
const stimulusQuestions=structuredClone(rows(exam.sections[1]));
stimulusQuestions[0].instructionBlocks=[{text:'First passage',imageUrl:'first-stimulus.jpg'}];
stimulusQuestions[2].instructionBlocks=[{text:'Second passage',imageUrl:'second-stimulus.jpg'}];
for(const preview of [false,true]){
  const html=examHtml({attempt:{answers:{}},exam,sectionIndex:1,questions:stimulusQuestions,allQuestions:state.questions,online:true,preview});
  const groups=html.split('<div class="exam-reading-split exam-stimulus-group" data-responsive-stimuli>').slice(1);
  assert.equal(groups.length,1,'All passages and questions float as two whole columns');
  for(const [index,image] of ['first-stimulus.jpg','second-stimulus.jpg'].entries()){
    assert.ok(groups[0].indexOf(image)<groups[0].indexOf('<section class="to-thi"'));
    assert.equal(html.split(image).length-1,1,'Stimulus image is not duplicated');
  }
  for(const q of stimulusQuestions)assert.equal(html.split('name="answer-'+q.id+'"').length-1,3,'All answer controls preserved');
}
assert.match(gapHtml,/inline-gap-paper exam-reading-split/);
const oldLayoutExam=structuredClone(exam);
delete oldLayoutExam.sections[3].questionProfile.gapSplitLayout;
for(const preview of [false,true]){
  const html=examHtml({attempt:{answers:{}},exam:oldLayoutExam,sectionIndex:3,questions:rows(gap3),allQuestions:state.questions,online:true,preview});
  assert.doesNotMatch(html,/exam-reading-split|gap-choice-bank/,'Existing B1 Reading 4 uses the compact layout');
  assert.match(html,/inline-gap-native-text/);
}
assert.equal(oldLayoutExam.sections[3].questionProfile.gapSplitLayout,undefined,'Rendering must not mutate saved exam data');
const bankHtml=inlineGapsHtml(gapBank,rows(gapBank),{},30);
assert.match(bankHtml,/<b>a<\/b><span>Word 0<\/span>/);
for(const section of [gap3,gapBank]){
  const editor=renderBuilder({data:state,exam,section});
  assert.match(editor,/aria-describedby="gap-help-/);
  assert.match(editor,/class="gap-author-help"/);
  assert.ok(editor.indexOf('gap-author-help')>editor.indexOf('data-gap-text'));
}
assert.equal((gapHtml.match(/class="gap-choice-group"/g)||[]).length,10);
assert.match(gapHtml,/<b>21\.<\/b>/);
assert.match(gapHtml,/<b>30\.<\/b>/);
assert.ok(gapHtml.indexOf('gap-choice-bank')>gapHtml.indexOf('gap-passage'));
assert.match(gapHtml,/Gap 0 choice 0/);
const gapBuilder=renderBuilder({data:state,exam,section:gap3});
{
  const handlers={},field={value:'[b]Bold[/b] '+Array.from({length:10},(_,i)=>'Text ['+String.fromCharCode(97+i)+']').join(' '),disabled:false,addEventListener:(type,fn)=>{handlers[type]=fn;},dispatchEvent:event=>handlers[event.type]?.(),focus(){}};
  const groups=Array.from({length:10},(_,i)=>({dataset:{gapPosition:String(i)},hidden:i>2}));
  const buttons=['remove','add'].map(action=>({dataset:{gapPositionAction:action},addEventListener(type,fn){this.click=fn;}}));
  bindGapPositions({querySelector:()=>field,querySelectorAll:selector=>selector==='[data-gap-position]'?groups:buttons},gap3);
  assert.equal(groups.filter(group=>!group.hidden).length,10,'Initial textarea content shows all a–j groups, even with stale stored passage');
  assert.equal(buttons[1].disabled,true);
  buttons[0].click();
  assert.equal(groups[9].hidden,true);
  assert.ok(field.value.includes('[b]Bold[/b]'),'Removing a position preserves text formatting');
  buttons[1].click();
  assert.equal(groups[9].hidden,false);
  assert.ok(field.value.endsWith('[j]'));
}
assert.match(gapBuilder,/data-gap-position-action="add"/);
assert.match(gapBuilder,/data-gap-position-action="remove"/);
assert.doesNotMatch(gapBuilder,/data-gap-title|data-section-image|sectionImageMaxWidth/,'Reading 4 has no title/image editor');
assert.match(gapBuilder,/data-gap-text/,'Reading 4 keeps its passage editor');
const reading5Builder=renderBuilder({data:state,exam,section:gapBank});
assert.match(reading5Builder,/data-gap-title/,'Reading 5 keeps its title editor');
assert.match(reading5Builder,/data-section-image/,'Reading 5 keeps its image editor');
assert.doesNotMatch(gapBuilder,/Chỗ trống/);
assert.ok(gapBuilder.includes('<legend>[a]</legend>'));
assert.ok(gapBuilder.includes('<legend>[b]</legend>'));
assert.ok(gapBuilder.includes('<legend>[d]</legend>'),'Position label is independent of correct answer');
assert.equal((gapBuilder.match(/data-gap-correct=/g)||[]).length,30);
assert.ok(gapAuthorText(gap3,rows(gap3)).includes('[j]'));
for(const invalid of [-1,undefined,null,'',1.5,3]){
  const incomplete=structuredClone(state);
  incomplete.questions.find(q=>q.id===gap3.questionIds[3]).correctAnswer=invalid;
  const html=renderBuilder({data:incomplete,exam,section:gap3});
  assert.ok(html.includes('<legend>[d]</legend>'));
  assert.doesNotMatch(html,/\[a\/b\/c\]/);
}
{
  const draft=structuredClone(state),draftExam=draft.exams.find(e=>e.id===exam.id),section=draftExam.sections[3];
  const text=gapAuthorText(section,rows(gap3));
  const root={querySelector(selector){
    if(selector==='[data-gap-text]')return {value:text};
    const choice=selector.match(/data-gap-choice="(\d+)-(\d+)"/);
    if(choice)return {value:section.gapOptions[Number(choice[1])][Number(choice[2])]};
    const correct=selector.match(/data-gap-correct="(\d+)"/);
    if(correct)return Number(correct[1])===9?null:{value:'2'};
    return null;
  }};
  saveInlineGapDraft(root,draft,teacher,draftExam,section);
  const saved=section.questionIds.map(id=>draft.questions.find(q=>q.id===id));
  assert.deepEqual(saved.map(q=>q.correctAnswer),[2,2,2,2,2,2,2,2,2,-1]);
  assert.equal(gapAuthorText(section,saved),text,'Changing correct option must not rewrite position markers');
  assert.ok(validateExamForPublish(draft,draftExam).length,'Missing correct answer must block publishing');
}
assert.equal((gapHtml.match(/<select /g)||[]).length,10);
assert.match(gapHtml,/data-unique-letters="false"/);
assert.equal(letterAnswerError(gap3,rows(gap3),Object.fromEntries(rows(gap3).map(q=>[q.id,0]))),'');
assert.match(letterAnswerError(gapBank,rows(gapBank),Object.fromEntries(rows(gapBank).map(q=>[q.id,0]))),/einmal/);
assert.deepEqual(inlineGapErrors(gapBank),[]);
assert.ok(inlineGapErrors({...gapBank,gapOptions:gapBank.gapOptions.slice(0,9)}).length);
assert.ok(inlineGapErrors({...gap3,gapOptions:[['a','b']]}).length);
assert.equal(gapAuthorText(gapBank,rows(gapBank)).includes('[j]'),true);
assert.deepEqual(parseGapText('[i]italic[/i] [u]underlined[/u] [b]bold[/b] [i] [j]',10,'abcdefghijklmnopqrstuvwxy').keys,[8,9]);
const copy=duplicateExam(state,teacher,exam.id);
const scoreCard={dataset:{questionId:copy.sections[0].questionIds[0]},querySelector:selector=>({value:selector==='[data-heading-score]'?'12.5':selector==='[data-heading-answer]'?'5':'Custom passage'})};
saveHeadingMatchDraft({querySelectorAll:()=>[scoreCard],querySelector:key=>key==='[data-heading-bank]'?{dataset:{count:10}}:{value:heading.headingOptions[Number(key.split('"')[1])]}},state,teacher,copy,copy.sections[0]);
assert.equal(rows(copy.sections[0])[0].maxScore,12.5,'Custom points survive autosave');
rows(copy.sections[1])[0].choices=['Existing a','Existing b'];
copy.sections[1].questionProfile.layout='true-false';
copy.sections[1].questionProfile.choices=['Richtig','Falsch'];
ensureExamMatchesConfiguredSpec(state,teacher,copy.id);
assert.deepEqual(rows(copy.sections[1])[0].choices,['Existing a','Existing b',''],'Add c without overwriting authored choices');
rows(copy.sections[1])[0].choices[2]='New c';
assert.deepEqual(copy.sections[0].headingOptions,heading.headingOptions);
assert.deepEqual(copy.sections[4].gapOptions,gapBank.gapOptions);
let legacyHeading=copy.sections[0];
legacyHeading.questionProfile.choices=[...'ABCDE'];
legacyHeading.headingOptions=legacyHeading.headingOptions.slice(0,5);
rows(legacyHeading).forEach((q,i)=>{q.choices=[...'ABCDE'];q.correctAnswer=i;});
const legacyText=rows(legacyHeading).map(q=>q.title);
assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,copy.id),true);
legacyHeading=copy.sections[0];
assert.deepEqual(rows(copy.sections[0]).map(q=>q.correctAnswer),[0,1,2,3,4]);
assert.deepEqual(rows(copy.sections[0]).map(q=>q.title),legacyText);
assert.deepEqual(copy.sections[0].headingOptions,heading.headingOptions.slice(0,5));
assert.deepEqual(validateExamForPublish(state,copy),[]);
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'add',0);
assert.equal(legacyHeading.headingOptions.length,6);
assert.equal(rows(legacyHeading)[0].maxScore,12.5,'Resizing options preserves points');
assert.deepEqual(rows(legacyHeading).map(q=>q.correctAnswer),[0,2,3,4,5]);
assert.ok(validateExamForPublish(state,copy).some(error=>error.includes('không để trống')));
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'remove',1);
assert.deepEqual(rows(legacyHeading).map(q=>q.correctAnswer),[0,1,2,3,4]);
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'remove',0);
assert.equal(legacyHeading.headingOptions.length,5,'Keep enough unique options for the five questions');
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'add',4);
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'remove',2);
assert.equal(rows(legacyHeading)[2].correctAnswer,-1,'Deleting a correct option requires explicit reselection');
assert.ok(validateExamForPublish(state,copy).length);
while(legacyHeading.headingOptions.length<26)resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'add',0);
resizeHeadingOptions(state,teacher,copy.id,legacyHeading.id,'add',0);
assert.equal(legacyHeading.headingOptions.length,26);
assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,copy.id),false);
assert.equal(rows(legacyHeading)[0].choices.length,26,'Reload must not truncate the extended bank');
const dynamicBuilder=renderBuilder({data:state,exam:copy,section:legacyHeading});
assert.equal((dynamicBuilder.match(/data-heading-add=/g)||[]).length,26);
assert.equal((dynamicBuilder.match(/data-heading-remove=/g)||[]).length,26);
const old=createExam(state,teacher,{provider:'TELC',level:'B1',title:'Legacy',sections:[{name:'Custom',instruction:'Keep me',questionIds:[heading.questionIds[0]]}]});
const oldBefore=JSON.stringify(old);assert.equal(ensureExamMatchesConfiguredSpec(state,teacher,old.id),false);assert.equal(JSON.stringify(old),oldBefore);
exam.status='published';
const attempt=startAttempt(state,student,exam.id);
for(const section of exam.sections)for(const q of rows(section))if(!q.example)attempt.answers[q.id]=q.type==='writing'?'Meine Antwort':q.correctAnswer;
const completion=examCompletion(exam,state.questions,attempt.answers);
assert.equal(completion.total,61);assert.equal(completion.minimum,49);
submitAttempt(state,student,attempt.id);
assert.equal(attempt.autoScore,180);
assert.throws(()=>saveManualScore(state,teacher,attempt.id,{scores:{'Viết 1':46}}),/0–45/);
saveManualScore(state,teacher,attempt.id,{scores:{'Viết 1':45}});
const scores=skillScores(exam,state.questions,attempt);
assert.deepEqual(Object.fromEntries(Object.entries(scores).map(([key,v])=>[key,v.max])),{reading:75,grammar:30,listening:75,writing:45});
console.log('TELC B1: sheet structure, inherited audio, shuffled headings, per-gap choices, variable bank, save/reload, grading and migration safety passed.');
