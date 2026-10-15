// One database-scoped lock coordinates all G2G media writers with snapshot capture.
export const MEDIA_BACKUP_LOCK=[1398705745,1];
export async function withMediaMutation(action,{enabled=process.env.BACKUP_MEDIA_GUARD_ENABLED==='true',connect}={}){
  if(!enabled)return action();
  const client=await (connect?connect():(await import('./db.js')).pool.connect());
  let locked=false;
  try{
    const result=await client.query('SELECT pg_try_advisory_lock_shared($1,$2) AS locked',MEDIA_BACKUP_LOCK);
    locked=result.rows[0]?.locked===true;
    if(!locked)throw Object.assign(new Error('Đang chụp bản sao lưu media. Vui lòng thử lại sau ít phút.'),{statusCode:503});
    return await action();
  }finally{
    try{if(locked)await client.query('SELECT pg_advisory_unlock_shared($1,$2)',MEDIA_BACKUP_LOCK);}
    finally{client.release();}
  }
}
