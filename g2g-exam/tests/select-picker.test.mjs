import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.doesNotMatch(css,/appearance:base-select|::picker\(select\)|::picker-icon/);
assert.match(css,/select:not\(\[multiple\]\), \.inline-gap-trigger \{ appearance:none; -webkit-appearance:none;/);
assert.match(css,/\.inline-code-control\{[^}]*background:var\(--mat\)/);
assert.match(css,/\.inline-code-control input\{[^}]*font:400 var\(--control-font-size\)\/var\(--control-line-height\)/);
console.log('Shared select picker and inline-code appearance source regressions passed; no browser rendering claimed.');
