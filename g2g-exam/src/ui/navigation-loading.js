// One indicator for overlapping navigation work; never reports a fake percentage.
export function createNavigationLoading(doc=document){
  let pending=0,bar=null;
  return async function withLoading(task){
    if(!pending++){
      bar=doc.createElement('div');
      bar.className='navigation-loading';
      bar.setAttribute('role','progressbar');
      bar.setAttribute('aria-label','Đang mở trình sửa đề');
      doc.body.append(bar);
    }
    try{return await task();}
    finally{if(!--pending){bar.remove();bar=null;}}
  };
}
