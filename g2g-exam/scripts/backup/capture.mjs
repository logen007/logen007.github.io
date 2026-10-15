// Hold a database-level media barrier only during dump/copy, never during upload.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pool} from '../../server/src/db.js';
import {MEDIA_BACKUP_LOCK} from '../../server/src/media-backup-lock.js';
const client=await pool.connect();
let child,locked=false;
const stop=()=>{if(child?.pid)try{process.kill(-child.pid,'SIGTERM');}catch{}};
client.on('error',stop);
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  const result=await client.query('SELECT pg_try_advisory_lock($1,$2) AS locked',MEDIA_BACKUP_LOCK);
  locked=result.rows[0]?.locked===true;
  if(!locked)throw Error('Media writer is active; retry backup after uploads finish');
  await new Promise((resolve,reject)=>{
    child=spawn('bash',[fileURLToPath(new URL('./capture.sh',import.meta.url)),process.argv[2]],{stdio:'inherit',detached:true});
    child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error('Snapshot capture failed'+(signal?' ('+signal+')':''))));
  });
}finally{
  process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
  try{if(locked)await client.query('SELECT pg_advisory_unlock($1,$2)',MEDIA_BACKUP_LOCK);}
  finally{client.release();await pool.end();}
}
