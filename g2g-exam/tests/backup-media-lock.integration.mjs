import assert from 'node:assert/strict';
import {pool} from '../server/src/db.js';
import {withMediaMutation,MEDIA_BACKUP_LOCK} from '../server/src/media-backup-lock.js';
const client=await pool.connect();
try{
  await client.query('SELECT pg_advisory_lock($1,$2)',MEDIA_BACKUP_LOCK);
  let wrote=false;
  await assert.rejects(withMediaMutation(()=>{wrote=true;},{enabled:true}),e=>e.statusCode===503);
  assert.equal(wrote,false);
  await client.query('SELECT pg_advisory_unlock($1,$2)',MEDIA_BACKUP_LOCK);
  await withMediaMutation(async()=>{wrote=true;},{enabled:true});
  assert.equal(wrote,true);
  console.log('REAL_MEDIA_BARRIER_OK: PostgreSQL excludes concurrent writers.');
}finally{client.release();await pool.end();}
