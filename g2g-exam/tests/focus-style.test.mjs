import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const extra=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
assert.match(css,/--focus-ring:color-mix\(in srgb,var\(--chu\) 65%,transparent\)/);
assert.match(css,/button:focus-visible,a:focus-visible,input:is\(\[type=checkbox\],\[type=radio\],\[type=range\],\[type=color\],\[type=file\]\):focus-visible\s*\{\s*outline:1px solid var\(--focus-ring\); outline-offset:2px/);
assert.match(css,/select:focus,textarea:focus \{ outline:none; box-shadow:none; border-color:var\(--focus-ring\)!important; \}/);
assert.match(css,/\.inline-code-control:has\(input:focus\)\{border-color:var\(--focus-ring\)\}/);
assert.match(css,/\.inline-code-control input:focus\{outline:none;border:0;box-shadow:none\}/);
assert.match(css,/\.inline-code-control\{[^}]*height:var\(--control-height\);min-height:var\(--control-height\);[^}]*border:1px solid var\(--control-border\)/);
assert.match(css,/\.inline-code-control input\{[^}]*min-height:0;[^}]*height:100%/,'Inner input fits inside the border instead of adding two extra pixels');
assert.match(css,/min-height:var\(--control-height\); height:var\(--control-height\); border:1px solid var\(--control-border\);[^}]*color:var\(--chu\);[^}]*font:400 var\(--control-font-size\)\/var\(--control-line-height\)/,'Shared input/select geometry, border and typography');
assert.match(css,/select:has\(>option:checked\[value=""\]\) \{ color:var\(--phu\); \}/,'Empty dropdowns match placeholder text');
assert.doesNotMatch(css,/\.inline-code-control:focus-within/);
assert.match(css,/@media\(forced-colors:active\)\{:root\{--focus-ring:Highlight\}\}/);
for(const source of [css,extra])for(const line of source.split('\n').filter(line=>line.includes(':focus'))){
  assert.doesNotMatch(line,/outline:2px|outline-offset:[34]px/,'Focus styles share the subtle weight and offset');
}
console.log('Shared focus style regressions passed (source assertions; not browser rendering).');
