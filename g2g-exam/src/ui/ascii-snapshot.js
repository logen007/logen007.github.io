// Rasterize local SVG geometry synchronously: no image decode can miss first paint.
export function prepareAsciiGraphics(element,win,ready){
  const graphics=[];
  for(const svg of element.querySelectorAll('svg')){
    if(svg.closest('[role=alert]'))continue;
    try{
      if(!win.Path2D||!svg.getScreenCTM)continue;
      const box=svg.getBoundingClientRect(),image=svg.ownerDocument.createElement('canvas');
      image.width=Math.ceil(box.width);image.height=Math.ceil(box.height);
      const context=image.getContext('2d');if(!context||!box.width||!box.height)continue;
      // Complex/external SVGs retain their real rendering through a transparent hole.
      if(svg.querySelector('image,foreignObject,use,filter,mask,clipPath,linearGradient,radialGradient'))continue;
      for(const node of svg.querySelectorAll('path,circle,ellipse,rect,line,polyline,polygon,text')){
        const style=win.getComputedStyle(node),matrix=node.getScreenCTM();
        if(!matrix||style.display==='none'||style.visibility==='hidden')continue;
        const number=name=>Number(node.getAttribute(name)||0),tag=node.tagName.toLowerCase();
        context.save();context.setTransform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e-box.left,matrix.f-box.top);
        let opacity=1;for(let parent=node;parent&&parent!==svg.parentElement;parent=parent.parentElement)opacity*=Number(win.getComputedStyle(parent).opacity||1);
        context.globalAlpha=opacity;
        const path=new win.Path2D(tag==='path'?node.getAttribute('d')||'':undefined);
        if(tag==='circle')path.arc(number('cx'),number('cy'),number('r'),0,Math.PI*2);
        else if(tag==='ellipse')path.ellipse(number('cx'),number('cy'),number('rx'),number('ry'),0,0,Math.PI*2);
        else if(tag==='rect')path.rect(number('x'),number('y'),number('width'),number('height'));
        else if(tag==='line'){path.moveTo(number('x1'),number('y1'));path.lineTo(number('x2'),number('y2'));}
        else if(tag==='polyline'||tag==='polygon'){
          const points=(node.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number);
          for(let i=0;i+1<points.length;i+=2)path[i?'lineTo':'moveTo'](points[i],points[i+1]);
          if(tag==='polygon')path.closePath();
        }
        if(style.fill&&style.fill!=='none'){
          context.fillStyle=style.fill;context.globalAlpha=opacity*Number(style.fillOpacity||1);
          if(tag==='text'){context.font=style.font;context.textAlign=style.textAnchor==='middle'?'center':style.textAnchor==='end'?'right':'left';context.fillText(node.textContent,number('x'),number('y'));}
          else context.fill(path,style.fillRule==='evenodd'?'evenodd':'nonzero');
        }
        if(tag!=='text'&&style.stroke&&style.stroke!=='none'){
          context.strokeStyle=style.stroke;context.globalAlpha=opacity*Number(style.strokeOpacity||1);
          context.lineWidth=parseFloat(style.strokeWidth)||1;context.lineCap=style.strokeLinecap||'butt';context.lineJoin=style.strokeLinejoin||'miter';
          const specified=Number(node.getAttribute('pathLength')),scale=specified>0?node.getTotalLength()/specified:1;
          context.setLineDash(style.strokeDasharray&&style.strokeDasharray!=='none'?style.strokeDasharray.split(/[\s,]+/).map(value=>parseFloat(value)*scale):[]);
          context.lineDashOffset=(parseFloat(style.strokeDashoffset)||0)*scale;context.stroke(path);
        }
        context.restore();
      }
      graphics.push({element:svg,image});
    }catch{} // Unsupported geometry must not suppress the surrounding card reveal.
  }
  ready(graphics);return ()=>{};
}

export function paintAsciiBlock(element,context,box,graphics,win,excluded){
  // Capture filled bars/tracks and local images, not just text outlines.
  for(const node of [...(['INPUT','BUTTON','SELECT','TEXTAREA'].includes(element.tagName)?[element]:[]),...element.querySelectorAll('*')]){
    if(node.closest(excluded)||node.closest('svg'))continue;
    const rect=node.getBoundingClientRect(),style=win.getComputedStyle(node);
    if(!rect.width||!rect.height||style.display==='none'||style.visibility==='hidden')continue;
    if(style.backgroundColor&&!['transparent','rgba(0, 0, 0, 0)'].includes(style.backgroundColor)){
      context.fillStyle=style.backgroundColor;context.fillRect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);
    }
    if(['INPUT','SELECT','TEXTAREA'].includes(node.tagName)){
      const value=node.tagName==='SELECT'?node.selectedOptions?.[0]?.textContent:node.value||node.placeholder;
      if(value){context.save();context.beginPath();context.rect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);context.clip();context.fillStyle=style.color;context.font=style.font;context.textBaseline='middle';context.fillText(value,rect.left-box.left+(parseFloat(style.paddingLeft)||12),rect.top-box.top+rect.height/2);context.restore();}
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
