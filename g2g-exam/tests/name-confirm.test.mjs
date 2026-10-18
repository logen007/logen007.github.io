import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmNameChange} from '../src/ui/confirm.js';
import {accountProfileHtml} from '../src/views/account-profile.js';

for(const role of ['master','teacher','student']){
  const html=accountProfileHtml({role,name:'An <Test>',email:'an+<test>@example.com'});
  assert.match(html,/an\+&lt;test&gt;@example.com/);
  assert.match(html,/account-profile-email-label">Email<\/span>/);
  assert.doesNotMatch(html,/chỉ xem/);
  assert.doesNotMatch(html,/name="email"|type="email"|contenteditable/);
  assert.equal(html.includes('name="code"'),role==='student');
  assert.match(html,/name="name"/);
}

const profileSource=readFileSync(new URL('../src/views/account-profile.js',import.meta.url),'utf8');
assert.match(profileSource,/mountDialog\('Hồ sơ'/);
assert.match(profileSource,/aria-describedby="accountNameHint"/);
assert.ok(profileSource.indexOf('id="accountNameHint"')<profileSource.indexOf('name="code"'),'Name hint belongs before class code');
assert.match(readFileSync(new URL('../styles.css',import.meta.url),'utf8'),/\.account-profile-form \[data-error\]:empty \{ display:none; \}/);

const previousDocument=globalThis.document;
let overlay,keyHandler;
globalThis.document={
  activeElement:{focus(){}},getElementById:()=>null,
  createElement(){
    const nodes=new Map();
    overlay={querySelector(selector){
      if(!nodes.has(selector))nodes.set(selector,{focus(){},classList:{add(){}}});
      return nodes.get(selector);
    },remove(){this.removed=true;}};
    return overlay;
  },
  body:{append(){}},addEventListener(type,handler){keyHandler=handler;},removeEventListener(){}
};
try{
  for(const action of ['accept','cancel','escape','backdrop']){
    const result=confirmNameChange('New Name',{role:'student'});
    assert.match(overlay.querySelector('#site-confirm-message').textContent,/New Name.*30 ngày/);
    if(action==='escape')keyHandler({key:'Escape',preventDefault(){}});
    else if(action==='backdrop')overlay.onclick({target:overlay});
    else overlay.querySelector(`[data-confirm-${action}]`).onclick();
    assert.equal(await result,action==='accept');
    assert.equal(overlay.removed,true);
  }
  const admin=confirmNameChange('Admin Name',{role:'master'});
  assert.doesNotMatch(overlay.querySelector('#site-confirm-message').textContent,/30 ngày/);
  overlay.querySelector('[data-confirm-cancel]').onclick();
  assert.equal(await admin,false);
}finally{globalThis.document=previousDocument;}
console.log('Name change confirmation checks passed');
