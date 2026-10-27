import {knowledgeListText} from '../domain/knowledge-list.js';
import {textHtml} from '../ui/format.js';
import {knowledgeBlocks} from '../domain/course-knowledge.js';

// Visual editing; storage remains safe text/image blocks, never arbitrary HTML.
const marker={bold:'b',italic:'i',underline:'u'};
export function knowledgeDocument(lesson,document){
  const inline=text=>{
    const holder=document.createElement('div');holder.innerHTML=textHtml(text).replace(/\n/g,'<br>');
    const walk=(node,marks=[])=>{
      if(node.nodeType===3)return node.textContent?[{type:'text',text:node.textContent,...(marks.length?{marks}:{})}]:[];
      if(node.nodeName==='BR')return [{type:'hardBreak'}];
      const tag=node.nodeName,kind=node.classList?.contains('instruction-token')?'box':node.classList?.contains('text-signature')?'signature':node.classList?.contains('text-headline')?'headline':'';
      const mark=kind?{type:'legacyMarkup',attrs:{kind}}:['STRONG','B'].includes(tag)?{type:'bold'}:['EM','I'].includes(tag)?{type:'italic'}:tag==='U'?{type:'underline'}:null;
      return Array.from(node.childNodes).flatMap(child=>walk(child,mark?[...marks,mark]:marks));
    };
    return walk(holder);
  };
  const listNode=(list,blockId=null)=>({type:list.ordered?'orderedList':'bulletList',attrs:{blockId,start:list.start||1},content:list.items.map(item=>({type:'listItem',content:item.content.map(part=>part.type==='list'?listNode(part.list):{type:part.heading?'heading':'paragraph',attrs:{textAlign:part.align||'left',...(part.heading?{level:2}:{})},content:inline(part.text)})}))});
  const content=knowledgeBlocks(lesson).map(block=>{
    if(block.type==='youtube')return {type:'youtube',attrs:{blockId:block.id,videoId:block.videoId}};
    if(block.type==='image')return {type:'image',attrs:{blockId:block.id,src:block.url,alt:block.alt||'',align:block.align||'center',width:block.width||100}};
    if(block.list)return listNode(block.list,block.id);
    const heading=block.text.match(/^\[headline\]([\s\S]*)\[\/headline\]$/i);
    return {type:heading?'heading':'paragraph',attrs:{blockId:block.id,textAlign:block.align||'left',...(heading?{level:2}:{})},content:inline(heading?heading[1]:block.text)};
  });
  return {type:'doc',content:content.length?content:[{type:'paragraph',attrs:{blockId:'block-'+crypto.randomUUID()}}]};
}
export function documentKnowledgeBlocks(document){
  const inline=node=>{
    if(node.type==='hardBreak')return '\n';
    if(node.type!=='text')return (node.content||[]).map(inline).join('');
    return (node.marks||[]).reduce((text,mark)=>{const tag=marker[mark.type]||(mark.type==='legacyMarkup'&&['box','signature','headline'].includes(mark.attrs?.kind)?mark.attrs.kind:null);return tag?`[${tag}]${text}[/${tag}]`:text;},node.text||'');
  };
  const listValue=node=>({ordered:node.type==='orderedList',start:Number(node.attrs?.start)||1,items:(node.content||[]).map(item=>({content:(item.content||[]).map(child=>{
    if(['bulletList','orderedList'].includes(child.type))return {type:'list',list:listValue(child)};
    if(!['paragraph','heading'].includes(child.type))throw Error('Chèn hình ở ngoài danh sách.');
    return {type:'text',text:inline(child),...(child.attrs?.textAlign&&child.attrs.textAlign!=='left'?{align:child.attrs.textAlign}:{}),...(child.type==='heading'?{heading:true}:{})};
  })}))});
  return (document.content||[]).map(node=>{
    if(node.type==='youtube')return {id:node.attrs.blockId,type:'youtube',videoId:node.attrs.videoId};
    if(['bulletList','orderedList'].includes(node.type)){const list=listValue(node);return {id:node.attrs.blockId,type:'text',text:knowledgeListText(list),list};}
    return node.type==='image'?{id:node.attrs.blockId,type:'image',url:node.attrs.src,alt:node.attrs.alt||'',align:node.attrs.align||'center',width:Number(node.attrs.width)||100}
      :{id:node.attrs.blockId,type:'text',text:node.type==='heading'?`[headline]${inline(node)}[/headline]`:inline(node),...(node.attrs.textAlign&&node.attrs.textAlign!=='left'?{align:node.attrs.textAlign}:{})};
  });
}
