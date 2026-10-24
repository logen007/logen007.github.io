import {prepareAsciiGraphics,paintAsciiBlock} from './ascii-snapshot.js';
// One treatment for entire non-critical card content, not heading-only animation.
export const ASCII_REVEAL_SELECTOR='[data-ascii-reveal],.admin-dashboard .dashboard-panel,.admin-dashboard .dashboard-ai-queue,.admin-dashboard .dashboard-cpu-card,.admin-dashboard .dashboard-capacity-card,.admin-dashboard .dashboard-r2-card,.admin-dashboard .dashboard-backup-card,.admin-dashboard h2,.admin-dashboard h3,.course-card,.student-catalog .the-de,.student-catalog .learner-stats,.exam-list-heading h1,.student-results-heading h1,.course-shell>.tieu-de-trang h1';
const selector=ASCII_REVEAL_SELECTOR,glyphs=' .:-=+*#%@',duration=1100,hold=220;
const variants=[' ','.`',':;','-_','=~','+x','*o','#H','%8','@&'];
const excluded='.course-authoring,.course-learning-layout,.exam-paper,.goethe-editor,.grading-detail,.grading-review,table,[role=dialog],[role=alert],[role=status],[role=group],.dashboard-state,.dashboard-services,.dashboard-warning,.exam-card-status,.exam-latest-result,.nhan,button,a,summary,form,input,select,textarea,[contenteditable]';

export function bindAsciiReveals(root){
  const doc=root.ownerDocument,win=doc.defaultView;
  if(!win.IntersectionObserver||!win.MutationObserver||!win.requestAnimationFrame)return ()=>{};
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),forced=win.matchMedia('(forced-colors: active)');
  const registered=new WeakSet(),seen=new Set(),active=new Set(),waiting=new Map(),preparing=new Map();let frame=0,disposed=false,lastPaint=-Infinity;
  const allowed=()=>!disposed&&!doc.hidden&&!reduced.matches&&!forced.matches&&!win.navigator.connection?.saveData&&!(win.navigator.hardwareConcurrency>0&&win.navigator.hardwareConcurrency<=2);
  const remove=item=>{item.canvas.remove();active.delete(item);};
  const stop=()=>{win.cancelAnimationFrame(frame);frame=0;for(const cancel of preparing.values())cancel();preparing.clear();for(const item of [...active])remove(item);};
  const background=element=>{
    for(let node=element;node;node=node.parentElement){const color=win.getComputedStyle(node).backgroundColor;if(color&&color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;}
    return win.getComputedStyle(doc.documentElement).getPropertyValue('--mat').trim()||'#fff';
  };
  function paint(item,until,phase){
    const {context,canvas,cellW,cellH}=item;
    context.fillStyle=item.background;context.fillRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<item.rows;y++)for(let x=0;x<item.cols;x++)if(x+y<until)context.clearRect(x*cellW,y*cellH,cellW+1,cellH+1);
    for(const cell of item.cells)if(cell.x+cell.y>=until){
      const family=variants[cell.density];context.fillStyle=cell.color;
      context.fillText(family[(phase+cell.x+cell.y)%family.length],cell.x*cellW,cell.y*cellH);
    }
    // Keep actions, status badges and errors visible even inside a card reveal.
    for(const rect of item.holes)context.clearRect(rect.x,rect.y,rect.width,rect.height);
    item.phase=phase;item.until=until;
  }
  function tick(now){
    frame=0;if(!allowed()){stop();return;}
    if(now-lastPaint<32){if(active.size)frame=win.requestAnimationFrame(tick);return;}lastPaint=now;
    const started=win.performance.now();
    for(const item of [...active]){
      if(!item.element.isConnected){remove(item);continue;}
      item.start??=now;
      const elapsed=now-item.start,progress=Math.max(0,Math.min(1,(elapsed-hold)/(duration-hold)));
      if(progress===1){remove(item);continue;}
      // Shape/color stay stable; only similar-density glyphs change before decoding.
      const until=Math.floor(progress*(item.cols+item.rows));
      const phase=Math.floor(elapsed/100);
      if(phase!==item.phase)paint(item,until,phase);
      else if(until!==item.until){for(let y=0;y<item.rows;y++)for(let x=0;x<item.cols;x++)if(x+y>=item.until&&x+y<until)item.context.clearRect(x*item.cellW,y*item.cellH,item.cellW+1,item.cellH+1);item.until=until;}
    }
    if(win.performance.now()-started>24){stop();return;}
    if(active.size)frame=win.requestAnimationFrame(tick);
  }
  function reveal(element,graphics=[]){
    if(!allowed()||!element.isConnected||element.closest(excluded))return;
    const image=element.tagName==='IMG',block=!image&&!/^H[1-6]$/.test(element.tagName),dashboard=element.closest('.admin-dashboard');
    let identity=element.getAttribute?.('data-ascii-key')||element.id;
    if(!identity&&dashboard){
      const path=[];for(let node=element;node&&node!==dashboard;node=node.parentElement)path.push(node.tagName+':'+Array.from(node.parentElement?.children||[]).indexOf(node));
      identity='dashboard:'+path.reverse().join('/');
    }
    const key=win.location.pathname+win.location.search+'|'+(identity||(image?element.currentSrc||element.src:element.textContent));
    if(seen.has(key))return;
    const box=element.getBoundingClientRect();
    if(box.width<24||box.height<14||box.width*box.height>900000||box.bottom<=0||box.top>=win.innerHeight)return;
    const cols=Math.min(image||block?100:140,Math.ceil(box.width/(image||block?8:5))),rows=Math.min(60,Math.ceil(box.height/(image||block?10:7)));
    if(active.size>=12||[...active].reduce((sum,item)=>sum+item.cols*item.rows,cols*rows)>36000||image&&[...active].filter(item=>item.image).length>=2)return;
    seen.add(key);if(seen.size>500)seen.delete(seen.values().next().value);
    let canvas;
    try{
      const started=win.performance.now();
      const source=doc.createElement('canvas');source.width=Math.ceil(box.width);source.height=Math.ceil(box.height);
      const sourceContext=source.getContext('2d');if(!sourceContext)return;
      const style=win.getComputedStyle(element);
      if(image){
        if(!element.naturalWidth||!element.naturalHeight)return;
        const scale=style.objectFit==='contain'?Math.min(box.width/element.naturalWidth,box.height/element.naturalHeight):Math.max(box.width/element.naturalWidth,box.height/element.naturalHeight);
        const width=element.naturalWidth*scale,height=element.naturalHeight*scale;
        sourceContext.drawImage(element,(box.width-width)/2,(box.height-height)/2,width,height);
      }else{
        if(block)paintAsciiBlock(element,sourceContext,box,graphics,win,excluded);
        const walker=doc.createTreeWalker(element,win.NodeFilter.SHOW_TEXT),range=doc.createRange();let node;
        sourceContext.fillStyle='#fff';sourceContext.textBaseline='top';
        while((node=walker.nextNode())){
          if(node.parentElement.closest(excluded)||node.parentElement.closest('svg'))continue;
          const textStyle=win.getComputedStyle(node.parentElement);
          if(textStyle.display==='none'||textStyle.visibility==='hidden')continue;
          sourceContext.fillStyle=block?textStyle.color:'#fff';
          sourceContext.font=textStyle.font||`${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;
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
      if(!pixels.some((value,index)=>index%4===3&&value>5))return;
      canvas=doc.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      canvas.className='ascii-reveal-layer';canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',borderRadius:style.borderRadius});
      const context=canvas.getContext('2d');if(!context)return;
      const cellW=box.width/cols,cellH=box.height/rows;
      context.font=Math.max(7,cellH)+'px monospace';context.textBaseline='top';
      const backdrop=background(element),rgb=backdrop.match(/[\d.]+/g)?.map(Number)||[255,255,255],backdropTone=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
      const cells=[];
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const at=(y*cols+x)*4,alpha=pixels[at+3]/255;
        if(alpha<.02)continue;
        const luminance=(pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722)/255;
        const tone=image?luminance:block?Math.sqrt(alpha)*(.35+.65*Math.abs(luminance-backdropTone)):Math.sqrt(alpha);
        cells.push({x,y,density:Math.max(1,Math.round(tone*(glyphs.length-1))),color:image||block?`rgb(${pixels[at]},${pixels[at+1]},${pixels[at+2]})`:style.color});
      }
      const protectedNodes=[...element.querySelectorAll(excluded),...element.querySelectorAll('img')].filter(node=>node.tagName!=='IMG'||!node.complete||!node.naturalWidth||new URL(node.currentSrc||node.src,win.location.href).origin!==win.location.origin);
      // A failed/timed-out chart decode leaves the real chart visible, never blank.
      protectedNodes.push(...[...element.querySelectorAll('svg')].filter(svg=>!graphics.some(graphic=>graphic.element===svg)));
      const holes=protectedNodes.map(node=>node.getBoundingClientRect()).map(rect=>({x:rect.left-box.left-2,y:rect.top-box.top-2,width:rect.width+4,height:rect.height+4}));
      const item={element,canvas,context,cols,rows,cellW,cellH,image,cells,holes,background:backdrop,start:null};
      paint(item,0,0);
      if(win.performance.now()-started>(image?32:80))return;
      doc.body.append(canvas);active.add(item);
      if(!frame)frame=win.requestAnimationFrame(tick);
    }catch{canvas?.remove();} // Decoration must never prevent navigation or content.
  }
  const start=element=>{
    if(!allowed())return;
    let complete=false;
    try{
      const cancel=prepareAsciiGraphics(element,win,graphics=>{complete=true;preparing.delete(element);reveal(element,graphics);});
      if(!complete)preparing.set(element,cancel);
    }catch{reveal(element);}
  };
  const visibility=new win.IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      const element=entry.target;visibility.unobserve(element);
      if(element.tagName==='IMG'&&!element.complete){
        const clear=()=>{element.removeEventListener('load',loaded);element.removeEventListener('error',clear);waiting.delete(element);};
        const loaded=()=>{clear();start(element);};
        waiting.set(element,clear);element.addEventListener('load',loaded,{once:true});element.addEventListener('error',clear,{once:true});
      }else start(element);
    }
  },{threshold:.15});
  const scan=node=>{
    if(node.nodeType!==1)return;
    for(const element of [...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)])if(!registered.has(element)&&!element.closest(excluded)&&!element.parentElement?.closest(selector)){registered.add(element);visibility.observe(element);}
  };
  const changes=new win.MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)scan(node);
    for(const [element,clear] of waiting)if(!element.isConnected)clear();
    for(const [element,cancel] of preparing)if(!element.isConnected||records.some(record=>record.target&&element.contains(record.target))){cancel();preparing.delete(element);}
    for(const item of [...active])if(!item.element.isConnected||records.some(record=>record.target&&item.element.contains(record.target)))remove(item);
  });
  changes.observe(root,{childList:true,characterData:true,subtree:true});scan(root);
  for(const event of ['scroll','resize','pagehide','pointerdown','keydown'])win.addEventListener(event,stop,{passive:true,capture:true});
  doc.addEventListener('visibilitychange',stop);reduced.addEventListener('change',stop);forced.addEventListener('change',stop);
  return ()=>{disposed=true;stop();changes.disconnect();visibility.disconnect();for(const clear of [...waiting.values()])clear();for(const event of ['scroll','resize','pagehide','pointerdown','keydown'])win.removeEventListener(event,stop,true);doc.removeEventListener('visibilitychange',stop);reduced.removeEventListener('change',stop);forced.removeEventListener('change',stop);};
}
