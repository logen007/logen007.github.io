import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
for(const band of ['excellent','good','satisfactory','sufficient','failed']){
  assert.ok(css.includes('.result-track--'+band+'>span{background:var(--score-'+band+'-fill)}'));
  assert.ok(css.includes('.score-'+band+' { background:var(--score-'+band+'-bg);'));
}
const badges=[...css.matchAll(/\.exam-(?:provider|level)\[data-(?:provider|level)="([^"]+)"\] \{ background:#([0-9a-f]{6}); color:#([0-9a-f]{6}); \}/g)];
assert.equal(badges.length,9);
assert.equal(new Set(badges.map(match=>match[2])).size,9);
const luminance=hex=>{
  const rgb=hex.match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
};
for(const [,name,bg,fg] of badges){
  assert.ok(luminance(bg)>0.7,name+' pastel background');
  assert.ok((luminance(bg)+0.05)/(luminance(fg)+0.05)>=4.5,name+' text contrast');
}
const lightScores=css.match(/:root \{ --score-[^}]+\}/)[0];
const darkScores=css.match(/:root\[data-color-mode="dark"\] \{([^}]+)\}/)[1];
for(const band of ['excellent','good','satisfactory','sufficient','failed']){
  const fill=lightScores.match(new RegExp('--score-'+band+'-fill:#([0-9a-f]{6})'))[1];
  const bg=lightScores.match(new RegExp('--score-'+band+'-bg:#([0-9a-f]{6})'))[1];
  assert.ok(luminance(fill)<luminance(bg)*0.65,band+' chart fill is stronger than badge background');
  assert.ok((luminance('f3f4f6')+0.05)/(luminance(fill)+0.05)>=3,band+' chart fill has clear contrast against a pale track');
  const darkFill=darkScores.match(new RegExp('--score-'+band+'-fill:#([0-9a-f]{6})'))[1];
  const darkBg=darkScores.match(new RegExp('--score-'+band+'-bg:#([0-9a-f]{6})'))[1];
  const darkText=darkScores.match(new RegExp('--score-'+band+':#([0-9a-f]{6})'))[1];
  assert.ok((luminance(darkFill)+0.05)/(luminance('27272e')+0.05)>=3,band+' chart fill contrasts with dark track');
  assert.ok((luminance(darkText)+0.05)/(luminance(darkBg)+0.05)>=4.5,band+' dark badge text contrast');
}
assert.ok(css.includes('conic-gradient(var(--score-excellent-fill) 0 var(--correct-angle),var(--score-failed-fill)'));
console.log('Provider and level badges: distinct pastel colors and readable text contrast passed.');
