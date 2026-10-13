import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
for(const band of ['excellent','good','satisfactory','sufficient','failed']){
  assert.ok(css.includes('.result-track--'+band+'>span{background:var(--score-'+band+'-bg)}'));
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
console.log('Provider and level badges: distinct pastel colors and readable text contrast passed.');
