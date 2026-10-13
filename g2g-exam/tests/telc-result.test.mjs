import assert from 'node:assert/strict';
import {telcResultHtml,telcResultSkills} from '../src/views/telc-result.js';
import {bar,attemptResultHtml} from '../src/views/attempt-result.js';
const parts=[
  ...[0,15,0].map(score=>({skill:'reading',score,max:25,source:'automatic'})),
  ...[6,1.5].map(score=>({skill:'grammar',score,max:15,source:'automatic'})),
  ...[15,12.5,10].map(score=>({skill:'listening',score,max:25,source:'automatic'})),
  {skill:'writing',score:null,max:45,source:'ai'},
];
const review={attempt:{provider:'TELC',level:'B1',status:'grading'},provisional:{parts},sections:[]};
assert.equal(telcResultSkills(review).reading.score,15);
assert.equal(telcResultSkills(review).grammar.score,7.5);
assert.equal(telcResultSkills(review).listening.score,37.5);
let html=telcResultHtml(review,bar);
assert.match(html,/Khối thi viết/);assert.match(html,/Khối thi nói/);
assert.match(html,/class="result-track" role="img" aria-label="Khối thi nói: Chờ điểm"><\/div>/);
const pendingSpeaking=bar('Nói',null);
assert.match(pendingSpeaking,/class="result-track"/);
assert.match(pendingSpeaking,/Nói: Chờ điểm/);
assert.doesNotMatch(pendingSpeaking,/width:|0 điểm|score-badge/);
assert.doesNotMatch(html,/Mốc đạt/);
assert.equal((html.match(/class="the telc-result-card"/g)||[]).length,1);
assert.doesNotMatch(html,/class="the telc-result-block"/);
assert.match(html,/aria-label="Khối thi viết: Chờ điểm"/);
assert.match(html,/telc-result-children/);
assert.match(html,/Ngữ pháp &amp; từ vựng/);
assert.doesNotMatch(html,/score-badge|Chưa đạt|AI|60<small>/);
parts.at(-1).score=30;
html=telcResultHtml(review,bar);
assert.match(html,/90<small> \/ 225/);
assert.equal((html.match(/Tạm tính/g)||[]).length,2);
assert.doesNotMatch(telcResultHtml(review,bar,'reading'),/Tạm tính|score-badge/);
parts.at(-1).score=0;
assert.match(telcResultHtml(review,bar),/60<small> \/ 225/);
const page=attemptResultHtml({review});
assert.match(page,/data-telc-result=""/);
assert.doesNotMatch(page,/<h2>Điểm từng phần/);
const published={...review,attempt:{...review.attempt,status:'published'},provisional:null,
  score:{summary:{skills:{reading:{score:50,max:75},grammar:{score:20,max:30},listening:{score:40,max:75},writing:{score:25,max:45},speaking:{score:44,max:75}}}}};
html=telcResultHtml(published,bar);
assert.match(html,/135<small> \/ 225/);
assert.match(html,/result-correct">Đạt/);
assert.match(html,/result-wrong">Chưa đạt/);
assert.doesNotMatch(html,/Tạm tính|score-badge/);
assert.doesNotMatch(telcResultHtml(published,bar,'reading'),/Đạt|Chưa đạt/);
published.score.summary.skills.reading.max=50;
assert.doesNotMatch(telcResultHtml(published,bar),/135<small> \/ 225/);
console.log('TELC result hierarchy, independent thresholds, incomplete totals and temporary writing passed.');
