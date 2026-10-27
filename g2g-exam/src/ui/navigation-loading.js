// A single indicator per document, including overlapping page controllers.
const states=new WeakMap();
export function beginNavigationLoading(doc=document){
  let state=states.get(doc);
  if(!state){state={pending:0,bar:null};states.set(doc,state);}
  if(!state.pending++){
    const bar=doc.createElement('div');bar.className='navigation-loading';
    bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Đang tải nội dung');
    doc.body.append(bar);state.bar=bar;
  }
  let ended=false;
  return ()=>{if(ended)return;ended=true;if(!--state.pending){state.bar.remove();state.bar=null;}};
}
export function createNavigationLoading(doc=document){
  return async function withLoading(task){
    const end=beginNavigationLoading(doc);
    try{return await task();}finally{end();}
  };
}
