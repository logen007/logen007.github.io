import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindImagePaste,acceptsImage} from '../src/ui/image-paste.js';
const image={type:'image/png',name:'clipboard.png'};
assert.equal(acceptsImage({accept:'image/*'},image),true);
assert.equal(acceptsImage({accept:'.png'},image),true);
assert.equal(acceptsImage({accept:'image/jpeg'},image),false);
assert.equal(acceptsImage({accept:'audio/*'},image),false);

const listeners={},inputs=[],messages=[],panels=[];
let observe,disconnected=false,replace,confirmCount=0;
globalThis.MutationObserver=class{constructor(fn){observe=fn;}observe(){}disconnect(){disconnected=true;}};
globalThis.DataTransfer=class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}};
const root={querySelectorAll:()=>inputs,addEventListener:(type,fn,capture)=>{listeners[type]=fn;if(type==='click')assert.equal(capture,true);},removeEventListener:type=>delete listeners[type],
  defaultView:{innerWidth:1024,innerHeight:768,addEventListener(){},removeEventListener(){}},
  body:{append:node=>panels.push(node)},
  createElement:tag=>({tag,style:{},children:[],events:{},setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(type,fn){this.events[type]=fn;},
    contains(node){return node===this||this.children.includes(node);},getBoundingClientRect:()=>({width:180,height:48}),remove(){this.removed=true;}})};
function createInput(accept='image/*',existing=false){
  const classes=new Set();
  const control={dataset:{},title:'Upload',textContent:'Upload',classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
    querySelector:selector=>selector==='img'?existing?{}:null:input,
    matches:()=>false,contains:node=>node===control||node===input,closest:selector=>selector==='[data-image-paste-target]'?control:null,
    getBoundingClientRect:()=>({left:100,right:140,top:200,bottom:240,width:40})};
  const input={accept,isConnected:true,disabled:false,dataset:{},files:[],getAttribute:()=>null,setAttribute(){},
    matches:selector=>selector==='input[type="file"]',querySelectorAll:()=>[],closest:selector=>selector.startsWith('textarea')||selector==='button'?null:control,
    focus(){root.activeElement=input;listeners.focusin?.({target:input});},blur(){root.activeElement=null;},
    click(){if(!click(input).prevented)input.dialogs=(input.dialogs||0)+1;},
    dispatchEvent:event=>{assert.equal(event.type,'change');assert.equal(event.bubbles,true);input.changes=(input.changes||0)+1;}};
  return {input,control,classes};
}
const first=createInput(),second=createInput('image/*',true),audio=createInput('audio/*');
inputs.push(first.input,second.input,audio.input);
const cleanup=bindImagePaste(root,{notify:message=>messages.push(message),confirmReplace:apply=>{confirmCount++;replace=apply;}});
function click(target){const state={prevented:false,stopped:false};listeners.click({target,preventDefault:()=>state.prevented=true,stopPropagation:()=>state.stopped=true});return state;}
assert.ok(first.control.title.includes('⌘V / Ctrl+V'));
assert.equal(audio.control.dataset.imagePasteTarget,undefined);
const paste=(target,files=[image])=>{let prevented=false;listeners.paste({target,clipboardData:{items:files.map(file=>({kind:'file',getAsFile:()=>file}))},preventDefault:()=>prevented=true});return prevented;};
assert.equal(paste(root),false,'No destination must not guess');
assert.deepEqual(click(first.input),{prevented:true,stopped:true},'Click must block transparent input and parent label activation');
assert.equal(first.input.dialogs,undefined,'Selecting never opens the file picker');
assert.equal(root.activeElement,first.input);
assert.ok(first.classes.has('image-paste-active'));
assert.equal(panels.length,1);assert.equal(panels[0].hidden,false);
assert.equal(panels[0].children[1].title,'Chọn ảnh từ máy');
assert.equal(listeners.pointerover,undefined,'Moving the mouse cannot change selection');
assert.equal(paste(root),true);assert.equal(first.input.files[0],image);assert.equal(first.input.changes,1);
const textInput={closest:selector=>selector.startsWith('textarea')?{}:null};
assert.equal(paste(textInput),false,'Text inputs keep their native paste');
panels[0].children[1].events.click();
assert.equal(first.input.dialogs,1,'Only the browse icon opens the native picker');
listeners.keydown({target:first.input,key:'Enter',preventDefault(){}});
assert.equal(first.input.dialogs,2,'Keyboard users can open the native picker');
listeners.keydown({target:first.input,key:'Escape'});
assert.equal(panels[0].hidden,true);assert.equal(root.activeElement,null);
listeners.keydown({target:root,key:'Escape'});
assert.equal(paste(root),false);
assert.equal(paste(second.input),true,'Focused image input is a destination');
assert.equal(confirmCount,1);assert.equal(second.input.changes,undefined,'Replacement waits for confirmation');
replace();assert.equal(second.input.changes,1);
await Promise.resolve();
second.input.disabled=true;assert.equal(paste(second.input),false);
second.input.disabled=false;second.input.isConnected=false;assert.equal(paste(second.input),false);
assert.equal(paste(audio.input),false);
assert.equal(click(audio.input).prevented,false,'Audio native file picker remains unchanged');
const removeButton={closest:selector=>selector==='button'?removeButton:selector==='[data-image-paste-target]'?first.control:null};
assert.equal(click(removeButton).prevented,false,'Image removal buttons are not intercepted');
const fresh=createInput('image/png');
observe([{addedNodes:[fresh.input]}]);
assert.equal(paste(fresh.input),true,'Newly rendered upload controls work');
assert.equal(fresh.input.changes,1);
assert.equal(paste(fresh.input,[{type:'image/jpeg',name:'a.jpg'}]),true);
assert.match(messages.at(-1),/Định dạng/);assert.equal(fresh.input.changes,1);
assert.equal(paste(fresh.input,[image,image]),true);
assert.match(messages.at(-1),/một ảnh/);
assert.equal(paste(fresh.input,[{type:'text/plain',name:'text.txt'}]),false);
click(fresh.input);click(root);assert.equal(paste(root),false,'Outside click clears the target');
assert.equal(root.activeElement,null,'Outside click removes native file focus too');
click(fresh.input);listeners.focusin({target:textInput});assert.equal(paste(root),false,'Editing a different field clears the target');
click(fresh.input);fresh.input.isConnected=false;observe([{addedNodes:[]}]);assert.equal(panels[0].hidden,true,'Navigation hides stale selection');
cleanup();assert.equal(disconnected,true);assert.equal(Object.keys(listeners).length,0);
assert.equal(panels[0].removed,true);

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.danh-sach-de\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/\.the-de h3\s*\{[^}]*line-height:1\.4;[^}]*height:2\.8em;[^}]*-webkit-line-clamp:2/);
assert.match(css,/@media\(max-width:960px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:repeat\(2/);
assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:1fr/);
console.log('Clipboard: destination, native text paste, validation, replacement, dynamic controls and 4-column cards passed.');
