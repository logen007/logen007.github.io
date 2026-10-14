import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventorySnapshot} from '../scripts/backup/inventory.mjs';
import {verifyManifest} from '../scripts/backup/manifest.mjs';
const base=await mkdtemp(join(tmpdir(),'g2g-inventory-'));
try {
  await mkdir(join(base,'uploads'));await mkdir(join(base,'deployment'));
  await writeFile(join(base,'database.dump'),'db');
  await writeFile(join(base,'uploads','image.png'),'image');
  await writeFile(join(base,'deployment','compose.yml'),'compose');
  const commit='a'.repeat(40);
  const manifest=await inventorySnapshot({databaseDump:join(base,'database.dump'),uploadsDir:join(base,'uploads'),deploymentDir:join(base,'deployment'),commit});
  assert.deepEqual(manifest.files.map(x=>x.name),['database.dump','uploads/image.png','deployment/compose.yml']);
  assert.equal(await verifyManifest(manifest,base),true);
  await writeFile(join(base,'uploads','image.png'),'changed');
  await assert.rejects(()=>verifyManifest(manifest,base),/Invalid file|Checksum mismatch/);
  await symlink(join(base,'database.dump'),join(base,'uploads','link'));
  await assert.rejects(()=>inventorySnapshot({databaseDump:join(base,'database.dump'),uploadsDir:join(base,'uploads'),commit}),/Symlink/);
  console.log('Backup inventory tests passed');
} finally {await rm(base,{recursive:true,force:true});}
