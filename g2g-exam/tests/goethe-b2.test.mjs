import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
import {bindLetterAnswers,letterAnswerControl} from '../src/ui/letter-answers.js';
import {bindSplitReading} from '../src/ui/split-reading.js';
import {readingBlocksEditor,readingBlocksHtml,collectReadingBlocks} from '../src/ui/reading-blocks.js';
import {validateExamForPublish,duplicateExam,startAttempt,submitAttempt,saveManualScore} from '../src/core.js';

const state=structuredClone(seedState),teacher=state.users.find(u=>u.id==='teacher-lan'),student=state.users.find(u=>u.id==='student-a');
const exam=createExamDraft(state,teacher,{provider:'GOETHE',level:'B2',title:'B2 regression'});
const rows=s=>s.questionIds.map(id=>state.questions.find(q=>q.id===id));
exam.sections[0].readingBlocks=[{title:'Holger',text:'Land < Stadt',imageUrl:'/uploads/holger.png'},{title:'Julia',text:'Stadt',imageUrl:''}];
assert.equal(exam.sections[0].questionProfile.readingBlocks,true);
assert.match(readingBlocksHtml(exam.sections[0]),/<b>a<\/b> Holger/);
assert.match(readingBlocksHtml(exam.sections[0]),/<b>b<\/b> Julia/);
assert.match(readingBlocksHtml(exam.sections[0]),/Land &lt; Stadt/);
assert.match(readingBlocksEditor(exam.sections[0]),/data-block-image/);
assert.match(readingBlocksEditor(exam.sections[0]),/<textarea class="truong" data-block-text/);
assert.match(readingBlocksEditor(exam.sections[0]),/data-block-add/);
assert.equal(readingBlocksEditor(exam.sections[1]),'');
assert.deepEqual(await collectReadingBlocks({querySelector:()=>true,querySelectorAll:()=>exam.sections[0].readingBlocks.map(block=>({dataset:{imageUrl:block.imageUrl},querySelector:selector=>selector==='[data-block-image]'?{files:[]}:{value:selector==='[data-block-title]'?block.title:block.text}}))}),exam.sections[0].readingBlocks);
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
fields['[data-gap-title]']={value:'Die Geschichte des Fahrrads'};
gap.instructionImageUrl='/uploads/bicycle-test.png';
gap.instructionImageMaxWidth=700;
for(const key of 'abcdefgh')fields['[data-gap-option="'+key+'"]']={value:'Sentence '+key};
saveInlineGapDraft({querySelector:key=>fields[key]},state,teacher,exam,gap);
assert.equal(gapAuthorText(gap,qs),text);
assert.equal(gap.gapTitle,fields['[data-gap-title]'].value);
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
assert.match(builder,/data-gap-title/);
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.gap-article-editor \{ grid-template-columns:minmax\(0,1fr\) minmax\(0,240px\)/);
assert.match(css,/\.gap-article-editor \.gap-author-text \{ grid-column:1 \/ -1;/);
assert.match(css,/\.gap-article-editor \{ grid-template-columns:minmax\(0,1fr\) 120px;/);
assert.equal((builder.match(/data-section-image accept/g)||[]).length,1);
assert.doesNotMatch(builder,/Chèn \[a\]–\[h\] tại chỗ trống/);
assert.equal((builder.match(/data-gap-option=/g)||[]).length,9);
assert.match(builder,/\[z\]/);
const publicQuestions=qs.map(({correctAnswer,...q})=>q);
const html=examHtml({exam,attempt:{answers:{}},sectionIndex:1,questions:publicQuestions,allQuestions:state.questions,online:true});
assert.equal((html.match(/data-letter-answer/g)||[]).length,6);
assert.match(html,/Gehen wir 200 Jahre zurück/);
assert.match(html,/<option value="">10<\/option>/);
assert.match(html,/<option value="0" >a<\/option>/);
assert.doesNotMatch(html,/<b>10<\/b>|<b>_<\/b>|Beispiel:|<option value="">—/);
assert.equal((html.match(/<b>0<\/b>/g)||[]).length,2);
assert.match(letterAnswerControl(qs[0],0,'letter-select',{number:10}),/<option value="0" selected>a<\/option>/);
assert.match(letterAnswerControl(qs[0],null,'letter-select'),/<option value="">—<\/option>/);
assert.match(css,/\.inline-gap select \{ width:56px; min-width:56px; height:32px; min-height:32px;/);
assert.match(css,/\.inline-gap select \{[^}]*background-color:var\(--brand-primary\)/);
assert.ok(css.includes('.inline-gap select:has(option:checked:not([value=""]))'));
assert.ok(css.includes('background-color:color-mix(in srgb,var(--xanh) 14%,var(--mat))'));
assert.match(css,/\.inline-gap-paper \.gap-sentences p \{ font-weight:400;/);
// Both left-shorter and right-shorter layouts react to image/viewport resizing.
{
  const column=height=>({height,classes:new Set(),props:new Map(),getBoundingClientRect(){return {height:this.height};},
    get classList(){return {add:key=>this.classes.add(key),remove:key=>this.classes.delete(key)};},
    get style(){return {setProperty:(key,value)=>this.props.set(key,value),removeProperty:key=>this.props.delete(key)};}});
  const left=column(1200),right=column(300),feedback=column(0);
  let onResize,disconnected=false,removed=false,observed=[];
  const view={innerWidth:1200,innerHeight:800,ResizeObserver:class{constructor(fn){onResize=fn;}observe(el){observed.push(el);}disconnect(){disconnected=true;}},
    addEventListener(){},removeEventListener(){removed=true;}};
  const dispose=bindSplitReading({querySelectorAll:()=>[{children:[left,right,feedback]}]},view);
  assert.deepEqual(observed,[left,right]);
  assert.ok(right.classes.has('split-follow'));assert.equal(right.props.get('--split-top'),'16px');
  right.height=1600;onResize();
  assert.ok(left.classes.has('split-follow'));assert.equal(left.props.get('--split-top'),'-416px');
  assert.equal(right.classes.size,0);
  view.innerWidth=760;onResize();assert.equal(left.classes.size,0);
  view.innerWidth=1200;left.height=right.height;onResize();assert.equal(left.classes.size+right.classes.size,0);
  dispose();assert.ok(disconnected&&removed);assert.equal(left.props.size+right.props.size,0);
}
assert.doesNotMatch(html,/\[[a-hz]\]/);
assert.equal((html.match(/src="\/uploads\/bicycle-test.png"/g)||[]).length,1);
assert.ok(html.indexOf('<h2>Die Geschichte des Fahrrads</h2>')<html.indexOf('class="gap-article-image"'));
assert.ok(html.indexOf('class="gap-article-image"')<html.indexOf('class="gap-passage"'));
assert.match(html,/max-width:700px/);
assert.match(html,/inline-gap-paper exam-reading-split/);
assert.match(html,/class="gap-article writing-paper"/);
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
assert.deepEqual(copy.sections[0].readingBlocks,exam.sections[0].readingBlocks);
assert.equal(gapAuthorText(copy.sections[1],rows(copy.sections[1])),text);
assert.equal(copy.sections[1].gapTitle,gap.gapTitle);
assert.equal(copy.sections[1].instructionImageUrl,gap.instructionImageUrl);
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
