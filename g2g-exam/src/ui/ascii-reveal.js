// Original framework-free treatment inspired by ASCII reveal. Real DOM stays intact.
const selector='[data-ascii-reveal]',glyphs=' .:-=+*#%@',duration=360;
const excluded='.course-authoring,.course-learning-layout,.exam-paper,.goethe-editor,table,[role=dialog],input,textarea,[contenteditable=true]';

export function bindAsciiReveals(root){
  const doc=root.ownerDocument,win=doc.defaultView;
  if(!win.IntersectionObserver||!win.MutationObserver||!win.requestAnimationFrame)return ()=>{};
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),forced=win.matchMedia('(forced-colors: active)');
  const registered=new WeakSet(),seen=new Set(),active=new Set(),waiting=new Map();let frame=0,disposed=false,lastPaint=-Infinity;
  const allowed=()=>!disposed&&!doc.hidden&&!reduced.matches&&!forced.matches&&!win.navigator.connection?.saveData&&!(win.navigator.hardwareConcurrency>0&&win.navigator.hardwareConcurrency<=2);
  const remove=item=>{item.canvas.remove();active.delete(item);};
  const stop=()=>{win.cancelAnimationFrame(frame);frame=0;for(const item of [...active])remove(item);};
  const background=element=>{
    for(let node=element;node;node=node.parentElement){const color=win.getComputedStyle(node).backgroundColor;if(color&&color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;}
    return win.getComputedStyle(doc.documentElement).getPropertyValue('--mat').trim()||'#fff';
  };
  function tick(now){
    frame=0;if(!allowed()){stop();return;}
    if(now-lastPaint<32){if(active.size)frame=win.requestAnimationFrame(tick);return;}lastPaint=now;
    for(const item of [...active]){
      if(!item.element.isConnected){remove(item);continue;}
      item.start??=now;
      const progress=Math.min(1,(now-item.start)/duration);
      if(progress===1){remove(item);continue;}
      // One deterministic diagonal decode, never a random blinking character loop.
      const until=Math.floor(progress*(item.cols+item.rows));
      for(let y=0;y<item.rows;y++)for(let x=0;x<item.cols;x++)if(x+y<until)item.context.clearRect(x*item.cellW,y*item.cellH,item.cellW+1,item.cellH+1);
    }
    if(active.size)frame=win.requestAnimationFrame(tick);
  }
  function reveal(element){
    if(!allowed()||active.size>=2||!element.isConnected||element.closest(excluded))return;
    const image=element.tagName==='IMG',key=win.location.pathname+win.location.search+'|'+(image?element.currentSrc||element.src:element.textContent);
    if(seen.has(key))return;
    seen.add(key);if(seen.size>500)seen.delete(seen.values().next().value);
    const box=element.getBoundingClientRect();
    if(box.width<40||box.height<20||box.width*box.height>900000||box.bottom<=0||box.top>=win.innerHeight)return;
    let canvas;
    try{
      const started=win.performance.now();
      const cols=Math.min(90,Math.ceil(box.width/8)),rows=Math.min(50,Math.ceil(box.height/10));
      const source=doc.createElement('canvas');source.width=Math.ceil(box.width);source.height=Math.ceil(box.height);
      const sourceContext=source.getContext('2d');if(!sourceContext)return;
      const style=win.getComputedStyle(element);
      if(image){
        if(!element.naturalWidth||!element.naturalHeight)return;
        const scale=style.objectFit==='contain'?Math.min(box.width/element.naturalWidth,box.height/element.naturalHeight):Math.max(box.width/element.naturalWidth,box.height/element.naturalHeight);
        const width=element.naturalWidth*scale,height=element.naturalHeight*scale;
        sourceContext.drawImage(element,(box.width-width)/2,(box.height-height)/2,width,height);
      }else{
        if(doc.fonts&&doc.fonts.status!=='loaded')return;
        const walker=doc.createTreeWalker(element,win.NodeFilter.SHOW_TEXT),range=doc.createRange();let node;
        sourceContext.fillStyle='#fff';sourceContext.textBaseline='top';
        while((node=walker.nextNode())){
          sourceContext.font=win.getComputedStyle(node.parentElement).font;
          for(let index=0;index<node.textContent.length;index++){
            range.setStart(node,index);range.setEnd(node,index+1);const rect=range.getBoundingClientRect();
            if(rect.width&&rect.height)sourceContext.fillText(node.textContent[index],rect.left-box.left,rect.top-box.top);
          }
        }
      }
      const sample=doc.createElement('canvas');sample.width=cols;sample.height=rows;
      const sampling=sample.getContext('2d',{willReadFrequently:true});if(!sampling)return;
      sampling.drawImage(source,0,0,cols,rows);
      // Cross-origin/tainted images fail here: leave their real image untouched.
      const pixels=sampling.getImageData(0,0,cols,rows).data;
      canvas=doc.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      canvas.className='ascii-reveal-layer';canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',borderRadius:style.borderRadius});
      const context=canvas.getContext('2d');if(!context)return;
      const cellW=box.width/cols,cellH=box.height/rows;
      context.fillStyle=background(element);context.fillRect(0,0,canvas.width,canvas.height);
      context.font=Math.max(7,cellH)+'px monospace';context.textBaseline='top';
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const at=(y*cols+x)*4,alpha=pixels[at+3]/255;
        if(alpha<.02)continue;
        const tone=image?(pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722)/255:Math.sqrt(alpha);
        context.fillStyle=image?`rgb(${pixels[at]},${pixels[at+1]},${pixels[at+2]})`:style.color;
        context.fillText(glyphs[Math.max(1,Math.round(tone*(glyphs.length-1)))],x*cellW,y*cellH);
      }
      if(win.performance.now()-started>32)return;
      doc.body.append(canvas);active.add({element,canvas,context,cols,rows,cellW,cellH,start:null});
      if(!frame)frame=win.requestAnimationFrame(tick);
    }catch{canvas?.remove();} // Decoration must never prevent navigation or content.
  }
  const visibility=new win.IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      const element=entry.target;visibility.unobserve(element);
      if(element.tagName==='IMG'&&!element.complete){
        const clear=()=>{element.removeEventListener('load',loaded);element.removeEventListener('error',clear);waiting.delete(element);};
        const loaded=()=>{clear();reveal(element);};
        waiting.set(element,clear);element.addEventListener('load',loaded,{once:true});element.addEventListener('error',clear,{once:true});
      }else reveal(element);
    }
  },{threshold:.15});
  const scan=node=>{
    if(node.nodeType!==1)return;
    for(const element of [...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)])if(!registered.has(element)&&!element.closest(excluded)){registered.add(element);visibility.observe(element);}
  };
  const changes=new win.MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)scan(node);
    for(const [element,clear] of waiting)if(!element.isConnected)clear();
    for(const item of [...active])if(!item.element.isConnected)remove(item);
  });
  changes.observe(root,{childList:true,subtree:true});scan(root);
  for(const event of ['scroll','resize','pagehide'])win.addEventListener(event,stop,{passive:true,capture:true});
  doc.addEventListener('visibilitychange',stop);reduced.addEventListener('change',stop);forced.addEventListener('change',stop);
  return ()=>{disposed=true;stop();changes.disconnect();visibility.disconnect();for(const clear of [...waiting.values()])clear();for(const event of ['scroll','resize','pagehide'])win.removeEventListener(event,stop,true);doc.removeEventListener('visibilitychange',stop);reduced.removeEventListener('change',stop);forced.removeEventListener('change',stop);};
}
