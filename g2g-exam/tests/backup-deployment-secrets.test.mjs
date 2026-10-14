import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateDeployment} from '../scripts/backup/validate-deployment.mjs';
const dir=await mkdtemp(join(tmpdir(),'g2g-deploy-'));
try{
 await writeFile(join(dir,'compose.yaml'),'services: {}');
 assert.equal((await validateDeployment(dir)).files,1);
 await writeFile(join(dir,'.env'),'PASSWORD=example');
 await assert.rejects(validateDeployment(dir),/Sensitive file/);
 await rm(join(dir,'.env'));
 await mkdir(join(dir,'config'));
 await writeFile(join(dir,'config','rclone.conf'),'private');
 await assert.rejects(validateDeployment(dir),/Sensitive file/);
 console.log('Deployment secret exclusion tests passed');
}finally{await rm(dir,{recursive:true,force:true});}
