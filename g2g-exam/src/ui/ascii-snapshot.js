export const asciiFont=style=>`${style.fontStyle||'normal'} ${style.fontWeight||'400'} ${style.fontSize||'16px'} ${style.fontFamily||'sans-serif'}`;
// Rasterize local SVG geometry synchronously: no image decode can miss first paint.
export function prepareAsciiGraphics(element,win,ready){
  const graphics=[];
  for(const svg of [...(element.tagName?.toLowerCase()==='svg'?[element]:[]),...element.querySelectorAll('svg')]){
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
        if(!matrix||style.display==='none'||style.visibility==='hidden'||style.opacity==='0')continue;
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
          if(tag==='text'){context.font=asciiFont(style);context.textAlign=style.textAnchor==='middle'?'center':style.textAnchor==='end'?'right':'left';context.fillText(node.textContent,number('x'),number('y'));}
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
  for(const node of [...(['INPUT','BUTTON','SELECT','TEXTAREA','PROGRESS','METER'].includes(element.tagName)?[element]:[]),...element.querySelectorAll('*')]){
    if(node.closest(excluded)||node.closest('svg'))continue;
    const rect=node.getBoundingClientRect(),style=win.getComputedStyle(node);
    if(!rect.width||!rect.height||style.display==='none'||style.visibility==='hidden'||style.opacity==='0')continue;
    if(style.backgroundColor&&!['transparent','rgba(0, 0, 0, 0)'].includes(style.backgroundColor)){
      context.fillStyle=style.backgroundColor;context.fillRect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);
    }
    if(node.tagName==='INPUT'&&['checkbox','radio','range','color'].includes(node.type)){
      const x=rect.left-box.left,y=rect.top-box.top,w=rect.width,h=rect.height;
      context.save();context.strokeStyle=style.color;context.fillStyle=style.accentColor&&style.accentColor!=='auto'?style.accentColor:style.color;context.lineWidth=1.5;
      if(node.type==='radio'){
        context.beginPath();context.arc(x+w/2,y+h/2,Math.max(1,Math.min(w,h)/2-2),0,Math.PI*2);context.stroke();
        if(node.checked){context.beginPath();context.arc(x+w/2,y+h/2,Math.min(w,h)/4,0,Math.PI*2);context.fill();}
      }else if(node.type==='checkbox'){
        context.strokeRect(x+1,y+1,Math.max(1,w-2),Math.max(1,h-2));
        if(node.checked){context.font=`${Math.max(8,h*.8)}px sans-serif`;context.textBaseline='middle';context.fillText('✓',x+w*.1,y+h/2,w*.8);}
      }else if(node.type==='color'){context.fillStyle=node.value;context.fillRect(x+2,y+2,Math.max(1,w-4),Math.max(1,h-4));}
      else {
        const min=Number(node.min||0),max=Number(node.max||100),ratio=Math.max(0,Math.min(1,(Number(node.value)-min)/Math.max(1,max-min)));
        context.globalAlpha=.2;context.fillRect(x,y+h*.45,w,Math.max(2,h*.1));context.globalAlpha=1;context.beginPath();context.arc(x+w*ratio,y+h/2,Math.max(3,h*.25),0,Math.PI*2);context.fill();
      }
      context.restore();continue;
    }
    if(['PROGRESS','METER'].includes(node.tagName)){
      const ratio=Math.max(0,Math.min(1,Number(node.value||0)/Number(node.max||1)));context.save();context.fillStyle=style.accentColor&&style.accentColor!=='auto'?style.accentColor:style.color;context.globalAlpha=.2;context.fillRect(rect.left-box.left,rect.top-box.top+rect.height*.25,rect.width,rect.height*.5);context.globalAlpha=1;context.fillRect(rect.left-box.left,rect.top-box.top+rect.height*.25,rect.width*ratio,rect.height*.5);context.restore();
    }
    if(['INPUT','SELECT','TEXTAREA'].includes(node.tagName)){
      const value=node.tagName==='SELECT'?node.selectedOptions?.[0]?.textContent:node.value||node.placeholder;
      if(value){context.save();context.beginPath();context.rect(rect.left-box.left,rect.top-box.top,rect.width,rect.height);context.clip();context.fillStyle=style.color;context.font=asciiFont(style);context.textBaseline='middle';context.fillText(value,rect.left-box.left+(parseFloat(style.paddingLeft)||12),rect.top-box.top+rect.height/2);context.restore();}
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
