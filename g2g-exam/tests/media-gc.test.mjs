import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {referencedUploadNames,runMediaGarbageCollection} from '../server/src/media-gc.js';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'g2g-media-gc-'));
const silent={info(){},error(){}};

try{
  const referenced='used.mp3',oldOrphan='old-orphan.png',freshOrphan='fresh-orphan.png';
  await Promise.all([
    fs.writeFile(path.join(root,referenced),'used'),
    fs.writeFile(path.join(root,oldOrphan),'old garbage'),
    fs.writeFile(path.join(root,freshOrphan),'new upload'),
  ]);
  const old=new Date(Date.now()-3*60*60*1000);
  await Promise.all([
    fs.utimes(path.join(root,referenced),old,old),
    fs.utimes(path.join(root,oldOrphan),old,old),
  ]);

  const result=await runMediaGarbageCollection({
    uploadDir:root,
    graceHours:1,
    logger:silent,
    referenceLoader:async()=>new Set([referenced]),
  });
  assert.equal(result.scanned,3);
  assert.equal(result.deleted,1);
  assert.equal(result.deletedBytes,11);
  assert.equal(await fs.readFile(path.join(root,referenced),'utf8'),'used');
  await assert.rejects(fs.stat(path.join(root,oldOrphan)),error=>error.code==='ENOENT');
  assert.equal(await fs.readFile(path.join(root,freshOrphan),'utf8'),'new upload');

  const sql=[];
  const refs=await referencedUploadNames({query:async statement=>{
    sql.push(statement);
    return {rows:statement.includes('questions')?[{data:{audioUrl:'/uploads/question.mp3'}}]:statement.includes('settings')?[{data:{general:{logoUrl:'/uploads/logo.png'}}}]:[]};
  }});
  assert.deepEqual([...refs].sort(),['logo.png','question.mp3']);
  assert.equal(sql.some(statement=>statement.includes('question_groups')),false);
  assert.deepEqual(sql,[
    'SELECT data FROM questions',
    'SELECT data FROM exams',
    'SELECT public_data,private_data FROM attempts',
    'SELECT data FROM notifications',
    'SELECT data FROM settings',
  ]);
  console.log('✓ Media GC giữ file đang dùng, bảo vệ upload mới và xóa đúng file mồ côi quá hạn.');
}finally{
  await fs.rm(root,{recursive:true,force:true});
}
