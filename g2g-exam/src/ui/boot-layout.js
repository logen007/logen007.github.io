/* Store geometry only: never HTML, text, input values, account data or image URLs. */
(function(){
  const KEY='g2g-boot-geometry-v1',MAX=240,TTL=3600000;
  let ticket=0;
  const route=()=>location.pathname+location.search;
  function valid(data,width,path,now=Date.now()){
    return !!data&&data.path===path&&data.width===width&&now>=data.time&&now-data.time<TTL
      &&Array.isArray(data.shapes)&&data.shapes.length<=MAX
      &&data.shapes.every(s=>['surface','line','media','brand'].includes(s.kind)
        &&['x','y','w','h','r'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=20000));
  }
  function capture(root){
    if(!root||root.querySelector('#bootShell')||window.scrollY>0)return;
    const origin=root.getBoundingClientRect(),shapes=[];
    const push=(rect,kind,r=4)=>{
      const x=rect.left-origin.left,y=rect.top-origin.top;
      if(rect.width<2||rect.height<2||x<0||y<0||y>innerHeight+300)return;
      shapes.push({kind,x,y,w:rect.width,h:rect.height,r:Math.min(999,r)});
    };
    function walk(el){
      if(shapes.length>=MAX||el.hidden||el.matches('script,style,dialog,[hidden]'))return;
      const css=getComputedStyle(el),rect=el.getBoundingClientRect();
      if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0||!rect.width||!rect.height)return;
      if(rect.top-origin.top>innerHeight+300)return;
      if(el.matches('.thuong-hieu')){push(rect,'brand',0);return;}
      if(el.matches('img,svg,video,canvas,input,textarea,select')){
        push(rect,'media',parseFloat(css.borderRadius)||4);return;
      }
      const background=css.backgroundColor;
      if((background&&background!=='rgba(0, 0, 0, 0)'&&background!=='transparent')||parseFloat(css.borderTopWidth)>0){
        push(rect,'surface',parseFloat(css.borderRadius)||0);
      }
      for(const child of el.childNodes){
        if(shapes.length>=MAX)break;
        if(child.nodeType===1)walk(child);
        else if(child.nodeType===3&&child.textContent.trim()){
          const range=document.createRange();range.selectNodeContents(child);
          for(const line of range.getClientRects()){
            if(shapes.length>=MAX)break;
            push({left:line.left,top:line.top+line.height*.2,width:line.width,height:line.height*.6},'line');
          }
        }
      }
    }
    for(const child of root.children)walk(child);
    if(!shapes.length)return;
    try{sessionStorage.setItem(KEY,JSON.stringify({path:route(),width:innerWidth,time:Date.now(),shapes}));}catch{}
  }
  function schedule(root){
    const current=++ticket;
    const save=()=>requestAnimationFrame(()=>{if(current===ticket)capture(root);});
    Promise.resolve(document.fonts?.ready).then(save);
    root.querySelectorAll('img').forEach(img=>{if(!img.complete)img.addEventListener('load',save,{once:true});});
  }
  function restore(){
    const shell=document.getElementById('bootShell');
    if(!shell)return;
    let data;
    try{data=JSON.parse(sessionStorage.getItem(KEY));}catch{return;}
    if(!valid(data,innerWidth,route()))return;
    const app=document.getElementById('app'),origin=app.getBoundingClientRect();
    const layer=document.createElement('div');layer.className='boot-layout';layer.setAttribute('aria-hidden','true');
    const brand=shell.querySelector('.thuong-hieu');
    let bottom=0;
    for(const s of data.shapes){
      const node=s.kind==='brand'?brand:document.createElement('div');
      if(!node)continue;
      if(s.kind!=='brand')node.className='boot-layout-'+s.kind;
      Object.assign(node.style,{position:'absolute',left:s.x+'px',top:s.y+'px',width:s.w+'px',height:s.h+'px',borderRadius:s.r+'px'});
      if(s.kind==='brand'){
        // Keep responsive header selectors (mobile logo/type sizing) unchanged.
        const header=document.createElement('header');
        header.className='thanh-dau';header.style.display='contents';
        header.append(node);layer.append(header);
      }else layer.append(node);
      bottom=Math.max(bottom,s.y+s.h);
    }
    // Align to #app's border box, the same origin used for measurements.
    layer.style.left=-parseFloat(getComputedStyle(app).paddingLeft)+'px';
    layer.style.top=-parseFloat(getComputedStyle(app).paddingTop)+'px';
    layer.style.width=origin.width+'px';layer.style.height=bottom+'px';
    shell.querySelector('[data-boot-fallback]').hidden=true;
    shell.style.minHeight=Math.min(bottom,innerHeight)+'px';
    shell.prepend(layer);
  }
  function clear(){ticket++;try{sessionStorage.removeItem(KEY);}catch{}}
  window.G2GBootLayout={schedule,clear,valid,capture};
  restore();
})();
