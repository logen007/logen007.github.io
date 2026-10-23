// Real Tiptap/ProseMirror transactions in JSDOM, not browser/geometry evidence.
import assert from 'node:assert/strict';
import {knowledgeEditorHtml} from '../src/courses/knowledge-editor.js';
import {knowledgeDocument,documentKnowledgeBlocks} from '../src/courses/knowledge-document.js';
import {normalizeKnowledgeBlocks} from '../src/domain/course-knowledge.js';
import {courseMediaUrl} from '../src/domain/courses.js';
const {JSDOM}=await import(process.env.G2G_JSDOM_PATH);
const dom=new JSDOM('<main></main>',{url:'http://localhost',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','Element','Node','DOMParser','MutationObserver','Event','KeyboardEvent','Range'])globalThis[name]=dom.window[name];
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);globalThis.innerHeight=768;
Range.prototype.getBoundingClientRect=()=>({left:0,right:0,top:0,bottom:0,width:0,height:0});Range.prototype.getClientRects=()=>[];
window.scrollTo=()=>{};
const {bindKnowledgeVisualEditor}=await import('../src/courses/knowledge-visual-editor.js');
const main=document.querySelector('main'),notices=[],pastes=[];let saved=[],binding;
const legacy={id:'legacy',body:'[b]Đậm[/b] [i]Nghiêng[/i] [u]Gạch[/u]\n[box]a[/box] [signature]Ký[/signature] [headline]Đầu[/headline]',imageUrl:'/uploads/legacy.jpg'};
const converted=documentKnowledgeBlocks(knowledgeDocument(legacy,document));assert.equal(converted[1].text,legacy.body);assert.equal(converted[0].url,legacy.imageUrl);
const mount=lesson=>{main.innerHTML=knowledgeEditorHtml();binding=bindKnowledgeVisualEditor(main.firstElementChild,{lesson,onChange:blocks=>{saved=normalizeKnowledgeBlocks(blocks,courseMediaUrl).blocks;},onFiles:(files,options)=>pastes.push({files,options}),notify:message=>notices.push(message)});return binding.editor;};
const command=name=>main.querySelector(`[data-knowledge-command="${name}"]`).click();
const blocks=()=>documentKnowledgeBlocks(binding.editor.getJSON());
const selectImage=id=>{binding.editor.state.doc.forEach((node,pos)=>{if(node.type.name==='image'&&node.attrs.blockId===id)binding.editor.commands.setNodeSelection(pos);});};
try{
  const editor=mount({id:'first',body:'Hallo Welt'});assert.equal(main.querySelectorAll('[contenteditable="true"]').length,1);assert.equal(main.querySelector('textarea'),null);
  editor.commands.setTextSelection({from:1,to:6});command('bold');assert.equal(blocks()[0].text,'[b]Hallo[/b] Welt');assert.ok(main.querySelector('.tiptap strong'));
  command('undo');assert.equal(blocks()[0].text,'Hallo Welt');command('redo');assert.equal(blocks()[0].text,'[b]Hallo[/b] Welt');
  editor.commands.setTextSelection(7);const point=binding.capture();
  editor.commands.insertContentAt(1,'Neu '); // User continues typing while upload waits.
  binding.insertImages(['/uploads/one.jpg','/uploads/two.jpg'],{point});
  assert.deepEqual(blocks().filter(block=>block.text||block.type==='image').map(block=>block.type),['text','image','image','text']);
  assert.match(blocks()[0].text,/Neu.*Hallo/);assert.equal(blocks().at(-1).text,'Welt','Selection bookmark follows typing until upload completes');
  command('undo');assert.equal(blocks().filter(block=>block.type==='image').length,0,'One undo removes the whole image batch without dropping typed text');
  command('redo');assert.equal(blocks().filter(block=>block.type==='image').length,2);
  const firstImage=blocks().find(block=>block.type==='image').id;selectImage(firstImage);
  binding.insertImages(['/uploads/adjacent.jpg'],{point:binding.capture()});assert.equal(blocks().filter(block=>block.type==='image').length,3,'Insert next to a selected image, never replace it implicitly');command('undo');selectImage(firstImage);
  assert.equal(main.querySelector('[data-knowledge-image-tools]').hidden,false);
  for(const [key,value] of [['align','right'],['width','50'],['alt','Ảnh <minh họa>']]){const input=main.querySelector(`[data-knowledge-image-field="${key}"]`);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
  assert.equal(blocks().find(block=>block.id===firstImage).width,50);assert.equal(main.querySelector(`img[data-knowledge-id="${firstImage}"]`).style.width,'50%');
  assert.equal(main.querySelector(`img[data-knowledge-id="${firstImage}"]`).alt,'Ảnh <minh họa>');
  binding.insertImages(['/uploads/replaced.jpg'],{replaceId:firstImage});assert.equal(blocks().find(block=>block.id===firstImage).url,'/uploads/replaced.jpg');
  command('undo');assert.equal(blocks().find(block=>block.id===firstImage).url,'/uploads/one.jpg');
  selectImage(firstImage);command('image-up');assert.equal(blocks()[0].id,firstImage);command('image-down');assert.equal(blocks()[1].id,firstImage);
  selectImage(firstImage);command('image-remove');assert.equal(blocks().some(block=>block.id===firstImage),false);command('undo');assert.equal(blocks().some(block=>block.id===firstImage),true);
  editor.commands.setTextSelection(2);command('heading');assert.match(blocks()[0].text,/^\[headline\]/);command('heading');assert.doesNotMatch(blocks()[0].text,/^\[headline\]/);
  editor.commands.setTextSelection(2);editor.commands.splitBlock();assert.equal(new Set(blocks().map(block=>block.id)).size,blocks().length,'Enter repairs inherited duplicate IDs before persistence');
  const before=blocks();editor.commands.setContent({type:'doc',content:Array.from({length:101},()=>({type:'paragraph'}))});assert.deepEqual(blocks(),before);assert.match(notices.at(-1),/100/);
  editor.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x'.repeat(100001)}]}]});assert.deepEqual(blocks(),before);assert.match(notices.at(-1),/100.000/);
  let html='<p>Safe <b>bold</b><img src="https://example.invalid/tracker.jpg" onerror="bad()"><script>bad()</script><iframe src="https://example.invalid"></iframe></p>';
  editor.view.someProp('transformPastedHTML',transform=>{html=transform(html,editor.view);return true;});assert.doesNotMatch(html,/<img/i);
  editor.commands.insertContent(html);assert.equal(main.querySelector('.tiptap script,.tiptap iframe,[onerror]'),null,'Pasted HTML never becomes an executable storage format');
  const file=new window.File(['synthetic'],'paste.png',{type:'image/png'}),pasteEvent={clipboardData:{files:[file]},preventDefault(){this.prevented=true;}};
  editor.view.someProp('handlePaste',handle=>handle(editor.view,pasteEvent,null));assert.equal(pasteEvent.prevented,true);assert.equal(pastes.length,1);
  binding.insertImages(['/uploads/pasted.jpg'],pastes[0].options);assert.ok(blocks().some(block=>block.url==='/uploads/pasted.jpg'));
  const dropEvent={dataTransfer:{files:[file]},clientX:0,clientY:0,preventDefault(){this.prevented=true;}};
  editor.view.someProp('handleDrop',handle=>handle({posAtCoords:()=>({pos:1})},dropEvent,null,false));assert.equal(dropEvent.prevented,true);assert.equal(pastes.length,2);binding.release(pastes[1].options.point);
  assert.equal(editor.schema.nodes.image.spec.draggable,true,'Native image drag remains delegated to the editor engine');
  const final=saved;binding.destroy();assert.equal(editor.isDestroyed,true);mount({id:'reopen',blocks:final});assert.deepEqual(normalizeKnowledgeBlocks(blocks(),courseMediaUrl).blocks,final,'Visual content reopens from the existing safe block shape');
  console.log('Visual knowledge editor: real formatting/history, caret image batches, mapped async insertion, image controls, paste/drop entry, IDs/limits, safe markup and reopen passed.');
}finally{binding?.destroy();dom.window.close();}
