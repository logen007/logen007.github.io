// Shared perspective, lighting and finite animation for solid badge symbols.
export function projectMesh(vertices,faces,degrees=0,{color=[50,147,217],center=[120,110]}={}){
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const rotated=vertices.map(([x,y,z])=>[x*c+z*s,y,z*c-x*s]);
  return faces.map((ids,id)=>{
    const points=ids.map(index=>rotated[index]);
    const [a,b,d]=points,u=b.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const light=Math.max(0,(-.45*normal[0]-.65*normal[1]+normal[2])/(Math.hypot(...normal)*1.274));
    const shade=.35+.65*light;
    const rgb=color.map(base=>Math.round(base*(.65+.35*shade)+(255-base)*shade*.7));
    const visible=normal[0]*(-a[0])+normal[1]*(-a[1])+normal[2]*(320-a[2])>0;
    return {id,depth:points.reduce((sum,p)=>sum+p[2],0)/3,opacity:visible?1:0,
      points:points.map(([x,y,z])=>{const scale=320/(320-z);return [(center[0]+x*scale).toFixed(2),(center[1]+y*scale).toFixed(2)].join(',');}).join(' '),
      fill:`rgb(${rgb.join(',')})`};
  }).sort((a,b)=>a.depth-b.depth);
}
export function meshHtml(frame,className,stroke){
  return `<g class="${className}">`+frame.map(face=>`<polygon data-mesh-face="${face.id}" points="${face.points}" fill="${face.fill}" fill-opacity="${face.opacity}" stroke="${stroke}" stroke-width=".7" stroke-opacity="${face.opacity*.55}"/>`).join('')+'</g>';
}
export function animateMesh(mesh,frameForAngle,{duration=1500,angleAt=p=>360*(p*p*(3-2*p))}={}){
  if(!mesh?.querySelectorAll||typeof requestAnimationFrame!=='function')return null;
  const polygons=new Map(Array.from(mesh.querySelectorAll('[data-mesh-face]'),polygon=>[Number(polygon.dataset.meshFace),polygon]));
  if(polygons.size!==frameForAngle(0).length)return null;
  const paint=angle=>frameForAngle(angle).forEach(face=>{
    const polygon=polygons.get(face.id);
    polygon.setAttribute('points',face.points);
    polygon.setAttribute('fill',face.fill);
    polygon.setAttribute('fill-opacity',face.opacity);
    polygon.setAttribute('stroke-opacity',face.opacity*.55);
    mesh.append(polygon);
  });
  let start,request,done=false,finish;
  const finished=new Promise(resolve=>finish=resolve);
  const cancel=()=>{
    if(done)return;
    done=true;
    globalThis.cancelAnimationFrame?.(request);
    paint(0);
    finish();
  };
  const frame=time=>{
    if(!mesh.isConnected||document.hidden){cancel();return;}
    start??=time;
    const progress=Math.min(1,(time-start)/duration);
    paint(angleAt(progress));
    if(progress<1)request=requestAnimationFrame(frame);else cancel();
  };
  request=requestAnimationFrame(frame);
  return {finished,cancel};
}
