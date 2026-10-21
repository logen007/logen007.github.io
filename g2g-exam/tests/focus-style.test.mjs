import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const extra=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
assert.match(css,/--focus-ring:color-mix\(in srgb,var\(--chu\) 65%,transparent\)/);
assert.match(css,/button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible\s*\{\s*outline:1px solid var\(--focus-ring\); outline-offset:2px/);
assert.match(css,/\.inline-code-control:has\(input:focus-visible\)\{outline:1px solid var\(--focus-ring\);outline-offset:2px\}/);
assert.match(css,/\.inline-code-control input:focus-visible\{outline:none\}/);
assert.doesNotMatch(css,/\.inline-code-control:focus-within/);
assert.match(css,/@media\(forced-colors:active\)\{:root\{--focus-ring:Highlight\}\}/);
for(const source of [css,extra])for(const line of source.split('\n').filter(line=>line.includes(':focus'))){
  assert.doesNotMatch(line,/outline:2px|outline-offset:[34]px/,'Focus styles share the subtle weight and offset');
}
console.log('Shared focus style regressions passed (source assertions; not browser rendering).');
