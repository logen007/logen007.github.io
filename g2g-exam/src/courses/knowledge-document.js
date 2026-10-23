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
      const mark=['STRONG','B'].includes(tag)?{type:'bold'}:['EM','I'].includes(tag)?{type:'italic'}:tag==='U'?{type:'underline'}:kind?{type:'legacyMarkup',attrs:{kind}}:null;
      return Array.from(node.childNodes).flatMap(child=>walk(child,mark?[...marks,mark]:marks));
    };
    return walk(holder);
  };
  const content=knowledgeBlocks(lesson).map(block=>{
    if(block.type==='image')return {type:'image',attrs:{blockId:block.id,src:block.url,alt:block.alt||'',align:block.align||'center',width:block.width||100}};
    const heading=block.text.match(/^\[headline\]([\s\S]*)\[\/headline\]$/i);
    return {type:heading?'heading':'paragraph',attrs:{blockId:block.id,...(heading?{level:2}:{})},content:inline(heading?heading[1]:block.text)};
  });
  return {type:'doc',content:content.length?content:[{type:'paragraph',attrs:{blockId:'block-'+crypto.randomUUID()}}]};
}
export function documentKnowledgeBlocks(document){
  const inline=node=>{
    if(node.type==='hardBreak')return '\n';
    if(node.type!=='text')return (node.content||[]).map(inline).join('');
    return (node.marks||[]).reduce((text,mark)=>{const tag=marker[mark.type]||(mark.type==='legacyMarkup'&&['box','signature','headline'].includes(mark.attrs?.kind)?mark.attrs.kind:null);return tag?`[${tag}]${text}[/${tag}]`:text;},node.text||'');
  };
  return (document.content||[]).map(node=>node.type==='image'
    ?{id:node.attrs.blockId,type:'image',url:node.attrs.src,alt:node.attrs.alt||'',align:node.attrs.align||'center',width:Number(node.attrs.width)||100}
    :{id:node.attrs.blockId,type:'text',text:node.type==='heading'?`[headline]${inline(node)}[/headline]`:inline(node)});
}
