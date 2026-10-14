import assert from 'node:assert/strict';
import fs from 'node:fs';
const files=['scripts/backup/backup.sh','scripts/backup/restore.sh','scripts/backup/runner.sh','server/src/backup-google.js','server/src/backup-control.js','src/settings/backup.js'];
for(const file of files)assert.ok(fs.existsSync(new URL('../'+file,import.meta.url)),file);
console.log('Backup source files present; runtime restore testing still required.');
