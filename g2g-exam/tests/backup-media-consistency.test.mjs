import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mediaInventory} from '../scripts/backup/media-inventory.mjs';
import {sameInventory} from '../scripts/backup/compare-inventory.mjs';
const dir=await mkdtemp(join(tmpdir(),'g2g-media-'));
try {
  const media=join(dir,'media');await mkdir(media);
  await writeFile(join(media,'one.mp3'),'original');
  const before=await mediaInventory(media);
  assert.equal(before.length,1);
  assert.equal(sameInventory(before,await mediaInventory(media)),true);
  await writeFile(join(media,'one.mp3'),'changed!');
  assert.equal(sameInventory(before,await mediaInventory(media)),false);
  await writeFile(join(media,'two.png'),'new');
  assert.equal(sameInventory(before,await mediaInventory(media)),false);
  await rm(join(media,'one.mp3'));
  assert.equal(sameInventory(before,await mediaInventory(media)),false);
  console.log('Backup media consistency tests passed');
} finally {await rm(dir,{recursive:true,force:true});}
