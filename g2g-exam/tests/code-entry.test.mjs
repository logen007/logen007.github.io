import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeEntryHtml,bindCodeEntry} from '../src/ui/code-entry.js';
for(const kind of ['class','exam']){
  const html=codeEntryHtml(kind);
  assert.ok(html.includes(`placeholder="${kind==='class'?'Mã lớp':'Mã đề'}"`));
  assert.ok(html.includes(`aria-label="Nhập ${kind==='class'?'mã lớp':'mã đề'}"`));
  assert.match(html,/<form class="inline-code-entry"/);assert.match(html,/name="code" type="text" required minlength="5" maxlength="5"/);
  assert.match(html,/type="submit" aria-label="Xác nhận mã/);assert.match(html,/aria-describedby="inline-/);assert.match(html,/data-code-error role="alert" hidden/);
  let listener,calls=0,finish;
  const input={value:'aB123',addEventListener:(_name,fn)=>{listener=fn;},focus(){this.focused=true;}};
  const button={disabled:false,setAttribute(){},removeAttribute(){}},error={hidden:true,textContent:''};
  const form={dataset:{},elements:{code:input},querySelector:selector=>selector==='button'?button:error};
  const root={querySelector:selector=>{assert.equal(selector,`[data-code-entry="${kind}"]`);return form;}};
  bindCodeEntry(root,kind,async(code,trigger)=>{calls++;assert.equal(code,'AB123');assert.equal(trigger,button);await new Promise(resolve=>finish=resolve);});
  const event={preventDefault(){}};
  const pending=form.onsubmit(event);assert.equal(button.disabled,true);await form.onsubmit(event);assert.equal(calls,1);
  finish();await pending;assert.equal(button.disabled,false);assert.equal(input.value,'AB123');
  input.value='bad';await form.onsubmit(event);assert.equal(calls,1);assert.equal(error.hidden,false);assert.equal(input.focused,true);
  listener();assert.equal(error.hidden,true);assert.equal(error.textContent,'');
  // Binding is idempotent, and failed submissions keep the entered code for retry.
  delete form.dataset.bound;input.value='ab123';
  bindCodeEntry(root,kind,async()=>{throw Error('Synthetic rejection');});
  await form.onsubmit(event);assert.equal(error.textContent,'Synthetic rejection');assert.equal(button.disabled,false);assert.equal(input.value,'AB123');
}
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
assert.match(app,/bindCodeEntry\(app,'class',code=>openClassEnrollment\(\{repo,user,onSaved:profileSaved,initialCode:code\}\)\)/);
assert.match(app,/bindCodeEntry\(app,'exam',[\s\S]*?openCodeEntry\(\{repo,initialCode:code/);
const access=readFileSync(new URL('../src/views/exam-access.js',import.meta.url),'utf8');
assert.match(access,/value="\$\{esc\(initialCode\)\}"/);assert.match(access,/Mỗi mã dùng một lần/);assert.match(access,/>Bắt đầu thi<\/button>/);
console.log('Inline codes: native submit/Enter contract, normalization, validation, duplicate guard, errors/retry and existing confirmation wiring passed.');
