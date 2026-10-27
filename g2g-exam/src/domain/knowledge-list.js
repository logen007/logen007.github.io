// Safe list structure shared by storage, visual editing and learner rendering.
export function normalizeKnowledgeList(value,depth=0,budget={nodes:0,length:0}){
  if(depth>=5||!value||!Array.isArray(value.items)||!value.items.length||value.items.length>300)throw Error('Danh sách tối đa 5 cấp và 300 mục mỗi cấp.');
  const ordered=value.ordered===true,start=Number(value.start??1);
  if(!Number.isInteger(start)||start<1||start>9999)throw Error('Số bắt đầu danh sách không hợp lệ.');
  const items=value.items.map(item=>{
    if(++budget.nodes>1000||!Array.isArray(item?.content)||!item.content.length||item.content.length>50||item.content[0]?.type!=='text'||item.content[0]?.heading)throw Error('Cấu trúc danh sách không hợp lệ hoặc quá lớn.');
    return {content:item.content.map(part=>{
      if(++budget.nodes>1000)throw Error('Danh sách quá lớn.');
      if(part?.type==='list')return {type:'list',list:normalizeKnowledgeList(part.list,depth+1,budget)};
      if(part?.type!=='text')throw Error('Chèn hình ở ngoài danh sách.');
      const text=String(part.text??'');budget.length+=text.length;if(budget.length>100000)throw Error('Nội dung danh sách tối đa 100.000 ký tự.');
      if(part.align!==undefined&&!['left','center','right','justify'].includes(part.align))throw Error('Căn lề danh sách không hợp lệ.');
      return {type:'text',text,...(part.align&&part.align!=='left'?{align:part.align}:{}),...(part.heading?{heading:true}:{})};
    })};
  });
  return {ordered,start,items};
}
export const knowledgeListText=list=>list.items.map(item=>item.content.map(part=>part.type==='list'?knowledgeListText(part.list):part.text).join('\n')).join('\n');
