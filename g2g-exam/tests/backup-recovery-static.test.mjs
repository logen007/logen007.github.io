import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../scripts/backup/recovery.sh',import.meta.url),'utf8');
assert.match(source,/BACKUP_AGE_IDENTITY/);
assert.match(source,/rclone copyto/);
assert.match(source,/restore\.sh/);
assert.doesNotMatch(source,/pg_restore\s+--dbname/);
assert.doesNotMatch(source,/systemctl\s+(restart|stop)/);
console.log('Recovery kit safety contract passed');
