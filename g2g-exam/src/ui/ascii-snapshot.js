// Capture local chart geometry once. No HTML screenshot service or remote fetch.
export function prepareAsciiGraphics(element,win,ready){
  const svgs=[...element.querySelectorAll('svg')].filter(svg=>!svg.closest('button,a,summary,[role=status],[role=alert]'));
  if(!svgs.length){ready([]);return ()=>{};}
  let cancelled=false,left=svgs.length;const graphics=[],images=[];
  const finish=()=>{if(!cancelled){cancelled=true;win.clearTimeout(timer);for(const image of images)image.onload=image.onerror=null;ready(graphics);}};
  const timer=win.setTimeout(finish,400);
  for(const svg of svgs){
    const copy=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
    // SVG paths use CSS variables in the live theme. Resolve them before decoding.
    for(let i=0;i<originals.length;i++){
      const style=win.getComputedStyle(originals[i]);
      for(const prop of ['fill','stroke','stroke-width','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','color','font','display','visibility'])copies[i].style.setProperty(prop,style.getPropertyValue(prop));
    }
    // Charts/icons are local vector geometry; never load embedded external assets.
    for(const node of copy.querySelectorAll('image,foreignObject,script,style,use'))node.remove();
    const box=svg.getBoundingClientRect();copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',box.width);copy.setAttribute('height',box.height);
    const image=new win.Image();images.push(image);
    image.onload=()=>{if(cancelled)return;graphics.push({element:svg,image});if(--left===0)finish();};
    image.onerror=()=>{if(!cancelled&&--left===0)finish();};
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new win.XMLSerializer().serializeToString(copy));
  }
  return ()=>{cancelled=true;win.clearTimeout(timer);for(const image of images)image.onload=image.onerror=null;};
}

export function paintAsciiBlock(element,context,box,graphics,win,excluded){
  // Capture filled bars/tracks and local images, not just text outlines.
  for(const node of element.querySelectorAll('*')){
    if(node.closest(excluded)||node.closest('svg'))continue;
    const rect=node.getBoundingClientRect(),style=win.getComputedStyle(node);
    if(!rect.width||!rect.height||style.display==='none'||style.visibility==='hidden')continue;
    if(style.backgroundColor&&!['transparent','rgba(0, 0, 0, 0)'].includes(style.backgroundColor)){
      context.fillStyle=style.backgroundColor;context.fillRect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);
    }
    if(node.tagName==='IMG'&&node.complete&&node.naturalWidth){
      // Third-party avatar URLs must not taint the entire card canvas.
      const url=new URL(node.currentSrc||node.src,win.location.href);
      if(url.origin!==win.location.origin&&url.protocol!=='data:')continue;
      const scale=style.objectFit==='contain'?Math.min(rect.width/node.naturalWidth,rect.height/node.naturalHeight):Math.max(rect.width/node.naturalWidth,rect.height/node.naturalHeight);
      context.save();context.beginPath();context.rect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);context.clip();
      context.drawImage(node,rect.left-box.left+(rect.width-node.naturalWidth*scale)/2,rect.top-box.top+(rect.height-node.naturalHeight*scale)/2,node.naturalWidth*scale,node.naturalHeight*scale);context.restore();
    }
  }
  for(const {element:svg,image} of graphics){const rect=svg.getBoundingClientRect();context.drawImage(image,rect.left-box.left,rect.top-box.top,rect.width,rect.height);}
}
