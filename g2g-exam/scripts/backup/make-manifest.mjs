import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inventorySnapshot} from './inventory.mjs';
const [root,commit]=process.argv.slice(2);
if(!root||!commit)throw Error('Usage: make-manifest.mjs staging commitSHA');
const manifest=await inventorySnapshot({databaseDump:join(root,'database.dump'),uploadsDir:join(root,'uploads'),deploymentDir:process.env.BACKUP_DEPLOY_DIR?join(root,'deployment'):undefined,commit});
await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(`Inventory: ${manifest.files.length} files`);
