import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMediaCopier} from '../server/src/copy-media.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-copy-media-'));
try{
  await fs.writeFile(path.join(root,'source.png'),'image bytes');
  await fs.writeFile(path.join(root,'audio.mp3'),'audio bytes');
  const original={image:'/uploads/source.png',choices:[{image:'/uploads/source.png'}],sections:[{audio:'/uploads/audio.mp3'}]};
  const copy=await createMediaCopier(root)(original);
  assert.notEqual(copy.image,original.image);
  assert.equal(copy.image,copy.choices[0].image);
  assert.notEqual(copy.sections[0].audio,original.sections[0].audio);
  await fs.unlink(path.join(root,'source.png'));
  await fs.unlink(path.join(root,'audio.mp3'));
  assert.equal(await fs.readFile(path.join(root,path.basename(copy.image)),'utf8'),'image bytes');
  assert.equal(await fs.readFile(path.join(root,path.basename(copy.sections[0].audio)),'utf8'),'audio bytes');
  await assert.rejects(()=>createMediaCopier(root)('/uploads/missing.png'),/Không thể sao chép/);
  console.log('Independent media copies survive source deletion; nested references and missing files passed.');
}finally{await fs.rm(root,{recursive:true,force:true});}
