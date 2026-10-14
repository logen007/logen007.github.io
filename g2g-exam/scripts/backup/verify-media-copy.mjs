import {readFile} from 'node:fs/promises';
import {mediaInventory} from './media-inventory.mjs';
import {sameInventory} from './compare-inventory.mjs';
const [inventory,copy]=process.argv.slice(2);
if(!inventory||!copy)throw Error('Usage: verify-media-copy.mjs inventory.json copied-directory');
const expected=JSON.parse(await readFile(inventory,'utf8'));
const actual=await mediaInventory(copy);
if(!sameInventory(expected,actual))throw Error('Staged media differs from authoritative source');
