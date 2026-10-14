import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createManifest,sha256,verifyManifest} from '../scripts/backup/manifest.mjs';
const dir=await mkdtemp(join(tmpdir(),'g2g-backup-test-'));
try {
 const data=Buffer.from('database-test');await writeFile(join(dir,'database.dump'),data);
 const m=createManifest({commit:'a'.repeat(40),files:[{name:'database.dump',size:data.length,sha256:sha256(data)}]});
 assert.equal(await verifyManifest(m,dir),true);
 await writeFile(join(dir,'database.dump'),'corrupted data');
 await assert.rejects(()=>verifyManifest(m,dir));
 assert.throws(()=>createManifest({commit:'a'.repeat(40),files:[{name:'uploads/../secret',size:0,sha256:'a'.repeat(64)}]}));
 console.log('Backup manifest tests passed');
} finally {await rm(dir,{recursive:true,force:true});}
