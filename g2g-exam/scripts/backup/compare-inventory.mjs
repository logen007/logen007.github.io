import {readFile} from 'node:fs/promises';
export function sameInventory(a,b){return JSON.stringify(a)===JSON.stringify(b);}
if(process.argv[1]&&process.argv[1].endsWith('compare-inventory.mjs')){
 const [first,second]=process.argv.slice(2);
 if(!first||!second)throw Error('Expected two inventory files');
 const a=JSON.parse(await readFile(first,'utf8')),b=JSON.parse(await readFile(second,'utf8'));
 if(!sameInventory(a,b))throw Error('Media changed during backup; refusing inconsistent archive');
}
