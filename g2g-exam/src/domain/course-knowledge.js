export const MAX_KNOWLEDGE_BLOCKS=100;
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
    if(block.type==='text'){const text=String(block.text??'');length+=text.length;return {id:block.id,type:'text',text};}
    if(block.type!=='image')throw Error('Chỉ hỗ trợ khối văn bản và hình ảnh.');
    const width=Number(block.width??100),align=block.align||'center';
    if(![25,50,75,100].includes(width)||!['left','center','right'].includes(align))throw Error('Vị trí hoặc độ rộng hình ảnh không hợp lệ.');
    const url=mediaUrl(block.url);if(!url)throw Error('Khối hình ảnh cần có ảnh.');
    return {id:block.id,type:'image',url,alt:String(block.alt??'').slice(0,600),align,width};
  });
  if(length>100000)throw Error('Nội dung bài kiến thức tối đa 100.000 ký tự.');
  return {blocks,contentVersion:1,body:blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n'),imageUrl:blocks.find(b=>b.type==='image')?.url||''};
}
export function moveKnowledgeBlock(blocks,id,targetId,after=false){
  const from=blocks.findIndex(block=>block.id===id),target=blocks.findIndex(block=>block.id===targetId);
  if(from<0||target<0||from===target)return false;
  const [block]=blocks.splice(from,1),at=blocks.findIndex(item=>item.id===targetId);
  blocks.splice(at+(after?1:0),0,block);return true;
}
