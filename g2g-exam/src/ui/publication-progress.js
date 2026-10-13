const labels={saving:'Lưu đề…',checking:'Kiểm tra…',version:'Tạo phiên bản…',cache:'Tạo cache…'};
export function publicationProgress(){
  const node=document.createElement('div');node.className='publication-progress';
  node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  const bar=document.createElement('progress'),text=document.createElement('span');
  bar.setAttribute('aria-label','Tiến trình xuất bản');node.append(bar,text);document.body.append(node);
  return {
    update(stage){text.textContent=labels[stage]||labels.checking;},
    done(version){bar.max=1;bar.value=1;text.textContent='Đã xuất bản v'+version;setTimeout(()=>node.remove(),1000);},
    remove(){node.remove();},
  };
}

export async function streamPublication(examId,onProgress,{fetcher=fetch}={}){
  const base=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
  const response=await fetcher(base+'/exams/'+encodeURIComponent(examId)+'/publish',{method:'POST',credentials:'include'});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Không thể xuất bản.');}
  if(!response.body)throw new Error('Không nhận được trạng thái xuất bản. Vui lòng thử lại.');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',receipt;
  const consume=line=>{
    if(!line.trim())return;
    const event=JSON.parse(line);
    if(event.stage==='error')throw new Error(event.message);
    if(event.stage==='done')receipt=event;
    else onProgress(event.stage);
  };
  try{
    while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}}
    buffer+=decoder.decode();consume(buffer);
    if(!receipt)throw new Error('Kết nối bị ngắt. Kiểm tra lại trạng thái đề trước khi thử lại.');
    return receipt;
  }finally{reader.releaseLock();}
}
