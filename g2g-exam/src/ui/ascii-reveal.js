import {createAsciiHistory} from './ascii-history.js';
import {prepareAsciiGraphics,paintAsciiBlock,asciiFont} from './ascii-snapshot.js';
import {ASCII_REVEAL_EXCLUDED,ASCII_CONTROL_EXCLUDED,isAsciiControl,asciiExclusion,collectAsciiTargets,asciiContentUnits,asciiCoverage} from './ascii-policy.js';
export {ASCII_REVEAL_SELECTOR,ASCII_REVEAL_EXCLUDED} from './ascii-policy.js';
const glyphs=' .:-=+*#%@',duration=1100,hold=220;
const variants=[' ','.`',':;','-_','=~','+x','*o','#H','%8','@&'];
const excluded=ASCII_REVEAL_EXCLUDED,controlExcluded=ASCII_CONTROL_EXCLUDED;
const isControl=isAsciiControl,eligible=element=>!asciiExclusion(element);


export function bindAsciiReveals(root){
  const doc=root.ownerDocument,win=doc.defaultView;
  if(!win.IntersectionObserver||!win.MutationObserver||!win.requestAnimationFrame)return ()=>{};
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),forced=win.matchMedia('(forced-colors: active)');
  let registered=new WeakSet(),outcomes=new WeakMap(),preferenceEnabled=doc.documentElement.dataset?.asciiEnabled!=='off';
  const seen=createAsciiHistory(win),active=new Set(),waiting=new Map(),continuations=new Map();let route=win.location.pathname+win.location.search,paintInterval=32,batchStart=null,firstVisible=new WeakMap(),frame=0,disposed=false,lastPaint=-Infinity;
  const allowed=()=>!disposed&&doc.documentElement.dataset?.asciiEnabled!=='off'&&!doc.hidden&&!reduced.matches&&!forced.matches&&!win.navigator.connection?.saveData&&!(win.navigator.hardwareConcurrency>0&&win.navigator.hardwareConcurrency<=2);
  const record=(element,status)=>{
    outcomes.set(element,status);
    for(const unit of asciiContentUnits(element))if(!asciiExclusion(unit)){
      const box=unit.getBoundingClientRect(),visible=box.width>0&&box.height>0&&box.top<win.innerHeight&&box.top+box.height>0&&box.left+box.width>0&&box.left<(win.innerWidth||Infinity);
      if((status.state==='active'||status.state==='completed')&&!visible){
        outcomes.set(unit,{state:'pending',reason:'visibility'});
        if(!registered.has(unit)){registered.add(unit);visibility.observe(unit);}
      }else outcomes.set(unit,status);
    }
    return status;
  };
  const remove=(item,reason='finished')=>{item.canvas.remove();active.delete(item);item.status.state=reason==='finished'?'completed':'excluded';item.status.reason=reason;};
  const stop=()=>{win.cancelAnimationFrame(frame);frame=0;continuations.clear();for(const clear of [...waiting.values()])clear();for(const item of [...active])remove(item,'interaction-or-lifecycle');};
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
  function paintAt(item,now){
    const elapsed=now-item.start,progress=Math.max(0,Math.min(1,(elapsed-hold)/(duration-hold)));
    paint(item,Math.floor(progress*(item.cols+item.rows)),Math.floor(elapsed/100));
  }
  function rebalance(){
    // Reduce detail evenly rather than dropping later cards/rows/images altogether.
    const limit=Math.max(1,Math.floor(36000/active.size));
    for(const item of active)if(item.cols*item.rows>limit){
      const scale=Math.sqrt(limit/(item.cols*item.rows)),cols=Math.max(1,Math.floor(item.cols*scale)),rows=Math.max(1,Math.floor(item.rows*scale)),cells=new Map();
      for(const cell of item.cells){const x=Math.min(cols-1,Math.floor(cell.x*cols/item.cols)),y=Math.min(rows-1,Math.floor(cell.y*rows/item.rows));cells.set(y*cols+x,{...cell,x,y});}
      item.cols=cols;item.rows=rows;item.cellW=item.canvas.width/cols;item.cellH=item.canvas.height/rows;item.cells=[...cells.values()];
      item.context.font=Math.max(7,item.cellH)+'px monospace';paintAt(item,win.performance.now());
    }
  }
  function tick(now){
    frame=0;if(!allowed()){stop();return;}
    if(now-lastPaint<paintInterval){if(active.size)frame=win.requestAnimationFrame(tick);return;}lastPaint=now;
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
    if(win.performance.now()-started>24)paintInterval=Math.min(100,paintInterval*2);
    if(active.size&&!frame)frame=win.requestAnimationFrame(tick);
  }
  const keyFor=element=>{
    const dashboard=element.closest('.admin-dashboard');
    let identity=element.getAttribute?.('data-ascii-key')||element.id;
    if(!identity){
      const path=[];for(let node=element;node&&node!==(dashboard||root);node=node.parentElement)path.push(node.tagName+':'+Array.from(node.parentElement?.children||[]).indexOf(node));
      identity='target:'+path.reverse().join('/')+(element.tagName==='IMG'?'|'+(element.currentSrc||element.src):'');
    }
    const namespace=element.closest?.('.thanh-dau')?'shared-header':win.location.pathname+win.location.search;
    return namespace+'|'+(identity||(element.tagName==='IMG'?element.currentSrc||element.src:element.textContent));
  };
  const cached=element=>{seen.add(keyFor(element));for(const unit of asciiContentUnits(element))if(!asciiExclusion(unit))seen.add(keyFor(unit));record(element,{state:'completed',reason:'cached-content'});};
  function reveal(element,graphics=[]){
    if(!allowed()||!element.isConnected||!eligible(element)||doc.activeElement===element||doc.activeElement&&element.contains(doc.activeElement)){record(element,{state:'excluded',reason:!allowed()?'preference-or-accessibility':'protected-or-focused'});return;}
    const image=['IMG','CANVAS'].includes(element.tagName),block=!image&&!/^H[1-6]$/.test(element.tagName),key=keyFor(element);
    const continuation=continuations.get(key),now=win.performance.now();
    if(element.closest?.('[data-ascii-cached]')||seen.has(key)&&(!continuation||now-continuation.start>=duration)){cached(element);return;}
    const raw=element.getBoundingClientRect(),left=Math.max(0,raw.left),top=Math.max(0,raw.top);
    // Snapshot only the visible intersection, including large or horizontally scrolled rows.
    const box={left,top,width:Math.min(raw.left+raw.width,win.innerWidth||raw.left+raw.width)-left,height:Math.min(raw.top+raw.height,win.innerHeight)-top};
    if(box.width<=0||box.height<=0){record(element,{state:'pending',reason:'outside-viewport'});return;}
    let cols=Math.min(image||block?100:140,Math.ceil(box.width/(image||block?8:5))),rows=Math.min(60,Math.ceil(box.height/(image||block?10:7)));
    if(cols*rows>2000){const scale=Math.sqrt(2000/(cols*rows));cols=Math.max(1,Math.floor(cols*scale));rows=Math.max(1,Math.floor(rows*scale));}
    if(box.width<32&&box.height<32){cols=Math.max(1,Math.ceil(box.width/2));rows=Math.max(1,Math.ceil(box.height/2));}
    const control=isControl(element);
    let canvas;
    try{
      const source=doc.createElement('canvas');source.width=Math.ceil(box.width);source.height=Math.ceil(box.height);
      const sourceContext=source.getContext('2d');if(!sourceContext)throw Error('canvas-unavailable');
      const style=win.getComputedStyle(element);
      if(image){
        const naturalWidth=element.naturalWidth||element.width,naturalHeight=element.naturalHeight||element.height;
        if(!naturalWidth||!naturalHeight)throw Error('image-unavailable');
        const scale=style.objectFit==='contain'?Math.min(raw.width/naturalWidth,raw.height/naturalHeight):Math.max(raw.width/naturalWidth,raw.height/naturalHeight);
        const width=naturalWidth*scale,height=naturalHeight*scale;
        sourceContext.drawImage(element,raw.left-box.left+(raw.width-width)/2,raw.top-box.top+(raw.height-height)/2,width,height);
      }else{
        if(block)paintAsciiBlock(element,sourceContext,box,graphics,win,isControl(element)?controlExcluded:excluded);
        const walker=doc.createTreeWalker(element,win.NodeFilter.SHOW_TEXT),range=doc.createRange();let node;
        sourceContext.fillStyle='#fff';sourceContext.textBaseline='top';
        while((node=walker.nextNode())){
          if(asciiExclusion(node.parentElement)||node.parentElement.closest('svg'))continue;
          const textStyle=win.getComputedStyle(node.parentElement);
          if(textStyle.display==='none'||textStyle.visibility==='hidden')continue;
          sourceContext.fillStyle=block?textStyle.color:'#fff';
          sourceContext.font=asciiFont(textStyle);
          // Measure words, not every glyph; fall back only for a word that wraps.
          for(const match of node.textContent.matchAll(/\S+/g)){
            range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);const rect=range.getBoundingClientRect();
            if(!rect.width||!rect.height)continue;
            if(rect.height<=(parseFloat(textStyle.fontSize)||32)*1.5)sourceContext.fillText(match[0],rect.left-box.left,rect.top-box.top,rect.width);
            else for(let index=match.index;index<match.index+match[0].length;index++){
              range.setStart(node,index);range.setEnd(node,index+1);const char=range.getBoundingClientRect();
              if(char.width&&char.height)sourceContext.fillText(node.textContent[index],char.left-box.left,char.top-box.top);
            }
          }
        }
      }
      const sample=doc.createElement('canvas');sample.width=cols;sample.height=rows;
      const sampling=sample.getContext('2d',{willReadFrequently:true});if(!sampling)throw Error('canvas-unavailable');
      sampling.drawImage(source,0,0,cols,rows);
      // Cross-origin/tainted images fail here: leave their real image untouched.
      const pixels=sampling.getImageData(0,0,cols,rows).data;
      if(!pixels.some((value,index)=>index%4===3&&value>0))throw Error('empty-snapshot');
      canvas=doc.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      canvas.className='ascii-reveal-layer';canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',borderRadius:style.borderRadius});
      const context=canvas.getContext('2d');if(!context)throw Error('canvas-unavailable');
      const cellW=box.width/cols,cellH=box.height/rows;
      context.font=Math.max(7,cellH)+'px monospace';context.textBaseline='top';
      const backdrop=background(element),rgb=backdrop.match(/[\d.]+/g)?.map(Number)||[255,255,255],backdropTone=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
      const cells=[];
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const at=(y*cols+x)*4,alpha=pixels[at+3]/255;
        if(alpha===0)continue;
        const luminance=(pixels[at]*.2126+pixels[at+1]*.7152+pixels[at+2]*.0722)/255;
        const tone=image?luminance:block?Math.sqrt(alpha)*(.35+.65*Math.abs(luminance-backdropTone)):Math.sqrt(alpha);
        cells.push({x,y,density:Math.max(1,Math.round(tone*(glyphs.length-1))),color:image||block?`rgb(${pixels[at]},${pixels[at+1]},${pixels[at+2]})`:style.color});
      }
      const protectedNodes=[...element.querySelectorAll(excluded),...element.querySelectorAll('img')].filter(node=>node.tagName!=='IMG'||!node.complete||!node.naturalWidth||new URL(node.currentSrc||node.src,win.location.href).origin!==win.location.origin);
      // Unsupported chart geometry stays visible through a transparent hole.
      protectedNodes.push(...[...element.querySelectorAll('svg')].filter(svg=>!graphics.some(graphic=>graphic.element===svg)));
      const holes=protectedNodes.map(node=>node.getBoundingClientRect()).map(rect=>({x:rect.left-box.left-2,y:rect.top-box.top-2,width:rect.width+4,height:rect.height+4}));
      const item={key,element,canvas,context,cols,rows,cellW,cellH,image,control,cells,holes,background:backdrop,start:continuation?.start??batchStart??now};
      doc.body.append(canvas);active.add(item);item.status=record(element,{state:'active'});
      for(const node of protectedNodes)if(!asciiExclusion(node))record(node,{state:'fallback',reason:'unsupported-or-unloaded-media'});
      rebalance();paintAt(item,win.performance.now());seen.add(key);
      if(!frame)frame=win.requestAnimationFrame(tick);
    }catch(error){canvas?.remove();const reason=error?.name==='SecurityError'?'cross-origin-media':['empty-snapshot','canvas-unavailable','image-unavailable'].includes(error?.message)?error.message:'snapshot-unavailable';record(element,{state:'fallback',reason});} // Decoration must never prevent navigation or content.
  }
  const start=element=>{
    if(!allowed()){if(!doc.hidden)seen.add(keyFor(element));record(element,{state:doc.hidden?'pending':'excluded',reason:doc.hidden?'hidden-document':'preference-or-accessibility'});return;}
    if(!firstVisible.has(element))firstVisible.set(element,win.performance.now());
    try{prepareAsciiGraphics(element,win,graphics=>reveal(element,graphics));}
    catch{reveal(element);}
  };
  const enter=element=>{
    if(element.closest?.('[data-ascii-cached]')){cached(element);return;}
    if(!firstVisible.has(element))firstVisible.set(element,win.performance.now());
    if(element.tagName==='IMG'&&!element.complete){
      const clear=()=>{element.removeEventListener('load',loaded);element.removeEventListener('error',failed);waiting.delete(element);};
      const failed=()=>{clear();record(element,{state:'fallback',reason:'image-unavailable'});};
      const loaded=()=>{clear();if(win.performance.now()-(firstVisible.get(element)??0)<=80)start(element);else record(element,{state:'fallback',reason:'late-image'});};
      record(element,{state:'pending',reason:'image-loading'});waiting.set(element,clear);element.addEventListener('load',loaded,{once:true});element.addEventListener('error',failed,{once:true});
    }else start(element);
  };
  const visibility=new win.IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      const element=entry.target;visibility.unobserve(element);
      enter(element);
    }
  },{threshold:0});
  const scan=nodes=>{
    const currentRoute=win.location.pathname+win.location.search;
    if(currentRoute!==route){stop();visibility.disconnect();registered=new WeakSet();firstVisible=new WeakMap();route=currentRoute;paintInterval=32;}
    batchStart=win.performance.now();
    for(const element of collectAsciiTargets(nodes))if(!registered.has(element)&&outcomes.get(element)?.state!=='completed'&&![...active].some(item=>item.element!==element&&item.element.contains(element))){
      registered.add(element);record(element,{state:'pending',reason:'visibility'});const box=element.getBoundingClientRect();
      if(element.getClientRects&&box.width>0&&box.height>0&&box.bottom>0&&box.top<win.innerHeight)enter(element);
      else visibility.observe(element);
    }
    batchStart=null;
  };
  const changes=new win.MutationObserver(records=>{
    for(const [element,clear] of waiting)if(!element.isConnected)clear();
    const refresh=[];
    for(const item of [...active])if(!item.element.isConnected||records.some(record=>record.target&&item.element.contains(record.target))){
      if(win.performance.now()-item.start<duration)continuations.set(item.key,{start:item.start});
      if(item.element.isConnected)refresh.push(item.element);
      remove(item);
    }
    // Replace snapshots before paint, preserving the existing decode clock/phase.
    for(const element of refresh)start(element);
    scan(records.flatMap(record=>[...record.addedNodes,...(record.type==='characterData'?[record.target]:[])]));
    continuations.clear();
  });
  changes.observe(root,{childList:true,characterData:true,subtree:true});scan(root);
  for(const event of ['scroll','resize','pagehide','pointerdown','keydown','focusin'])win.addEventListener(event,stop,{passive:true,capture:true});
  const documentVisibilityChanged=()=>{stop();if(!doc.hidden){visibility.disconnect();registered=new WeakSet();firstVisible=new WeakMap();scan(root);}};
  doc.addEventListener('visibilitychange',documentVisibilityChanged);reduced.addEventListener('change',stop);forced.addEventListener('change',stop);
  const preferenceChanged=()=>{
    const enabled=doc.documentElement.dataset?.asciiEnabled!=='off',wasEnabled=preferenceEnabled;
    preferenceEnabled=enabled;
    if(!enabled||!wasEnabled){
      stop();for(const clear of [...waiting.values()])clear();
    }
    if(enabled&&!wasEnabled){
      // Off/on is an explicit new reveal session, unlike polling or theme refresh.
      visibility.disconnect();registered=new WeakSet();outcomes=new WeakMap();firstVisible=new WeakMap();lastPaint=-Infinity;paintInterval=32;scan(root);
    }
  };
  win.addEventListener('g2g-ascii-preference',preferenceChanged);
  const dispose=()=>{disposed=true;stop();changes.disconnect();visibility.disconnect();for(const clear of [...waiting.values()])clear();for(const event of ['scroll','resize','pagehide','pointerdown','keydown','focusin'])win.removeEventListener(event,stop,true);win.removeEventListener('g2g-ascii-preference',preferenceChanged);doc.removeEventListener('visibilitychange',documentVisibilityChanged);reduced.removeEventListener('change',stop);forced.removeEventListener('change',stop);};
  dispose.coverage=()=>asciiCoverage(root,element=>outcomes.get(element));
  return dispose;
}
