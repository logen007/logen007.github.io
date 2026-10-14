import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addVerified,readHistory,writeHistory,validateHistory} from '../scripts/backup/history.mjs';
const item=(day,type='daily')=>({name:`g2g-202610${String(day).padStart(2,'0')}T030000Z.tar.gz.age`,type,sha256:'a'.repeat(64),size:100});
let history=[];
for(let d=1;d<=10;d++)history=addVerified(history,item(d));
assert.equal(history.length,7);
assert.deepEqual(history.map(x=>x.name),Array.from({length:7},(_,i)=>item(i+4).name).reverse());
history=addVerified(history,item(1,'monthly'));
history=addVerified(history,item(2,'monthly'));
assert.equal(history.length,8);
assert.equal(history.filter(x=>x.type==='monthly')[0].name,item(2).name);
assert.throws(()=>validateHistory([item(1),item(1)]),/Duplicate/);
assert.throws(()=>validateHistory([{...item(1),name:'../bad'}]),/Invalid/);
const dir=await mkdtemp(join(tmpdir(),'g2g-history-'));
try{await writeHistory(dir,history);assert.deepEqual(await readHistory(dir),history);}finally{await rm(dir,{recursive:true,force:true});}
console.log('Backup history tests passed');
