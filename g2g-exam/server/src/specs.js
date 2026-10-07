import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../specs');
const cache=new Map();
export async function loadApprovedServerPartSpec(relativePath){
  if(cache.has(relativePath))return cache.get(relativePath);
  const data=JSON.parse(await fs.readFile(path.join(root,relativePath),'utf8'));
  if(data?.status!=='APPROVED')throw new Error(`Part spec ${relativePath} chưa được APPROVED.`);
  cache.set(relativePath,data);return data;
}
export const getA1ListeningPart1Spec=()=>loadApprovedServerPartSpec('goethe/a1/listening/part-01.json');
