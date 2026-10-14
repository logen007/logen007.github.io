import {projectMesh,meshHtml,animateMesh} from './faceted-mesh.js';
const outline=[[0,-63],[19,-29],[57,-34],[43,0],[60,33],[21,34],[0,63],[-21,34],[-60,33],[-43,0],[-57,-34],[-19,-29]];
const starVertices=[[0,0,24],[0,0,-10],...outline.map(([x,y])=>[x*.97,y*.97,10]),...outline.map(([x,y])=>[x*.97,y*.97,-10])];
const starFaces=outline.flatMap((_,i)=>{
  const next=(i+1)%outline.length,a=2+i,b=2+next,c=14+i,d=14+next;
  return [[0,a,b],[1,d,c],[a,c,b],[b,c,d]];
});
export function starFrame(degrees=0){
  return projectMesh(starVertices,starFaces,degrees,{color:[36,162,125],center:[120,111]});
}
export function starMeshHtml(){
  return meshHtml(starFrame(),'result-medal-star','#c2f5e6');
}
export function animateStar(mesh){
  const smooth=t=>t*t*(3-2*t);
  return animateMesh(mesh,starFrame,{duration:1600,angleAt:p=>{
    if(p<.25)return -32*smooth(p/.25);
    if(p<.75)return -32+64*smooth((p-.25)/.5);
    return 32*(1-smooth((p-.75)/.25));
  }});
}
