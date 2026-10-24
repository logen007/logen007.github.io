const pages=new Set(['edit','queue','session','reviews','grade','results']);
export function readSpeakingExamRoute(url,user){
  const params=new URL(url).searchParams;
  if(params.get('view')!=='speaking-exams')return null;
  const page=params.get('speaking-page')||(user?.role==='student'?'results':'reviews');
  return {page:pages.has(page)?page:'results',examId:params.get('speaking-exam')||'',id:params.get('speaking-session')||''};
}
export function writeSpeakingExamRoute(url,route){
  url.searchParams.set('view','speaking-exams');
  url.searchParams.set('speaking-page',route.page);
  if(route.examId)url.searchParams.set('speaking-exam',route.examId);
  if(route.id)url.searchParams.set('speaking-session',route.id);
}
export async function speakingExamRequest(path,{method='GET',body,signal}={}){
  const controller=new AbortController(),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)controller.abort();
  const timer=setTimeout(cancel,25000);
  try{
    const base=String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
    const response=await fetch(base+'/speaking-exams'+path,{method,credentials:'include',signal:controller.signal,
      headers:body===undefined?{}:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error||'Chưa thực hiện được thao tác đề nói.'),{status:response.status});
    return data;
  }catch(error){
    if(error.name==='AbortError'&&!signal?.aborted)throw new Error('Máy chủ phản hồi chậm. Vui lòng thử lại.');
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
