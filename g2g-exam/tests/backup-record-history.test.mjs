import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'g2g-record-history-'));
const script=resolve('scripts/backup/record-history.mjs');
const hash='a'.repeat(64);
const archive=day=>`g2g-202610${String(day).padStart(2,'0')}T030000Z.tar.gz.age`;
try {
 for(let day=1;day<=10;day++)execFileSync('node',[script,dir,archive(day),hash,day===1||day===10?'true':'false']);
 let rows=JSON.parse(await readFile(join(dir,'history.json'),'utf8'));
 assert.equal(rows.length,8);
 assert.equal(rows.filter(r=>r.type==='daily').length,7);
 assert.equal(rows.filter(r=>r.type==='monthly').length,1);
 assert.equal(rows.find(r=>r.type==='monthly').name,archive(10));
 execFileSync('node',[script,dir,archive(11),hash,'false']);
 rows=JSON.parse(await readFile(join(dir,'history.json'),'utf8'));
 assert.equal(rows.find(r=>r.type==='monthly').name,archive(10));
 assert.equal(rows.filter(r=>r.type==='daily').length,7);
 console.log('Runner history retention tests passed');
} finally {await rm(dir,{recursive:true,force:true});}
