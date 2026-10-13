import assert from 'node:assert/strict';
import {buildAttemptReview,reviewCounts} from '../src/domain/attempt-review.js';
import {attemptResultHtml,resultShareText,bindAttemptResult} from '../src/views/attempt-result.js';

const questions=[
  {id:'example',type:'single',example:true,maxScore:0,correctAnswer:0},
  {id:'a',title:'<script>evil()</script>',type:'single',maxScore:5,autoGrade:true,choices:['Ja','Nein'],correctAnswer:0},
  {id:'b',type:'single',maxScore:5,autoGrade:true,choices:['Ja','Nein'],correctAnswer:1},
  {id:'c',type:'single',maxScore:5,autoGrade:true,choices:['Ja','Nein'],correctAnswer:0},
  {id:'d',type:'writing',maxScore:10},
  {id:'form',type:'writing',writingFormVersion:1,maxScore:5,rubric:[{label:'Name',answers:['Anna'],type:'text'}]},
];
const exam={provider:'GOETHE',level:'A1',title:'Test',sections:[{name:'Đọc 1',skillKey:'reading',questionIds:['example','a','b','c']},{name:'Viết 1',skillKey:'writing',questionIds:['d','form']}]};
const attempt={id:'mine',status:'published',studentName:'An',answers:{a:0,b:0,d:'Bài viết riêng'},sectionScores:{'Đọc 1':5,'Viết 1':10},feedback:'Nhận xét riêng',reviewerName:'Cô Lan',oralScore:12,oralMax:15,result:'Chưa đạt',totalScore:27};
const make=(status='published')=>buildAttemptReview({exam,questions,attempt:{...attempt,status},student:{name:'An <x>',picture:'javascript:alert(1)'}});
const review=make(),counts=reviewCounts(review.sections.flatMap(s=>s.questions));
assert.deepEqual(counts,{total:5,objective:3,correct:1,wrong:1,blank:1});
assert.equal(review.sections[0].questions[0].number,1);
assert.equal(review.attempt.level,'A1');
const numbered=buildAttemptReview({exam:{...exam,sections:[...exam.sections,{name:'Nghe 1',skillKey:'listening',questionProfile:{numberWithinSkill:true},questionIds:['next']}]},questions:[...questions,{...questions[1],id:'next'}],attempt});
assert.equal(numbered.sections[2].questions[0].number,6);
const html=attemptResultHtml({review});
assert.match(html,/Kết quả thi A1/);assert.match(html,/An &lt;x&gt;/);assert.doesNotMatch(html,/<script>|javascript:/);
assert.match(html,/Cô Lan/);assert.match(html,/Nhận xét riêng/);assert.match(html,/Đáp án đúng/);
assert.doesNotMatch(html,/Người chấm|Chưa có thông tin người chấm/);
for(const block of html.matchAll(/<div class="result-feedback">([\s\S]*?)<div class="result-reviewer">/g)){
  assert.match(block[1],/<p>Nhận xét riêng<\/p>/);
  assert.doesNotMatch(block[1],/Nhận xét của cô|<h3>/);
}
assert.match(html,/data-result-share aria-label="Chia sẻ kết quả"/);assert.match(html,/result-tab-speaking/);
assert.match(html,/role="tabpanel"/);assert.match(html,/data-result-verdict="blank"/);
const share=resultShareText(review);assert.doesNotMatch(share,/Nhận xét riêng|Bài viết riêng|Đáp án|mine|https?:/);
for(const status of ['submitted','grading','ready','incomplete']){
  const pending=make(status);assert.equal(pending.score,null);assert.equal(pending.sections[0].questions[0].correct,status==='incomplete'?null:0);
  assert.equal(pending.sections[1].questions[1].fields[0].expected,null);
  const view=attemptResultHtml({review:pending});assert.doesNotMatch(view,/Nhận xét riêng|data-result-share aria/);
  if(status==='incomplete')assert.doesNotMatch(view,/Đáp án đúng|result-donut/);
  else{assert.match(view,/Đáp án đúng/);assert.match(view,/result-donut/);assert.match(view,/result-stats/);}
  assert.equal(resultShareText(pending),null);
}
const grammar=buildAttemptReview({exam:{...exam,sections:[{name:'Đọc 4',skillKey:'reading',questionProfile:{scoringSkill:'grammar'},questionIds:['a']}]},questions,attempt});
assert.equal(grammar.sections[0].skill,'grammar');
assert.equal(buildAttemptReview({exam,questions,attempt:{...attempt,status:'published'},privateData:{...attempt,resultSummary:{result:'Chờ điểm Nói',skills:{},total:5,complete:false}}}).score.summary.result,'Chờ điểm Nói');

// Keyboard/click tabs bind locally: no reload and exactly one panel remains visible.
const panels=Object.fromEntries(['overview','reading'].map(k=>['#result-panel-'+k,{hidden:k!=='overview'}]));
const tabs=['overview','reading'].map(k=>({dataset:{resultTab:k},attrs:{},setAttribute(a,b){this.attrs[a]=b;},focus(){this.focused=true;}}));
const root={querySelectorAll:s=>s==='[data-result-tab]'?tabs:[],querySelector:s=>panels[s]||null};
bindAttemptResult(root,{review});tabs[1].onclick();assert.equal(panels['#result-panel-reading'].hidden,false);assert.equal(panels['#result-panel-overview'].hidden,true);
tabs[1].onkeydown({key:'Home',preventDefault(){}});assert.equal(tabs[0].focused,true);assert.equal(panels['#result-panel-overview'].hidden,false);
console.log('Student results: projection, publication privacy, counts, escaping, skill tabs, keyboard and private sharing passed.');
await import('./provisional-result.test.mjs');
await import('./telc-result.test.mjs');
