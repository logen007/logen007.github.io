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
const root={querySelectorAll:()=>inputs,addEventListener:(type,fn,capture)=>{listeners[type]=fn;if(type==='click'||type==='pointerdown')assert.equal(capture,true);},removeEventListener:type=>delete listeners[type]};
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
function press(target,input){listeners.pointerdown({target});input?.focus();return click(target);}
assert.equal(first.control.title,'Bấm lần 1 để chọn vùng dán\nBấm lần 2 để chọn ảnh');
assert.equal(audio.control.dataset.imagePasteTarget,undefined);
const paste=(target,files=[image])=>{let prevented=false;listeners.paste({target,clipboardData:{items:files.map(file=>({kind:'file',getAsFile:()=>file}))},preventDefault:()=>prevented=true});return prevented;};
assert.equal(paste(root),false,'No destination must not guess');
assert.deepEqual(press(first.input,first.input),{prevented:true,stopped:true},'First click must not open the picker even though pointerdown focuses the input first');
assert.equal(first.input.dialogs,undefined,'Selecting never opens the file picker');
assert.equal(root.activeElement,first.input);
assert.ok(first.classes.has('image-paste-active'));
assert.equal(listeners.pointerover,undefined,'Moving the mouse cannot change selection');
assert.equal(paste(root),true);assert.equal(first.input.files[0],image);assert.equal(first.input.changes,1);
const textInput={closest:selector=>selector.startsWith('textarea')?{}:null};
assert.equal(paste(textInput),false,'Text inputs keep their native paste');
const firstIcon={closest:selector=>selector==='[data-image-paste-target]'?first.control:null};
press(firstIcon);
assert.equal(first.input.dialogs,1,'Second click anywhere, including the icon, opens the picker');
listeners.keydown({target:first.input,key:'Enter',preventDefault(){}});
assert.equal(first.input.dialogs,2,'Keyboard users can open the native picker');
listeners.keydown({target:first.input,key:'Escape'});
assert.equal(first.classes.has('image-paste-active'),false);assert.equal(root.activeElement,null);
listeners.keydown({target:root,key:'Escape'});
assert.equal(paste(root),false);
press(firstIcon);
assert.equal(first.input.dialogs,2,'First icon click after deselection only selects');
assert.equal(first.classes.has('image-paste-active'),true);
press(second.input,second.input);
assert.equal(second.input.dialogs,undefined,'Switching to another image requires its own first click');
assert.equal(first.classes.has('image-paste-active'),false);
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
const direct=createInput('image/png');
direct.input.dataset.imagePickerDirect='';
observe([{addedNodes:[direct.input]}]);
direct.input.click();
assert.equal(direct.input.dialogs,1,'Direct pickers open on the first click');
assert.equal(direct.control.dataset.imagePasteTarget,undefined);
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
click(fresh.input);fresh.input.isConnected=false;observe([{addedNodes:[]}]);assert.equal(fresh.classes.has('image-paste-active'),false,'Navigation clears stale selection');
cleanup();assert.equal(disconnected,true);assert.equal(Object.keys(listeners).length,0);

const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.doesNotMatch(css,/choice-image-tooltip/,'Only the shared image preview is styled');
assert.doesNotMatch(readFileSync(new URL('../src/part-templates/default/builder.js',import.meta.url),'utf8'),/choice-image-tooltip/,'Initial and uploaded answers use the shared preview');
assert.doesNotMatch(css,/image-paste-toolbar/);
assert.match(css,/\[data-image-paste-target\]\.image-paste-active\s*\{\s*border-color:var\(--brand-primary\)/);
assert.match(readFileSync(new URL('../src/ui/button-tooltips.js',import.meta.url),'utf8'),/imageTarget\?button.getAttribute\('title'\)/);
assert.match(css,/\.danh-sach-de\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/\.the-de h3\s*\{[^}]*line-height:1\.4;[^}]*height:2\.8em;[^}]*-webkit-line-clamp:2/);
assert.match(css,/@media\(max-width:960px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:repeat\(2/);
assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.danh-sach-de\s*\{\s*grid-template-columns:1fr/);
console.log('Clipboard: destination, native text paste, validation, replacement, dynamic controls and 4-column cards passed.');

// Measure the real tooltip renderer: image hints below, other actions above.
const tooltipEvents={};let tooltip;
globalThis.document={addEventListener:(type,fn)=>tooltipEvents[type]=fn,
  body:{append:node=>tooltip=node},
  createElement:()=>({style:{},classList:{add(){}},prepend(node){this.preview=node;},setAttribute(){},remove(){},getBoundingClientRect:()=>({width:220,height:46})})};
globalThis.window={addEventListener(){}};globalThis.innerWidth=1000;globalThis.innerHeight=800;
const {bindButtonTooltips}=await import('../src/ui/button-tooltips.js');
bindButtonTooltips();
function tooltipTarget(imageTarget){
  const attrs={title:'Bấm lần 1 để chọn vùng dán\nBấm lần 2 để chọn ảnh','aria-label':'Upload'};
  const target={textContent:'',closest:()=>target,matches:selector=>selector==='[data-image-paste-target]'?imageTarget:selector!=='.image-width-control',
    querySelector:()=>null,getAttribute:name=>attrs[name],setAttribute:(name,value)=>attrs[name]=value,removeAttribute:name=>delete attrs[name],
    getBoundingClientRect:()=>({left:100,top:200,bottom:240,width:40})};
  return target;
}
tooltipEvents.focusin({target:tooltipTarget(true)});
assert.equal(tooltip.style.top,'248px');assert.equal(tooltip.style.left,'10px');
assert.equal(tooltip.textContent,'Bấm lần 1 để chọn vùng dán\nBấm lần 2 để chọn ảnh');
assert.equal(tooltip.className,'button-tooltip button-tooltip--image');
assert.match(css,/\.button-tooltip--image\s*\{\s*white-space:pre-line/);
tooltipEvents.focusin({target:tooltipTarget(false)});
assert.equal(tooltip.style.top,'148px');assert.equal(tooltip.className,'button-tooltip');
const {imageWidthHelp,imageWidthInput}=await import('../src/ui/image-width.js');
const widthTarget=tooltipTarget(false);
const oldGet=widthTarget.getAttribute;
widthTarget.getAttribute=name=>name==='data-tooltip'?imageWidthHelp:oldGet(name);
widthTarget.matches=selector=>selector==='.image-width-control';
tooltipEvents.focusin({target:widthTarget});
assert.equal(tooltip.className,'button-tooltip button-tooltip--image-width');
assert.deepEqual(tooltip.textContent.split('\n'),['Chiều rộng tối đa (px).','Để trống: tự vừa khung.']);
assert.match(css,/\.button-tooltip--image-width\s*\{[^}]*white-space:pre-line;[^}]*240px/);
assert.doesNotMatch(css,/\[data-has-image="false"\][^{]*(?:image-width-control|instruction-image-width)/);
assert.doesNotMatch(imageWidthInput(null),/\s(?:hidden|disabled)(?:\s|=|>)/);
assert.match(imageWidthInput(600),/value="600"/);
tooltipEvents.keydown({key:'Escape'});
const previewTarget=tooltipTarget(true);
previewTarget.querySelector=()=>({getAttribute:()=>'/uploads/photo.jpg',src:'/uploads/photo.jpg',alt:'Ảnh đề bài'});
tooltipEvents.focusin({target:previewTarget});
assert.equal(tooltip.preview.src,'/uploads/photo.jpg');
assert.equal(tooltip.preview.alt,'Ảnh đề bài');
assert.equal(tooltip.style.top,'148px');
assert.equal(tooltip.textContent,'');
assert.equal(previewTarget.getAttribute('title'),undefined);
tooltipEvents.keydown({key:'Escape'});
