// Eight triangular faces of a solid bipyramid, projected into the badge SVG.
const vertices=[[0,-61,0],[0,61,0],[0,0,22],[52,0,0],[0,0,-22],[-52,0,0]];
const faces=[[0,3,2],[0,4,3],[0,5,4],[0,2,5],[1,2,3],[1,3,4],[1,4,5],[1,5,2]];
export function diamondFrame(degrees=0){
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const rotated=vertices.map(([x,y,z])=>[x*c+z*s,y,z*c-x*s]);
  return faces.map((ids,id)=>{
    const points=ids.map(index=>rotated[index]);
    const [a,b,d]=points,u=b.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...normal);
    const light=Math.max(0,(-.45*normal[0]-.65*normal[1]+normal[2])/(length*1.274));
    const shade=.35+.65*light;
    const rgb=[50,147,217].map(base=>Math.round(base*(.65+.35*shade)+(255-base)*shade*.7));
    return {id,depth:points.reduce((sum,p)=>sum+p[2],0)/3,
      points:points.map(([x,y,z])=>{const scale=320/(320-z);return [(120+x*scale).toFixed(2),(110+y*scale).toFixed(2)].join(',');}).join(' '),
      fill:`rgb(${rgb.join(',')})`};
  }).sort((a,b)=>a.depth-b.depth);
}
export function diamondMeshHtml(){
  return '<g class="result-medal-diamond">'+diamondFrame().map(face=>`<polygon data-diamond-face="${face.id}" points="${face.points}" fill="${face.fill}" stroke="#c4edff" stroke-width=".7" stroke-opacity=".55"/>`).join('')+'</g>';
}
export function animateDiamond(mesh){
  if(!mesh?.querySelectorAll||typeof requestAnimationFrame!=='function')return null;
  const polygons=new Map(Array.from(mesh.querySelectorAll('[data-diamond-face]'),polygon=>[Number(polygon.dataset.diamondFace),polygon]));
  if(polygons.size!==faces.length)return null;
  const paint=angle=>diamondFrame(angle).forEach(face=>{
    const polygon=polygons.get(face.id);
    polygon.setAttribute('points',face.points);
    polygon.setAttribute('fill',face.fill);
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
    const progress=Math.min(1,(time-start)/1500);
    paint(360*(progress*progress*(3-2*progress)));
    if(progress<1)request=requestAnimationFrame(frame);else cancel();
  };
  request=requestAnimationFrame(frame);
  return {finished,cancel};
}
