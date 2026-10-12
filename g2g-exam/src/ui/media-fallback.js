// Used only by the media service worker. Keep the original <audio> element and
// Range headers: changing delivery must not restart play-once exam state.
export function createMediaDelivery({fetchMedia=fetch,timeoutMs=4000,chunkTimeoutMs=12000,now=Date.now}={}){
  let localUntil=0;
  function recoverStream(response,request){
    if(!response.body||!response.redirected||response.headers.get('content-encoding'))return response;
    const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');
    if(response.status===206&&!range)return response; // Never guess audio offsets.
    const start=range?Number(range[1]):0;
    const length=range?Number(range[2])-start+1:Number(response.headers.get('content-length'))||null;
    let reader=response.body.getReader(),received=0,retried=false,cancelled=false;
    const body=new ReadableStream({
      async pull(controller){
        let timer;
        try{
          const item=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Media stalled')),chunkTimeoutMs);})]);
          if(item.done){
            if(length!==null&&received!==length)throw new Error('Incomplete media');
            controller.close();return;
          }
          received+=item.value.byteLength;controller.enqueue(item.value);
        }catch(error){
          if(cancelled)return;
          if(retried||request.signal?.aborted){controller.error(error);return;}
          retried=true;localUntil=now()+5*60*1000;
          void reader.cancel().catch(()=>{});
          try{
            const headers=new Headers(request.headers);
            headers.set('Range',`bytes=${start+received}-${length!==null?start+length-1:''}`);
            const fallback=await fetchMedia(new Request(request,{headers,cache:'no-store'}));
            const actual=/^bytes (\d+)-/.exec(fallback.headers.get('content-range')||'');
            if(fallback.status!==206||!actual||Number(actual[1])!==start+received||!fallback.body){
              await fallback.body?.cancel();throw new Error('Invalid fallback range');
            }
            reader=fallback.body.getReader();
            // Satisfy the pending pull; subsequent chunks keep flowing normally.
            const next=await reader.read();
            if(next.done)throw new Error('Empty fallback range');
            received+=next.value.byteLength;controller.enqueue(next.value);
          }catch(failure){controller.error(failure);}
        }finally{clearTimeout(timer);}
      },
      cancel(){cancelled=true;return reader.cancel();},
    });
    return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }
  return async function deliver(request){
    if(now()<localUntil)return fetchMedia(request);
    const url=new URL(request.url);url.searchParams.set('delivery','r2');
    const controller=new AbortController();
    const abort=()=>controller.abort();request.signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    try{
      const response=await fetchMedia(new Request(url,{method:'GET',headers:request.headers,mode:'cors',credentials:'same-origin',cache:request.cache,redirect:'follow'}),{signal:controller.signal});
      if(response.ok)return recoverStream(response,request);
      if((response.status===401||response.status===403)&&!response.redirected)return response;
      await response.body?.cancel();
      throw new Error('Media source unavailable');
    }catch(error){
      if(request.signal?.aborted)throw error;
      localUntil=now()+5*60*1000;
      return fetchMedia(request);
    }finally{clearTimeout(timer);request.signal?.removeEventListener('abort',abort);}
  };
}
