import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeStatus,readStatus,dashboardBackupLabel,validateStatus} from '../scripts/backup/status.mjs';
const dir=await mkdtemp(join(tmpdir(),'g2g-status-test-'));
try{
 assert.equal(await readStatus(dir),null);
 const now='2026-10-14T08:00:00.000Z';
 const item={state:'success',updatedAt:now,finishedAt:now,archive:'g2g-20261014T080000Z.tar.gz.age'};
 assert.deepEqual(await writeStatus(dir,item),item);
 assert.deepEqual(await readStatus(dir),item);
 assert.equal(dashboardBackupLabel(item,Date.parse(now)+3600000),'Backup · OK');
 assert.equal(dashboardBackupLabel(item,Date.parse(now)+40*3600000),'Backup · Quá hạn');
 assert.equal(dashboardBackupLabel({state:'failed',updatedAt:now}),'Backup · Thất bại');
 assert.throws(()=>validateStatus({...item,state:'bogus'}));
 assert.throws(()=>validateStatus({...item,archive:'../../secrets'}));
 assert.equal((await readFile(join(dir,'status.json'),'utf8')).includes('secret'),false);
 console.log('backup-status tests passed');
}finally{await rm(dir,{recursive:true,force:true});}
