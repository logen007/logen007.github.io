import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const badges=[...css.matchAll(/\.exam-(?:provider|level)\[data-(?:provider|level)="([^"]+)"\] \{ background:#([0-9a-f]{6}); color:#fff; \}/g)];
assert.equal(badges.length,9);
assert.equal(new Set(badges.map(match=>match[2])).size,9);
for(const [,name,hex] of badges){
  const rgb=hex.match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  const luminance=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  assert.ok(1.05/(luminance+0.05)>=4.5,name+' white text contrast');
}
console.log('Provider and level badges: distinct dark colors and white text contrast passed.');
