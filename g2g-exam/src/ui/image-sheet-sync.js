export function bindImageSheetSync(root,{repo,notify}){
  root.querySelectorAll('[data-action="sync-image-sheet"]').forEach(button=>{
    button.onclick=async()=>{
      if(button.disabled)return;
      const label=button.textContent;
      button.disabled=true;button.textContent='Đang đồng bộ…';button.setAttribute('aria-busy','true');
      try{
        const result=await repo.syncImageSheet();
        notify(result.busy?'Đang có lượt đồng bộ khác. Anh thử lại sau nhé.':`Đã đồng bộ: ${result.added} ảnh mới, ${result.skipped} ảnh đã có.${result.linksUpdated?` Cập nhật ${result.linksUpdated} link cho AI (7 ngày).`:''}`);
      }catch(error){notify(error.message||'Chưa đồng bộ được ảnh. Anh thử lại nhé.');}
      finally{button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}
    };
  });
}
