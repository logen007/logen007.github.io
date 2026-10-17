import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_PROVIDER_IDS} from '../src/domain/ai-providers.js';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
for(const band of ['excellent','good','satisfactory','sufficient','failed']){
  assert.ok(css.includes('.result-track--'+band+'>span{background:var(--score-'+band+'-fill)}'));
  assert.ok(css.includes('.score-'+band+' { background:var(--score-'+band+'-bg);'));
}
const badges=[...css.matchAll(/\.exam-(?:provider|level)\[data-(?:provider|level)="([^"]+)"\] \{ background:var\((--badge-[\w-]+-bg)\); color:var\((--badge-[\w-]+-text)\); \}/g)];
assert.equal(badges.length,9);
assert.equal(new Set(badges.map(match=>match[2])).size,9);
const lightPalette=css.match(/:root \{([^}]+)\}/)[1];
const darkPalette=css.match(/:root\[data-color-mode="dark"\] \{([^}]+)\}/)[1];
function token(palette,name){
  const value=palette.match(new RegExp(name+':([^;]+)'))?.[1].trim();
  if(value?.startsWith('var('))return token(palette,value.slice(4,-1));
  assert.match(value||'',/^#[0-9a-f]{6}$/i,name+' has a palette value');
  return value.slice(1);
}
const luminance=hex=>{
  const rgb=hex.match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
};
for(const [,name,bgToken,fgToken] of badges){
  const bg=token(lightPalette,bgToken),fg=token(lightPalette,fgToken);
  assert.ok(luminance(bg)>0.7,name+' pastel background');
  assert.ok((luminance(bg)+0.05)/(luminance(fg)+0.05)>=4.5,name+' text contrast');
}
for(const name of ['goethe','telc','fid','a1','a2','b1','b2','c1','c2','neutral','passed','failed',...AI_PROVIDER_IDS.map(id=>'ai-'+id)]){
  const bg=token(darkPalette,'--badge-'+name+'-bg'),fg=token(darkPalette,'--badge-'+name+'-text');
  if(name!=='neutral'){
    const channels=bg.match(/../g).map(value=>parseInt(value,16)/255),max=Math.max(...channels),min=Math.min(...channels);
    assert.ok((max-min)/max>=0.45,name+' dark badge keeps a vivid hue');
    assert.ok((luminance(bg)+0.05)/(luminance('16161b')+0.05)>=1.6,name+' fill stands out from the card');
  }
  assert.ok((luminance(fg)+0.05)/(luminance(bg)+0.05)>=4.5,name+' dark text contrast');
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
