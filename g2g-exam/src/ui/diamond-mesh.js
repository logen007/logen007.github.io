// Eight triangular faces of a solid bipyramid, projected into the badge SVG.
import {projectMesh,meshHtml,animateMesh} from './faceted-mesh.js';
const vertices=[[0,-61,0],[0,61,0],[0,0,22],[52,0,0],[0,0,-22],[-52,0,0]];
const faces=[[0,3,2],[0,4,3],[0,5,4],[0,2,5],[1,2,3],[1,3,4],[1,4,5],[1,5,2]];
export function diamondFrame(degrees=0){
  return projectMesh(vertices,faces,degrees);
}
export function diamondMeshHtml(){
  return meshHtml(diamondFrame(),'result-medal-diamond','#c4edff');
}
export function animateDiamond(mesh){
  return animateMesh(mesh,diamondFrame);
}
