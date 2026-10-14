import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventorySnapshot} from '../scripts/backup/inventory.mjs';
import {verifyStaging} from '../scripts/backup/verify-staging.mjs';
import {createManifest,sha256} from '../scripts/backup/manifest.mjs';
const root=await mkdtemp(join(tmpdir(),'g2g-security-'));
try{
  await mkdir(join(root,'uploads'));
  const dump=Buffer.from('fake db');
  await writeFile(join(root,'database.dump'),dump);
  await symlink('/etc/passwd',join(root,'uploads','bad'));
  await assert.rejects(inventorySnapshot({databaseDump:join(root,'database.dump'),uploadsDir:join(root,'uploads'),commit:'a'.repeat(40)}),/Symlink/);
  await rm(join(root,'uploads','bad'));
  const manifest=createManifest({commit:'a'.repeat(40),files:[{name:'database.dump',sha256:sha256(dump),size:dump.length}]});
  await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));
  await writeFile(join(root,'unlisted'),'extra');
  await assert.rejects(verifyStaging(root),/Unexpected staged file/);
  await rm(join(root,'unlisted'));
  await writeFile(join(root,'uploads','extra'),'extra');
  await assert.rejects(verifyStaging(root),/Unexpected staged file/);
  console.log('Backup staging safety checks passed');
}finally{await rm(root,{recursive:true,force:true});}
