import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {colorContrast} from '../src/settings/palette.js';

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.table-link \{[^}]*font:600 16px\/1\.4 var\(--font-ui\)/,'Table primary links use the shared stronger hierarchy');
assert.match(css,/\.bang \.roster-profile \{[^}]*gap:2px;[^}]*min-height:44px;[^}]*color:var\(--chu\)/,'Name/email stay compact without losing the touch target');
assert.match(css,/\.bang \.roster-profile \.phu \{ margin:0; \}/);
assert.doesNotMatch(css,/\.table-link\.(?:grade-attempt--graded|exam-title-status\.is-(?:published|draft))\s*\{/,'State-specific title colors must not override shared neutral/hover styling');
assert.match(css,/@media\(hover:hover\)\s*\{\s*\.color-mode-toggle\.icon-btn:hover:not\(:disabled\)\s*\{\s*background:var\(--brand-soft\); color:var\(--brand-text\); border-color:var\(--brand-border\);/,'Theme toggle hover differs from its muted default without sticky hover on touch');
assert.match(css,/\.color-mode-toggle\.icon-btn:active:not\(:disabled\)\s*\{\s*background:var\(--brand-primary\); color:var\(--brand-on-primary\);/,'Theme toggle has a distinct pressed state');
const enhancements=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
const light=css.match(/:root \{([^}]+)\}/)[1];
const dark=css.match(/:root\[data-color-mode="dark"\] \{([^}]+)\}/)[1];
function palette(block){
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):([^;]+);/g)].map(([,key,value])=>[key,value.trim().replace(/!important$/,'')]));
}
for(const [mode,values] of [['light',palette(light)],['dark',{...palette(light),...palette(dark)}]]){
  const resolve=name=>{
    const value=values[name];assert.ok(value,mode+' defines '+name);
    if(value.startsWith('var('))return resolve(value.slice(4,-1));
    return /^#[\da-f]{3}$/i.test(value)?'#'+[...value.slice(1)].map(channel=>channel+channel).join(''):value;
  };
  for(const [text,bg] of [['--xanh','--success-bg'],['--vang','--warning-bg'],['--do','--danger-bg'],['--do','--mat'],['--phu','--mat'],['--phu','--surface-muted'],['--text-inverse','--surface-inverse'],['--badge-goethe-text','--mat'],['--badge-goethe-text','--badge-goethe-bg'],['--badge-a2-text','--badge-a2-bg'],['--badge-neutral-text','--badge-neutral-bg']]){
    assert.ok(colorContrast(resolve(text),resolve(bg))>=4.5,`${mode} ${text} on ${bg} has readable small text`);
  }
  for(const name of ['--success-border','--warning-border','--danger-border','--table-heading-bg','--table-hover-bg'])assert.match(resolve(name),/^#[\da-f]{3,6}$/i);
}
const rule=(source,selector)=>[...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match=>match[1].trim()===selector.slice(0,-1).trim())?.[2]||'';
for(const [source,selector,token] of [
  [css,'.profile-form [data-error] {','--do'],
  [css,'.ai-writing-suggestion .is-met span {','--xanh'],
  [css,'.ai-writing-suggestion .is-missing span {','--do'],
  [css,'.image-width-control>span {','--phu'],
  [css,'.learner-stats span{','--phu'],
  [css,'.user-role-name--teacher {','--badge-goethe-text'],
  [css,'.dashboard-ai-part {','--badge-goethe-bg'],
  [css,'.dashboard-ai-model {','--badge-a2-bg'],
  [css,'.offline {','--danger-bg'],
  [css,'.promotion-celebration>span{','--success-bg'],
  [css,'.admin-dashboard .dashboard-r2-card {','--surface-inverse'],
  [enhancements,'.canh-bao-bao-tri {','--warning-bg'],
  [enhancements,'.ghi-chu-bao-mat {','--warning-border'],
  [enhancements,'.secret-status {','--success-border'],
  [enhancements,'.letter-answer-error{','--do'],
]){
  assert.ok(source.includes(selector),selector+' exists');
  assert.ok(rule(source,selector).includes(`var(${token})`),selector+' uses the shared semantic owner');
}
assert.doesNotMatch(css,/:root\[data-color-mode="dark"\] :is\(\.nhan\.(?:xanh|do|vang)/,'Semantic surfaces switch at their token owner, not per-component dark patches');
assert.match(rule(css,'.cpu-plot {'),/container-type:inline-size/);
assert.match(css,/@container\(max-width:440px\) \{ \.cpu-axis-x span:nth-child\(2n\) \{ display:none; \} \}/,'Axis density follows the plot width, including narrow desktop columns');
console.log('Theme surfaces: light/dark semantic contrast, shared feedback, profile and AI token consumers passed (not browser rendering).');
