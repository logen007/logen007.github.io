export async function streamPublication(examId,onProgress=()=>{},{fetcher=fetch}={}){
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
