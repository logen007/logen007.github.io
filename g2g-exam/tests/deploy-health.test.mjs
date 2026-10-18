// Execute the real deploy shell with command doubles: no git mutation, Docker,
// network, secrets, database or production deployment occurs in this test.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const scratch=await mkdtemp(path.join(os.tmpdir(),'g2g-deploy-health-'));
const shell=fileURLToPath(new URL('../server/auto-deploy.sh',import.meta.url));
try{
  const bin=path.join(scratch,'bin'),repo=path.join(scratch,'repo'),app=path.join(repo,'g2g-exam'),state=path.join(scratch,'state');
  for(const dir of [bin,path.join(repo,'.git'),path.join(app,'server'),path.join(app,'src'),path.join(app,'scripts'),state])await mkdir(dir,{recursive:true});
  for(const file of [path.join(app,'.env'),path.join(app,'server/.env'),path.join(app,'scripts/verify-release.mjs')])await writeFile(file,'');
  await writeFile(path.join(app,'src/release.js'),"export const APP_VERSION='1.3.209';\n");
  await writeFile(path.join(app,'server/check-code.sh'),'exit 0\n');
  const command=async(name,body)=>writeFile(path.join(bin,name),'#!/bin/sh\nset -eu\n'+body,{mode:0o755});
  await command('git',`case "$1" in
fetch|reset) exit 0;;
rev-parse) echo candidate-sha;;
cat-file) exit 1;;
*) exit 99;;
esac\n`);
  await command('flock','exit 0\n');await command('sleep','exit 0\n');
  await command('docker',`case "$*" in
*"ps -q postgres") exit 0;;
*"up -d --build app") exit 0;;
*"exec -T app node /app/scripts/verify-release.mjs http://127.0.0.1:8080 1.3.209")
  n=0; [ ! -f "$G2G_TEST_COUNT" ] || n=$(cat "$G2G_TEST_COUNT")
  n=$((n+1)); echo "$n" > "$G2G_TEST_COUNT"
  [ "$G2G_TEST_MODE" = success ] || { [ "$G2G_TEST_MODE" = recover ] && [ "$n" -ge 3 ]; };;
*) exit 99;;
esac\n`);
  for(const [mode,attempts,status] of [['failure',20,1],['success',1,0],['recover',3,0]]){
    const counter=path.join(scratch,'count-'+mode),deployed=path.join(state,'deployed-sha');
    await writeFile(deployed,'last-good-sha\n');
    const result=spawnSync('/bin/sh',[shell],{encoding:'utf8',timeout:10000,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,G2G_REPO:repo,G2G_APP_DIR:app,G2G_DEPLOY_STATE_DIR:state,G2G_DEPLOY_LOCK:path.join(scratch,'lock'),G2G_TEST_MODE:mode,G2G_TEST_COUNT:counter}});
    assert.equal(result.status,status,result.stderr+result.stdout);
    assert.equal(Number(await readFile(counter,'utf8')),attempts);
    assert.equal((await readFile(deployed,'utf8')).trim(),status===0?'candidate-sha':'last-good-sha');
  }
  const dockerfile=await readFile(new URL('../server/Dockerfile',import.meta.url),'utf8');
  assert.ok(dockerfile.includes('COPY scripts/verify-release.mjs /app/scripts/verify-release.mjs'));
  console.log('Deploy shell: expected checkout version, bounded retries, last-good SHA preservation and recovery passed.');
}finally{await rm(scratch,{recursive:true,force:true});}
