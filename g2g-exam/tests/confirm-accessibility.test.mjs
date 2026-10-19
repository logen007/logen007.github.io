import assert from 'node:assert/strict';
import {confirmAction} from '../src/ui/confirm.js';
import {mountDialog} from '../src/views/classes.js';
import {mountBackupPage} from '../src/views/backup-page.js';
import {clearBackupData} from '../src/settings/backup-data.js';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const dom=new JSDOM('<button id="outside">Background</button>');
const previous=globalThis.document;globalThis.document=dom.window.document;
try{
  const doc=document,outside=doc.getElementById('outside');outside.focus();
  let cancelled=0,accepted=0;
  confirmAction('Synthetic confirmation',()=>accepted++,{onCancel:()=>cancelled++});
  const cancel=doc.querySelector('[data-confirm-cancel]'),accept=doc.querySelector('[data-confirm-accept]');
  const key=(key,shiftKey=false)=>doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,cancel);
  key('Tab',true);assert.equal(doc.activeElement,accept);
  key('Tab');assert.equal(doc.activeElement,cancel);
  outside.focus();assert.equal(doc.activeElement,cancel,'Background focus is contained');
  key('Escape');assert.equal(cancelled,1);assert.equal(doc.activeElement,outside);
  assert.equal(doc.getElementById('site-confirm'),null);
  confirmAction('Old',()=>accepted++,{onCancel:()=>cancelled++});
  confirmAction('New',()=>accepted++);
  assert.equal(cancelled,2,'Replacing a confirmation settles the old caller');
  const action=doc.querySelector('[data-confirm-accept]');action.click();action.click();
  assert.equal(accepted,1,'A detached stale button cannot repeat the action');
  assert.equal(doc.activeElement,outside);
  const modal=mountDialog('Synthetic profile','<input id="name"><button>Save</button>');
  const close=modal.querySelector('[data-dismiss]'),save=modal.querySelector('button:not([data-dismiss])');
  save.focus();key('Tab');assert.equal(doc.activeElement,close);
  key('Tab',true);assert.equal(doc.activeElement,save);
  key('Escape');assert.equal(modal.isConnected,false);assert.equal(doc.activeElement,outside);
  const celebration=mountDialog('Synthetic completion','<button data-continue>Continue</button>',{required:true});
  assert.equal(doc.activeElement,celebration.querySelector('[data-continue]'),'A required dialog without inputs takes focus instead of leaving it behind the overlay');
  key('Tab');assert.equal(doc.activeElement,celebration.querySelector('[data-continue]'));
  key('Tab',true);assert.equal(doc.activeElement,celebration.querySelector('[data-continue]'));
  key('Escape');assert.equal(celebration.isConnected,true);celebration.remove();outside.focus();
  const choices=mountDialog('Synthetic choices','<input type="hidden"><fieldset disabled><input></fieldset><div hidden><input></div><select><option>Choice</option></select>');
  assert.equal(doc.activeElement,choices.querySelector('select'),'Hidden or disabled fields do not steal initial focus');
  key('Escape');assert.equal(doc.activeElement,outside);
  const notice=mountDialog('Synthetic notice','<p>Information</p>');
  assert.equal(doc.activeElement,notice.querySelector('[data-dismiss]'),'A message-only dialog focuses its close control');
  key('Escape');assert.equal(doc.activeElement,outside);
  const guarded=mountDialog('Synthetic loading form','<input type="hidden"><fieldset disabled><button>Unavailable before</button></fieldset><input aria-label="Available"><fieldset disabled><button>Unavailable after</button></fieldset>',{required:true});
  const available=guarded.querySelector('[aria-label="Available"]');
  for(const shiftKey of [false,true]){
    available.focus();
    const tab=new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true});
    available.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented,true,'Hidden inputs and disabled fieldsets are not focus-loop boundaries');
    assert.equal(doc.activeElement,available);
  }
  guarded.remove();outside.focus();
  const required=mountDialog('Required','<input>',{required:true});
  key('Escape');assert.equal(required.isConnected,true);required.remove();outside.focus();
  let extras=0;
  confirmAction('Extra action',()=>accepted++,{extraAction:{label:'Synthetic extra',onClick:()=>{assert.equal(doc.getElementById('site-confirm'),null);extras++;}}});
  const extra=doc.querySelector('.site-confirm-extra');extra.focus();key('Tab');
  assert.equal(doc.activeElement,doc.querySelector('[data-confirm-cancel]'));
  extra.click();extra.click();assert.equal(extras,1);assert.equal(accepted,1);
  const menu=doc.createElement('div');menu.id='accountMenu';menu.innerHTML='<button>Profile</button>';doc.body.append(menu);
  outside.setAttribute('aria-controls',menu.id);menu.querySelector('button').focus();menu.hidden=true;
  const profile=mountDialog('Profile','<input>');
  profile.querySelector('[data-dismiss]').click();assert.equal(doc.activeElement,outside,'Hidden menu opener restores its controlling avatar');
  // DOM doubles only: native dialog top-layer rendering still needs a browser.
  const saved={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval};
  try{
    Object.defineProperty(doc,'hidden',{configurable:true,value:false});
    dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
    globalThis.setTimeout=()=>0;globalThis.setInterval=()=>0;
    let connected=true,fail=false,disconnects=0;
    globalThis.fetch=async(url,options)=>{
      assert.doesNotMatch(url,/exam-images/,'Backup settings never mutate the primary Google connection');
      if(url==='/api/backup/google/disconnect'){
        assert.equal(options.method,'POST');disconnects++;
        if(fail)return {ok:false,json:async()=>({})};
        connected=false;
      }
      return {ok:true,json:async()=>url.endsWith('getBackupStatus')?{drive:{connected,email:'backup@example.test',oauthConfigured:true},enabled:true,status:{state:'idle'}}:url.endsWith('getBackupPreferences')?{preferences:{time:'03:00',intervalDays:1,dailyCopies:7,monthlyCopies:1}}:{files:[]}};
    };
    clearBackupData();const root=doc.createElement('div');doc.body.append(root);
    mountBackupPage(root,{owner:'synthetic-backup'});await new Promise(resolve=>setImmediate(resolve));
    await root.querySelector('[data-settings]').onclick();
    const popup=doc.querySelector('[data-backup-modal]'),disconnect=popup.querySelector('[data-disconnect]');
    assert.equal(popup.querySelector('[data-connect]').getAttribute('href'),'/api/backup/google/connect');
    assert.equal(popup.querySelector('[data-google]').textContent,'backup@example.test');
    disconnect.click();assert.equal(popup.open,false,'Hide native modal before body confirmation');
    doc.querySelector('[data-confirm-cancel]').click();assert.equal(popup.open,true);assert.equal(doc.activeElement,disconnect);assert.equal(disconnects,0);
    fail=true;disconnect.click();doc.querySelector('[data-confirm-accept]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(popup.open,true);assert.equal(disconnect.disabled,false);assert.match(popup.querySelector('[data-error]').textContent,/Chưa ngắt/);
    fail=false;disconnect.click();doc.querySelector('[data-confirm-accept]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(disconnects,2);assert.equal(popup.isConnected,false);assert.equal(root.querySelector('[data-now]').disabled,true);
    root.remove();clearBackupData();
  }finally{Object.assign(globalThis,saved);}
  console.log('Confirmation DOM: forward/backward focus loop, background containment, Escape, restoration and replacement cleanup passed.');
}finally{globalThis.document=previous;dom.window.close();}
