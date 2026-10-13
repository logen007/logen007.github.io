import {createHash} from 'node:crypto';

const metadata=new Set(['updatedAt','createdAt','publishedAt','lockedAt','locked','status','ownerId','ownerName','version','publicationVersion','publicationLabel','usedCount','correctRate','hidden','learningLevel','deletedAt']);
const clean=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!metadata.has(key)));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const publicationLabel=version=>`1.0.${version-1}`;
export function releaseHash(exam,questions){
  const {questionSnapshot,...content}=clean(exam);
  return createHash('sha256').update(JSON.stringify(canonical({exam:content,questions:questions.map(clean).sort((a,b)=>a.id.localeCompare(b.id))}))).digest('hex');
}
