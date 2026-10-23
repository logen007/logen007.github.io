import assert from 'node:assert/strict';
import {bindLetterAnswers,letterAnswersHtml} from '../src/ui/letter-answers.js';

const questions=[{id:'foreign',example:true,choices:['Richtig','Falsch'],correctAnswer:0}];
const groups=[];
function group(prefix,{unique=true,repeatable=[]}={}){
  const rows=[{id:prefix+'-example',example:true,choices:['A','B','X'],correctAnswer:0},...['one','two'].map(id=>({id:prefix+'-'+id,choices:['A','B','X']}))];
  questions.push(...rows);
  const feedback={textContent:''},scope={dataset:{letterQuestionIds:JSON.stringify(rows.map(q=>q.id)),uniqueLetters:String(unique),repeatableLetters:repeatable.join(',')},querySelector:()=>feedback};
  const controls=rows.slice(1).map(q=>({dataset:{q:q.id},tagName:'SELECT',value:'',closest:()=>scope,
    options:['','0','1','2'].map(value=>({value,disabled:false})),querySelectorAll(){return this.options;}}));
  const result={scope,rows,controls,feedback};groups.push(result);return result;
}
const first=group('first'),second=group('second'),repeat=group('repeat',{repeatable:['X']}),shared=group('shared',{unique:false});
const answers={foreign:0},saved=[];
const root={querySelectorAll:()=>groups.flatMap(g=>g.controls),querySelector:()=>first.scope};
bindLetterAnswers(root,questions,answers,(id,value)=>saved.push([id,value]));
const choose=(control,value)=>{control.value=value;control.onchange();};
for(const g of [first,second,repeat]){
  assert.equal(g.controls[0].options[1].disabled,true,'An example reserves its letter only within its own part');
  assert.equal(g.controls[0].options[2].disabled,false,'Other parts and ordinary answers cannot lock this part');
}
choose(second.controls[0],'1');
assert.equal(second.controls[1].options[2].disabled,true);
assert.equal(first.controls[0].options[2].disabled,false,'A letter used in another part stays available');
choose(first.controls[0],'1');
assert.equal(answers['first-one'],1);assert.equal(answers['second-one'],1);
assert.equal(first.controls[1].options[2].disabled,true,'Uniqueness still applies within the part');
choose(first.controls[1],'1');
assert.match(first.feedback.textContent,/einmal/);assert.equal(second.feedback.textContent,'');
assert.equal(answers['first-two'],undefined,'An invalid duplicate is not saved');
choose(first.controls[0],'');
assert.equal(first.controls[1].options[2].disabled,false,'Clearing unlocks the choice only in its own part');
assert.equal(second.controls[1].options[2].disabled,true);
choose(repeat.controls[0],'2');choose(repeat.controls[1],'2');
assert.equal(answers['repeat-two'],2,'A repeatable X remains repeatable');
choose(shared.controls[0],'1');choose(shared.controls[1],'1');
assert.equal(answers['shared-two'],1,'Parts that allow reuse remain independent');
const html=letterAnswersHtml({questionProfile:{layout:'letter-select',uniqueLetters:true}},first.rows,{},0);
assert.match(html,/data-letter-question-ids="\[&quot;first-example&quot;/,'Rendered membership includes examples');
console.log('Letter dropdown groups: part isolation, examples, clear, local feedback, repeatable and reusable letters passed.');
