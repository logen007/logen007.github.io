const base=()=>String(globalThis.G2G_API_BASE||'/api').replace(/\/$/,'');
export async function courseRequest(path,{method='GET',body,signal}={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)controller.abort();
  try{
    const response=await fetch(base()+'/courses'+path,{method,credentials:'include',signal:controller.signal,
      headers:body===undefined?{}:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error||'Không thực hiện được thao tác khóa học.'),{status:response.status});
    return data;
  }catch(error){if(error.name==='AbortError'&&!signal?.aborted)throw new Error('Máy chủ phản hồi chậm. Nội dung đang nhập vẫn được giữ; hãy thử lại.');throw error;}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
export const coursePath=(id,suffix='')=>'/'+encodeURIComponent(id)+suffix;
export function readCourseRoute(url,user){
  const params=new URL(url).searchParams,page=params.get('course-page')||(user?.role==='student'?'catalog':'manage');
  return {page:['catalog','mine','manage','detail','learn','edit','members'].includes(page)?page:'catalog',id:params.get('course')||'',chapter:params.get('chapter')||'',kind:['knowledge','exercises'].includes(params.get('course-kind'))?params.get('course-kind'):'',lesson:params.get('lesson')||'',step:params.get('course-step')||'info'};
}
export function writeCourseRoute(url,route){
  url.searchParams.set('view','courses');url.searchParams.set('course-page',route.page||'catalog');
  for(const [param,value] of [['course',route.id],['chapter',route.chapter],['course-kind',route.kind],['lesson',route.lesson],['course-step',route.step]])if(value)url.searchParams.set(param,value);else url.searchParams.delete(param);
}
