import assert from 'node:assert/strict';
import {IMAGE_COLUMNS,USAGE_COLUMNS,planImageSheetSync,syncImageSheet} from '../server/src/image-sheet-sync.js';
import {createImageSheetRunner,ensureImageSheet,googleImageClient,registerImageSheetRoutes} from '../server/src/image-sheet.js';

const asset={sourceId:'original',sourceUrl:'https://example.test/original.png'};
const usage={examId:'exam',examTitle:'=HYPERLINK("bad")',provider:'GOETHE',level:'A1',examStatus:'published',publicationVersion:1,entity:'question',entityId:'q',pointer:'/imageUrl',sourceId:'original'};
const manifest={schemaVersion:1,assets:[asset],usages:[usage],warnings:[]};
const first=planImageSheetSync(manifest,[],[]);
assert.equal(first.imageRows.length,1);assert.equal(first.usageRows.length,1);
const restored=[...first.imageRows[0]];restored[2]='https://drive.google.com/restored';restored[3]='approved';restored[7]='Keep my note';restored[6]='https://example.test/applied.png';
assert.deepEqual(planImageSheetSync(manifest,[restored],first.usageRows),{imageRows:[],usageRows:[],skipped:1});
assert.equal(restored[7],'Keep my note');
assert.equal(planImageSheetSync({...manifest,assets:[{sourceId:'applied',sourceUrl:restored[6]}],usages:[{...usage,sourceId:'applied'}]},[restored],first.usageRows).imageRows.length,0);
assert.equal(planImageSheetSync({...manifest,assets:[asset,{sourceId:'new',sourceUrl:'https://example.test/new.png'}]},[restored],[]).imageRows.length,1);
assert.throws(()=>planImageSheetSync(manifest,[restored,restored],[]),/duplicate/i);
assert.equal(planImageSheetSync({...manifest,usages:[{...usage,publicationVersion:2}]},[restored],first.usageRows).usageRows.length,1,'Keep versioned usage history');

let writes=[];
const google=async(service,method,route,body)=>{
  assert.equal(service,'sheets');
  if(route.includes('?fields='))return {sheets:[{properties:{title:'Ảnh',sheetId:1,gridProperties:{rowCount:1000,columnCount:9}}},{properties:{title:'Vị trí',sheetId:2,gridProperties:{rowCount:1000,columnCount:11}}}]};
  if(method==='GET')return {values:[route.includes(encodeURIComponent('Ảnh'))?IMAGE_COLUMNS:USAGE_COLUMNS]};
  writes.push(body);return {};
};
assert.equal((await syncImageSheet({google,spreadsheetId:'sheet',manifest})).added,1);
assert.equal(writes.length,1);assert.equal(writes[0].requests.length,2,'Atomic append across both tabs');
const cells=writes[0].requests[1].appendCells.rows[0].values;
assert.equal(cells[2].userEnteredValue.stringValue,usage.examTitle,'Untrusted title is literal text, not a formula');
assert.ok(cells.every(c=>!c.userEnteredValue.formulaValue));
await assert.rejects(syncImageSheet({google:async(service,method,route,body)=>method==='GET'&&route.includes('/values/')?{values:[['wrong']]}:google(service,method,route,body),spreadsheetId:'sheet',manifest}),/headers changed/);

// Exercise actual append/read reconciliation, including an ambiguous HTTP result.
const stored=[[IMAGE_COLUMNS,restored],[USAGE_COLUMNS,...first.usageRows]];
let loseResponse=true;
const memoryGoogle=async(service,method,route,body)=>{
  if(method==='GET'&&route.includes('?fields='))return google(service,method,route,body);
  if(method==='GET')return {values:structuredClone(stored[route.includes(encodeURIComponent('Ảnh'))?0:1])};
  for(const {appendCells} of body.requests)stored[appendCells.sheetId-1].push(...appendCells.rows.map(r=>r.values.map(c=>c.userEnteredValue.stringValue)));
  if(loseResponse){loseResponse=false;throw Error('Lost response after Google committed');}
  return {};
};
const nextManifest={...manifest,assets:[asset,{sourceId:'next',sourceUrl:'https://example.test/next.png'}],usages:[usage,{...usage,examId:'next-exam',sourceId:'next'}]};
await assert.rejects(syncImageSheet({google:memoryGoogle,spreadsheetId:'sheet',manifest:nextManifest}),/Lost response/);
assert.equal((await syncImageSheet({google:memoryGoogle,spreadsheetId:'sheet',manifest:nextManifest})).added,0);
assert.equal(stored[0].length,3);assert.equal(stored[1].length,3);
assert.deepEqual(stored[0][1],restored,'Existing restored link/status/note survives both writes and retry');

let state=null,created=0;
const drive=async(service,method,route,body)=>{
  assert.equal(service,'drive');
  if(method==='GET'&&route.startsWith('/files?'))return {files:[]};
  if(method==='POST'){created++;assert.equal(state.creating,true,'Persist intent before external create');assert.equal(body.appProperties.g2gImageRegistry,'marker');return {id:'id',webViewLink:'https://docs.google.com/spreadsheets/d/id/edit'};}
  throw Error('Unexpected request');
};
const args={google:drive,folderId:'folder',state:null,saveState:async next=>{state=next;},sourceMarker:'marker'};
assert.equal((await ensureImageSheet(args)).spreadsheetId,'id');assert.equal(created,1);
await assert.rejects(ensureImageSheet({...args,state:{creating:true,folderId:'folder'}}),/không tự tạo lặp/);assert.equal(created,1);
await assert.rejects(ensureImageSheet({...args,state:{folderId:'other'}}),/Drive đã đổi/);
assert.equal((await ensureImageSheet({...args,state:{creating:true,folderId:'folder'},google:async()=>({files:[{id:'recovered',webViewLink:'https://docs.google.com/spreadsheets/d/recovered/edit'}]})})).spreadsheetId,'recovered');
await assert.rejects(ensureImageSheet({...args,google:async()=>({files:[{id:'1'},{id:'2'}]})}),/nhiều Sheet/);
await assert.rejects(ensureImageSheet({...args,state:{spreadsheetId:'id',folderId:'folder'},google:async()=>({mimeType:'application/vnd.google-apps.spreadsheet',trashed:true})}),/không còn hợp lệ/);

let resolve,lockCalls=0;
const runner=createImageSheetRunner({withLock:()=>{lockCalls++;return new Promise(r=>{resolve=r;});}});
const pending=runner();assert.equal(runner(),pending);assert.equal(lockCalls,1);resolve({busy:true});await pending;
const routes=new Map();
registerImageSheetRoutes({get:(route,fn)=>routes.set('GET '+route,fn),post:(route,fn)=>routes.set('POST '+route,fn)},async()=>{throw Error('Denied before DB/Google');});
for(const handler of routes.values())await assert.rejects(handler({},{}),/Denied before DB/);
let fetchCalls=0;
const api=googleImageClient('synthetic-token',async(url,options)=>{
  fetchCalls++;assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-token');assert.ok(url.startsWith('https://sheets.googleapis.com/'));return {ok:false,status:403,json:async()=>{throw Error('Never read provider errors');}};
});
await assert.rejects(api('sheets','GET','/id'),/Google Sheets API/);assert.equal(fetchCalls,1);
console.log('Direct image Sheet sync: append-only, restored/manual data preservation, history, literal values, interrupted create recovery, single flight, auth-first and redacted errors passed.');
