import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'g2g-libpq-service-'));
try {
  const out=join(root,'pg_service.conf');
  const uri='postgresql://alice:p%40ss@db.example.test:6543/g2g_exam?sslmode=verify-full&sslrootcert=%2Fsecure%2Fca.pem&application_name=g2g-backup';
  const run=spawnSync(process.execPath,['scripts/backup/libpq-service.mjs',uri,out],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const service=readFileSync(out,'utf8');
  assert.match(service,/host=db.example.test/);
  assert.match(service,/port=6543/);
  assert.match(service,/user=alice/);
  assert.match(service,/password=p@ss/);
  assert.match(service,/dbname=g2g_exam/);
  assert.match(service,/sslmode=verify-full/);
  assert.match(service,/sslrootcert=\/secure\/ca.pem/);
  assert.match(service,/application_name=g2g-backup/);
  const socket=spawnSync(process.execPath,['scripts/backup/libpq-service.mjs','postgresql://postgres@/g2g?host=%2Ftmp%2Fsocket&port=55439',out],{encoding:'utf8'});
  assert.equal(socket.status,0,socket.stderr);
  assert.match(readFileSync(out,'utf8'),/host=\/tmp\/socket/);
  const bad=spawnSync(process.execPath,['scripts/backup/libpq-service.mjs','https://example.test/g2g',out],{encoding:'utf8'});
  assert.notEqual(bad.status,0);
  console.log('libpq service URI conversion passed');
} finally { rmSync(root,{recursive:true,force:true}); }
