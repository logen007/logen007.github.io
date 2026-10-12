import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindImagePaste,acceptsImage} from '../src/ui/image-paste.js';
const image={type:'image/png',name:'clipboard.png'};
assert.equal(acceptsImage({accept:'image/*'},image),true);
assert.equal(acceptsImage({accept:'.png'},image),true);
assert.equal(acceptsImage({accept:'image/jpeg'},image),false);
assert.equal(acceptsImage({accept:'audio/*'},image),false);

const listeners={},inputs=[],messages=[];
let observe,disconnected=false,replace,confirmCount=0;
globalThis.MutationObserver=class{constructor(fn){observe=fn;}observe(){}disconnect(){disconnected=true;}};
globalThis.DataTransfer=class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}};
const root={querySelectorAll:()=>inputs,addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:type=>delete listeners[type]};
function createInput(accept='image/*',existing=false){
  const classes=new Set();
  const control={dataset:{},title:'Upload',textContent:'Upload',classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
    querySelector:selector=>selector==='img'?existing?{}:null:input,
    matches:()=>false,contains:node=>node===control||node===input,closest:selector=>selector==='[data-image-paste-target]'?control:null};
  const input={accept,isConnected:true,disabled:false,dataset:{},files:[],getAttribute:()=>null,setAttribute(){},
    matches:selector=>selector==='input[type="file"]',querySelectorAll:()=>[],closest:selector=>selector.startsWith('textarea')?null:control,
    dispatchEvent:event=>{assert.equal(event.type,'change');assert.equal(event.bubbles,true);input.changes=(input.changes||0)+1;}};
  return {input,control,classes};
}
const first=createInput(),second=createInput('image/*',true),audio=createInput('audio/*');
inputs.push(first.input,second.input,audio.input);
const cleanup=bindImagePaste(root,{notify:message=>messages.push(message),confirmReplace:apply=>{confirmCount++;replace=apply;}});
assert.ok(first.control.title.includes('⌘V / Ctrl+V'));
assert.equal(audio.control.dataset.imagePasteTarget,undefined);
const paste=(target,files=[image])=>{let prevented=false;listeners.paste({target,clipboardData:{items:files.map(file=>({kind:'file',getAsFile:()=>file}))},preventDefault:()=>prevented=true});return prevented;};
assert.equal(paste(root),false,'No destination must not guess');
listeners.pointerover({target:first.input});
assert.ok(first.classes.has('image-paste-active'));
assert.equal(paste(root),true);assert.equal(first.input.files[0],image);assert.equal(first.input.changes,1);
const textInput={closest:selector=>selector.startsWith('textarea')?{}:null};
assert.equal(paste(textInput),false,'Text inputs keep their native paste');
listeners.pointerout({relatedTarget:null});
assert.equal(paste(root),false);
assert.equal(paste(second.input),true,'Focused image input is a destination');
assert.equal(confirmCount,1);assert.equal(second.input.changes,undefined,'Replacement waits for confirmation');
replace();assert.equal(second.input.changes,1);
await Promise.resolve();
second.input.disabled=true;assert.equal(paste(second.input),false);
second.input.disabled=false;second.input.isConnected=false;assert.equal(paste(second.input),false);
assert.equal(paste(audio.input),false);
const fresh=createInput('image/png');
observe([{addedNodes:[fresh.input]}]);
assert.equal(paste(fresh.input),true,'Newly rendered upload controls work');
assert.equal(fresh.input.changes,1);
assert.equal(paste(fresh.input,[{type:'image/jpeg',name:'a.jpg'}]),true);
assert.match(messages.at(-1),/Định dạng/);assert.equal(fresh.input.changes,1);
assert.equal(paste(fresh.input,[image,image]),true);
assert.match(messages.at(-1),/một ảnh/);
assert.equal(paste(fresh.input,[{type:'text/plain',name:'text.txt'}]),false);
cleanup();assert.equal(disconnected,true);assert.equal(Object.keys(listeners).length,0);

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.danh-sach-de\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/\.the-de h3\s*\{[^}]*line-height:1\.4;[^}]*height:2\.8em;[^}]*-webkit-line-clamp:2/);
assert.match(css,/@media\(max-width:960px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:repeat\(2/);
assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:1fr/);
console.log('Clipboard: destination, native text paste, validation, replacement, dynamic controls and 4-column cards passed.');
