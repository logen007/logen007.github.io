// Only warm media already delivered in the authorized exam; never fetch answers
// or other exams. Stream into the browser HTTP cache, not retained JS blobs.
export function examMediaUrls(exam,questions,index=0,origin=location.origin){
  const urls=new Set(),byId=new Map(questions.map(q=>[q.id,q]));
  const visit=value=>{
    if(typeof value==='string'){
      const candidates=[value,...(value.match(/\/uploads\/[a-zA-Z0-9._-]+/g)||[])];
      for(const candidate of candidates){
        try{const url=new URL(candidate,origin);
          if(url.origin===origin&&(/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url.pathname)||/^\/assets\/.*\.(png|jpe?g|webp|gif|mp3|ogg|wav|m4a)$/i.test(url.pathname)))urls.add(url.href);
        }catch{}
      }
    }else if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  const sections=exam.sections||[];
  for(const section of [...sections.slice(index),...sections.slice(0,index)]){
    visit(section);for(const id of section.questionIds||[])visit(byId.get(id));
  }
  return [...urls];
}

export function createExamPreloader({fetchMedia=fetch,isHidden=()=>document.hidden}={}){
  let key=null,queue=[],seen=new Set(),active=new Map(),generation=0;
  function stop(){
    generation++;for(const controller of active.values())controller.abort();
    active.clear();queue=[];seen.clear();key=null;
  }
  function pump(){
    if(isHidden())return;
    while(active.size<2&&queue.length){
      const url=queue.shift();if(seen.has(url)||active.has(url))continue;
      const controller=new AbortController(),run=generation;active.set(url,controller);
      const timeout=setTimeout(()=>controller.abort(),30000);
      (async()=>{
        try{
          const response=await fetchMedia(url,{signal:controller.signal,credentials:'same-origin',cache:'force-cache',priority:'low'});
          if(!response.ok){await response.body?.cancel();return;}
          const reader=response.body?.getReader();
          if(reader){while(!(await reader.read()).done){}reader.releaseLock();}
        }catch{/* Background failure must never block an exam. */}
        finally{
          clearTimeout(timeout);
          if(run===generation){seen.add(url);active.delete(url);pump();}
        }
      })();
    }
  }
  function update(attemptId,urls){
    if(key!==attemptId){stop();key=attemptId;}
    queue=urls.filter(url=>!seen.has(url)&&!active.has(url));pump();
  }
  return {update,stop,resume:pump};
}
