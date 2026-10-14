import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyStaging} from '../scripts/backup/verify-staging.mjs';
import {sha256,createManifest} from '../scripts/backup/manifest.mjs';
const root=await mkdtemp(join(tmpdir(),'g2g-verify-'));
try{
 await mkdir(join(root,'uploads'));
 const dump=Buffer.from('pgdump-test'),media=Buffer.from('audio-test');
 await writeFile(join(root,'database.dump'),dump);
 await writeFile(join(root,'uploads','audio.mp3'),media);
 const manifest=createManifest({commit:'a'.repeat(40),files:[
  {name:'database.dump',sha256:sha256(dump),size:dump.length},
  {name:'uploads/audio.mp3',sha256:sha256(media),size:media.length}
 ]});
 await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));
 assert.equal((await verifyStaging(root)).files,2);
 await writeFile(join(root,'uploads','audio.mp3'),'tampered!!');
 await assert.rejects(verifyStaging(root),/Checksum mismatch/);
 await writeFile(join(root,'uploads','audio.mp3'),media);
 await writeFile(join(root,'uploads','extra.mp3'),'not in manifest');
 await assert.rejects(verifyStaging(root),/Unexpected staged file/);
 console.log('Backup staging verification tests passed');
}finally{await rm(root,{recursive:true,force:true});}
