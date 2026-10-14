import assert from 'node:assert/strict';
import {resultBadgeHtml} from '../src/ui/result-badge.js';
import {resultOutcomeHtml} from '../src/views/attempt-result.js';
const labels=[['Chưa đạt','failed'],['Đạt','passed'],['Khá','fair'],['Giỏi','good'],['Xuất sắc','excellent']];
const all=[];
for(const [label,key] of labels){
  const html=resultBadgeHtml({result:label,total:0},'published');
  assert.ok(html.includes(`data-result-state="${key}"`),'Use saved assessment, not score during animation');
  assert.ok(html.includes(`aria-label="${label}"`));
  all.push(html);
  for(const status of ['grading','ready','submitted']){
    const pending=resultBadgeHtml({result:label,total:300},status);
    assert.ok(pending.includes('data-result-state="waiting"'),'Do not expose an unpublished verdict');
    assert.ok(pending.includes('aria-label="Chờ công bố"'));
  }
}
assert.match(resultBadgeHtml({result:'sehr gut'}),/data-result-state="excellent"/);
assert.match(resultBadgeHtml({result:'gut'}),/data-result-state="good"/);
assert.match(resultBadgeHtml({result:'befriedigend'}),/data-result-state="fair"/);
assert.match(resultBadgeHtml({result:'<script>alert(1)</script>'}),/data-result-state="waiting"/);
assert.doesNotMatch(resultBadgeHtml({result:'<script>alert(1)</script>'}),/<script>/);
const ids=all.flatMap(html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
assert.equal(ids.length,new Set(ids).size,'SVG definitions must not collide');
const references=all.flatMap(html=>[...html.matchAll(/url\(#([^\)]+)\)/g)].map(match=>match[1]));
assert.ok(references.every(id=>ids.includes(id)),'Every paint and clip reference resolves');
assert.match(resultOutcomeHtml(null,'grading','Đang chấm'),/Đang chấm/);
assert.doesNotMatch(resultOutcomeHtml(null,'grading','Đang chấm'),/data-result-state="passed"/);
console.log('Result badges: saved assessments, publication privacy, legacy labels and SVG reference safety passed.');
