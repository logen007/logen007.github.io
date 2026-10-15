// Keep browser history separate from rendering: polling must not add entries.
export function createPageHistory({view=window,beforeLeave=async()=>true,onError=()=>{}}={}){
  const {history,location}=view;
  let index=history.state?.g2gPageIndex??0,current=location.href,initialized=false,restoring=false,undoing=false;
  const sync=href=>{
    if(restoring)return;
    const target=new URL(href,location.href).href;
    if(!initialized){
      initialized=true;current=target;
      history.replaceState({...history.state,g2gPageIndex:index},'',target);
    }else if(target!==current){
      current=target;
      history.pushState({g2gPageIndex:++index},'',target);
    }
  };
  const pop=async()=>{
    if(undoing){undoing=false;restoring=false;return;}
    if(restoring)return;
    restoring=true;
    try{
      if(await beforeLeave()){location.reload();return;}
    }catch(error){onError(error);}
    const targetIndex=history.state?.g2gPageIndex;
    if(Number.isInteger(targetIndex)&&targetIndex!==index){undoing=true;history.go(index-targetIndex);}
    else{history.replaceState({g2gPageIndex:index},'',current);restoring=false;}
  };
  view.addEventListener('popstate',pop);
  return {sync,dispose:()=>view.removeEventListener('popstate',pop)};
}
