import assert from 'node:assert/strict';
import {IMAGE_COLUMNS,SHARE_COLUMNS,USAGE_COLUMNS,planImageSheetSync,syncImageSheet} from '../server/src/image-sheet-sync.js';
import {IMAGE_SHEET_ID,createImageSheetRunner,ensureImageSheet,googleImageClient,registerImageSheetRoutes} from '../server/src/image-sheet.js';

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
// Upgrade only the machine-owned J/K columns; preserve A:I and row gaps.
const sharingRows=[[...IMAGE_COLUMNS],[],[...first.imageRows[0]]],beforeSource=[...sharingRows[2]];
let shareWrites=0;
const shareGoogle=async(service,method,route,body)=>{
  if(method==='GET'&&route.includes('?fields='))return google(service,method,route,body);
  if(method==='GET')return {values:structuredClone(route.includes(encodeURIComponent('Ảnh'))?sharingRows:[USAGE_COLUMNS,...first.usageRows])};
  shareWrites++;
  for(const request of body.requests){
    if(request.updateCells){const {range,rows}=request.updateCells;assert.equal(range.startColumnIndex,9);assert.equal(range.endColumnIndex,11);sharingRows[range.startRowIndex]??=[];sharingRows[range.startRowIndex].splice(9,2,...rows[0].values.map(c=>c.userEnteredValue.stringValue));}
    else assert.deepEqual(request,{appendDimension:{sheetId:1,dimension:'COLUMNS',length:2}});
  }
  return {};
};
const shareImages=async urls=>{assert.deepEqual(urls,[asset.sourceUrl]);return new Map([[asset.sourceUrl,{url:'https://example.test/shared-exam-images/one.jpg?signature=synthetic',expiresAt:'2026-10-26T00:00:00.000Z'}]]);};
const shared=await syncImageSheet({google:shareGoogle,spreadsheetId:'sheet',manifest,shareImages});
assert.equal(shared.linksUpdated,1);assert.equal(shared.added,0);assert.equal(shareWrites,1);
assert.deepEqual(sharingRows[2].slice(0,9),beforeSource);assert.deepEqual(sharingRows[1],[]);
assert.deepEqual(sharingRows[0].slice(9),SHARE_COLUMNS);assert.match(sharingRows[2][9],/signature=synthetic/);
const protectedGoogle=async(service,method,route,body)=>method==='GET'&&route.includes('/values/')&&route.includes(encodeURIComponent('Ảnh'))?{values:[[...IMAGE_COLUMNS,'My manual column']]}:shareGoogle(service,method,route,body);
await assert.rejects(syncImageSheet({google:protectedGoogle,spreadsheetId:'sheet',manifest,shareImages}),/sharing columns changed/);
assert.equal(shareWrites,1,'Never overwrite unknown manual columns');
let reads=0;
const selected=await ensureImageSheet({state:{spreadsheetId:'old-sheet',lastSync:'old'},google:async(service,method,route)=>{
  reads++;assert.equal(service,'sheets');assert.equal(method,'GET');assert.ok(route.startsWith('/'+IMAGE_SHEET_ID+'?'));
  return {spreadsheetId:IMAGE_SHEET_ID};
}});
assert.equal(reads,1);assert.equal(selected.spreadsheetId,IMAGE_SHEET_ID);assert.equal(selected.lastSync,undefined);
await assert.rejects(ensureImageSheet({google:async()=>({spreadsheetId:'wrong'})}),/sai Sheet/);
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
const disabledApi=googleImageClient('synthetic',async()=>({ok:false,status:403,json:async()=>({error:{message:'private-credential-must-not-echo',details:[{reason:'SERVICE_DISABLED'}]}})}));
await assert.rejects(disabledApi('sheets','GET','/id'),error=>/Google Sheets API chưa bật/.test(error.message)&&!/private-credential/.test(error.message));
const hiddenFile=googleImageClient('synthetic',async()=>({ok:false,status:404,json:async()=>({error:{message:'private'}})}));
await assert.rejects(hiddenFile('drive','GET','/files/id'),error=>/Project number/.test(error.message)&&/Drive HTTP 404/.test(error.message)&&!/private/.test(error.message));
console.log('Direct image Sheet sync: append-only, restored/manual data preservation, history, literal values, interrupted create recovery, single flight, auth-first and redacted errors passed.');
