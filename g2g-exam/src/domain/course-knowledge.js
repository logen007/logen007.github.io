import {normalizeKnowledgeList,knowledgeListText} from './knowledge-list.js';
export const MAX_KNOWLEDGE_BLOCKS=100;
export const KNOWLEDGE_LAYOUT_VERSION=2;
export const courseDescriptionContent=course=>({id:'course-description',body:course.description||'',...(Array.isArray(course.descriptionBlocks)?{blocks:course.descriptionBlocks}:{})});
export const KNOWLEDGE_TEXT_ALIGNS=['left','center','right','justify'];
export const KNOWLEDGE_IMAGE_ALIGNS=['left','center','right'];
export const knowledgeImageWidth=value=>Math.max(10,Math.min(100,Math.round(Number(value)||100)));
export function knowledgeBlocks(lesson){
  if(Array.isArray(lesson.blocks))return structuredClone(lesson.blocks);
  const suffix=String(lesson.id||'lesson').slice(0,70),blocks=[];
  if(lesson.imageUrl)blocks.push({id:'legacy-image-'+suffix,type:'image',url:lesson.imageUrl,alt:'',align:'center',width:100});
  if(lesson.body||!blocks.length)blocks.push({id:'legacy-text-'+suffix,type:'text',text:lesson.body||''});
  return blocks;
}
export function normalizeKnowledgeBlocks(value,mediaUrl){
  if(!Array.isArray(value)||value.length>MAX_KNOWLEDGE_BLOCKS)throw Error('Mỗi bài kiến thức tối đa 100 khối nội dung.');
  const ids=new Set();let length=0;
  const blocks=value.map(block=>{
    if(!/^[\w-]{1,100}$/.test(block?.id||'')||ids.has(block.id))throw Error('Mã khối nội dung không hợp lệ hoặc bị trùng.');
    ids.add(block.id);
    if(block.type==='text'){const list=block.list===undefined?null:normalizeKnowledgeList(block.list),text=list?knowledgeListText(list):String(block.text??'');length+=text.length;if(block.align!==undefined&&!KNOWLEDGE_TEXT_ALIGNS.includes(block.align))throw Error('Căn lề văn bản không hợp lệ.');return {id:block.id,type:'text',text,...(list?{list}:{}),...(block.align&&block.align!=='left'?{align:block.align}:{})};}
    if(block.type!=='image')throw Error('Chỉ hỗ trợ khối văn bản và hình ảnh.');
    const width=Number(block.width??100),align=block.align||'center';
    if(!Number.isInteger(width)||width<10||width>100||!KNOWLEDGE_IMAGE_ALIGNS.includes(align))throw Error('Vị trí hoặc độ rộng hình ảnh không hợp lệ.');
    const url=mediaUrl(block.url);if(!url)throw Error('Khối hình ảnh cần có ảnh.');
    return {id:block.id,type:'image',url,alt:String(block.alt??'').slice(0,600),align,width};
  });
  if(length>100000)throw Error('Nội dung bài kiến thức tối đa 100.000 ký tự.');
  return {blocks,contentVersion:blocks.some(block=>block.list)?3:blocks.some(block=>block.type==='text'?block.align:![25,50,75,100].includes(block.width))?2:1,body:blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n'),imageUrl:blocks.find(b=>b.type==='image')?.url||''};
}
export function moveKnowledgeBlock(blocks,id,targetId,after=false){
  const from=blocks.findIndex(block=>block.id===id),target=blocks.findIndex(block=>block.id===targetId);
  if(from<0||target<0||from===target)return false;
  const [block]=blocks.splice(from,1),at=blocks.findIndex(item=>item.id===targetId);
  blocks.splice(at+(after?1:0),0,block);return true;
}
