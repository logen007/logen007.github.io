import {Editor,Extension,Mark,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {Plugin,NodeSelection,Selection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import {knowledgeDocument,documentKnowledgeBlocks} from './knowledge-document.js';
import {normalizeKnowledgeBlocks} from '../domain/course-knowledge.js';
import {courseMediaUrl} from '../domain/courses.js';

const id=()=> 'block-'+crypto.randomUUID();
const LegacyMarkup=Mark.create({name:'legacyMarkup',addAttributes:()=>({kind:{default:'box'}}),
  parseHTML:()=>[{tag:'strong.instruction-token',attrs:{kind:'box'}},{tag:'span.text-signature',attrs:{kind:'signature'}},{tag:'span.text-headline',attrs:{kind:'headline'}}],
  renderHTML:({mark})=>[mark.attrs.kind==='box'?'strong':'span',{class:{box:'instruction-token',signature:'text-signature',headline:'text-headline'}[mark.attrs.kind]||''},0]});
const KnowledgeImage=Image.extend({
  addInputRules:()=>[],
  addAttributes(){return {...this.parent?.(),align:{default:'center',parseHTML:element=>element.dataset.align||'center'},width:{default:100,parseHTML:element=>Number(element.dataset.width)||100}};},
  renderHTML({HTMLAttributes}){
    const {align,width,...rest}=HTMLAttributes,safeWidth=[25,50,75,100].includes(Number(width))?Number(width):100,safeAlign=['left','center','right'].includes(align)?align:'center';
    return ['img',mergeAttributes(rest,{class:'course-lesson-image','data-align':safeAlign,'data-width':safeWidth,style:`width:${safeWidth}%;margin-left:${safeAlign==='left'?'0':'auto'};margin-right:${safeAlign==='right'?'0':'auto'}`})];
  },
});
export function bindKnowledgeVisualEditor(root,{lesson,onChange,onFiles,notify}){
  const canvas=root.querySelector('[data-knowledge-canvas]'),points=new Set();let editor;
  const ids=Extension.create({name:'knowledgeIds',addGlobalAttributes:()=>[{types:['paragraph','heading','image'],attributes:{blockId:{default:null,parseHTML:element=>element.dataset.knowledgeId,renderHTML:attrs=>attrs.blockId?{'data-knowledge-id':attrs.blockId}:{}}}}],
    addProseMirrorPlugins:()=>[new Plugin({
      filterTransaction:transaction=>{if(!transaction.docChanged)return true;try{const value=documentKnowledgeBlocks(transaction.doc.toJSON());value.forEach(block=>{block.id=id();});normalizeKnowledgeBlocks(value,courseMediaUrl);return true;}catch(error){notify(error.message);return false;}},
      appendTransaction:(_transactions,_old,state)=>{const tr=state.tr,seen=new Set();state.doc.forEach((node,pos)=>{let key=node.attrs.blockId;if(!/^[\w-]{1,100}$/.test(key||'')||seen.has(key)){key=id();tr.setNodeMarkup(pos,undefined,{...node.attrs,blockId:key});}seen.add(key);});return tr.docChanged?tr:null;},
    })]});
  const refresh=()=>{
    if(!editor||editor.isDestroyed)return;
    const image=editor.isActive('image'),attrs=editor.getAttributes('image');let hasImage=false;editor.state.doc.forEach(node=>{if(node.type.name==='image')hasImage=true;});
    root.dataset.empty=String(!editor.getText()&&!hasImage);root.querySelector('[data-knowledge-image-tools]').hidden=!image;
    for(const input of root.querySelectorAll('[data-knowledge-image-field]'))if(root.ownerDocument.activeElement!==input)input.value=attrs[input.dataset.knowledgeImageField]??'';
    for(const button of root.querySelectorAll('[data-knowledge-command]')){const name=button.dataset.knowledgeCommand;button.disabled=name==='undo'?!editor.can().undo():name==='redo'?!editor.can().redo():name.startsWith('image-')?!image:false;if(['bold','italic','underline','heading'].includes(name))button.setAttribute('aria-pressed',String(editor.isActive(name)));}
    root.querySelectorAll('[data-course-pick]').forEach(button=>{button.disabled=false;});
  };
  const imageFiles=transfer=>{const files=Array.from(transfer?.files||[]);if(!files.length)files.push(...Array.from(transfer?.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean));return files.filter(file=>file.type.startsWith('image/'));};
  const capture=(position=null)=>{const selection=position===null?editor.state.selection:Selection.near(editor.state.doc.resolve(position)),point={bookmark:selection.getBookmark(),afterNode:selection instanceof NodeSelection};points.add(point);return point;};
  canvas.innerHTML='';
  editor=new Editor({element:canvas,content:knowledgeDocument(lesson,root.ownerDocument),extensions:[StarterKit.configure({heading:{levels:[2]},code:false,codeBlock:false,blockquote:false,horizontalRule:false,bulletList:false,orderedList:false,listItem:false,listKeymap:false,link:false,strike:false}),KnowledgeImage,LegacyMarkup,ids],
    editorProps:{attributes:{role:'textbox','aria-label':'Nội dung kiến thức','aria-multiline':'true',spellcheck:'true'},
      handlePaste:(_view,event)=>{const files=imageFiles(event.clipboardData);if(files.length){event.preventDefault();onFiles(files,{point:capture()});return true;}return false;},
      handleDrop:(view,event,_slice,moved)=>{const files=imageFiles(event.dataTransfer);if(files.length){event.preventDefault();onFiles(files,{point:capture(view.posAtCoords({left:event.clientX,top:event.clientY})?.pos??null)});return true;}return !moved&&Boolean(event.dataTransfer?.getData('text/html')?.match(/<img\b/i));},
      transformPastedHTML:html=>{const holder=root.ownerDocument.createElement('div');holder.innerHTML=html;holder.querySelectorAll('img').forEach(img=>img.remove());return holder.innerHTML;},
    },
    onUpdate:()=>{if(editor){onChange(documentKnowledgeBlocks(editor.getJSON()));refresh();}},onSelectionUpdate:()=>refresh(),
    onTransaction:({transaction})=>{for(const point of points)point.bookmark=point.bookmark.map(transaction.mapping);refresh();},
  });
  const click=event=>{
    const button=event.target.closest('[data-knowledge-command]');if(!button||button.disabled)return;
    event.preventDefault();const name=button.dataset.knowledgeCommand;
    if(name==='heading')editor.chain().focus().toggleHeading({level:2}).run();
    else if(['bold','italic','underline'].includes(name))editor.chain().focus()[{bold:'toggleBold',italic:'toggleItalic',underline:'toggleUnderline'}[name]]().run();
    else if(['undo','redo'].includes(name))editor.chain().focus()[name]().run();
    else if(name==='image-remove')editor.chain().focus().deleteSelection().run();
    else if(name==='image-up'||name==='image-down'){
      const {selection,doc,tr}=editor.state;if(!(selection instanceof NodeSelection)||selection.node.type.name!=='image')return;
      const nodes=[];doc.forEach((node,pos)=>nodes.push({node,pos}));const at=nodes.findIndex(item=>item.pos===selection.from),next=at+(name==='image-up'?-1:1);if(next<0||next>=nodes.length)return;
      const image=nodes[at],target=nodes[next],position=next<at?target.pos:target.pos+target.node.nodeSize-image.node.nodeSize;
      tr.delete(image.pos,image.pos+image.node.nodeSize).insert(position,image.node).setSelection(NodeSelection.create(tr.doc,position));editor.view.dispatch(tr);
    }
  };
  const keepSelection=event=>{if(event.target.closest('[data-knowledge-command],[data-course-pick]'))event.preventDefault();};
  const change=event=>{const field=event.target;if(!field.dataset.knowledgeImageField||!editor.isActive('image'))return;editor.commands.updateAttributes('image',{[field.dataset.knowledgeImageField]:field.dataset.knowledgeImageField==='width'?Number(field.value):field.value});};
  root.addEventListener('click',click);root.addEventListener('mousedown',keepSelection);root.addEventListener('input',change);root.addEventListener('change',change);root.dataset.ready='true';refresh();
  return {editor,capture,release:point=>points.delete(point),selectedImage:()=>editor.isActive('image')?editor.getAttributes('image').blockId:null,
    insertImages(urls,{point,replaceId}={}){
      if(editor.isDestroyed)throw Error('Bài học đã đóng. Vui lòng mở lại để chèn ảnh.');
      editor.view.dispatch(closeHistory(editor.state.tr));
      if(replaceId){let found=false;editor.state.doc.forEach((node,pos)=>{if(node.type.name==='image'&&node.attrs.blockId===replaceId){editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,src:urls[0]}));found=true;}});if(!found)throw Error('Ảnh đã được xóa trong khi tải. Vui lòng chọn vị trí khác.');}
      else{
        const nodes=urls.map(src=>({type:'image',attrs:{blockId:id(),src,align:'center',width:100,alt:''}})),selection=point?.bookmark.resolve(editor.state.doc);
        if(point?.afterNode)editor.commands.insertContentAt(selection.to,nodes);
        else editor.chain().command(({tr})=>{if(selection)tr.setSelection(selection);return true;}).insertContent(nodes).run();
        const inserted=new Set();editor.state.doc.forEach(node=>{if(node.type.name==='image')inserted.add(node.attrs.blockId);});
        if(nodes.some(node=>!inserted.has(node.attrs.blockId)))throw Error('Chưa chèn được ảnh vì nội dung đã vượt giới hạn. Hãy giảm số khối rồi chọn lại ảnh.');
      }
      points.delete(point);refresh();
    },
    destroy(){points.clear();editor.destroy();root.removeEventListener('click',click);root.removeEventListener('mousedown',keepSelection);root.removeEventListener('input',change);root.removeEventListener('change',change);},
  };
}
