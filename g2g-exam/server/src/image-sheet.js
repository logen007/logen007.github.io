import {createHash} from 'node:crypto';
import {pool,query,withTx,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {getBackupDriveAccess} from './backup-google.js';
import {loadExamImageInventory} from './exam-image-inventory.js';
import {SHEET_TABS,sheetRows,syncImageSheet} from './image-sheet-sync.js';

const KEY='exam_image_sheet',MIME='application/vnd.google-apps.spreadsheet';
const origin=()=>new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin;
const marker=()=>createHash('sha256').update(origin()).digest('hex');
async function read(){const r=await query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):null;}
// Operational cursor only; it must not invalidate the exam/application state.
async function save(state){await pool.query('INSERT INTO secrets(key,value_enc) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now()',[KEY,encrypt(JSON.stringify(state))]);}

export function googleImageClient(token,fetcher=fetch){
  return async(service,method,route,body)=>{
    const base=service==='drive'?'https://www.googleapis.com/drive/v3':'https://sheets.googleapis.com/v4/spreadsheets';
    const response=await fetcher(base+route,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
    // Never log Google's body: it may echo URLs, credentials or document data.
    if(!response.ok)throw appError(503,'Không truy cập được Google Sheet. Kiểm tra kết nối Drive và Google Sheets API.');
    return response.status===204?{}:response.json();
  };
}

export async function ensureImageSheet({google,folderId,state,saveState,sourceMarker}){
  if(state?.folderId&&state.folderId!==folderId)throw appError(409,'Tài khoản Drive đã đổi; cần đối soát Sheet ảnh cũ.');
  if(state?.spreadsheetId){
    const file=await google('drive','GET',`/files/${encodeURIComponent(state.spreadsheetId)}?fields=id,mimeType,trashed,webViewLink,appProperties`);
    if(file.trashed||file.mimeType!==MIME||file.appProperties?.g2gImageRegistry!==sourceMarker)throw appError(409,'Sheet ảnh không còn hợp lệ; không tự tạo bản khác.');
    return {...state,url:file.webViewLink};
  }
  // Recover a successful create whose response/persistence was interrupted.
  const q=`trashed = false and mimeType = '${MIME}' and appProperties has { key='g2gImageRegistry' and value='${sourceMarker}' }`;
  const found=await google('drive','GET','/files?q='+encodeURIComponent(q)+'&fields=files(id,webViewLink),nextPageToken&pageSize=2');
  if(found.nextPageToken||found.files?.length>1)throw appError(409,'Có nhiều Sheet ảnh; cần đối soát trước khi đồng bộ.');
  let file=found.files?.[0];
  if(!file){
    if(state?.creating)throw appError(409,'Lần tạo Sheet trước chưa rõ kết quả; không tự tạo lặp.');
    await saveState({folderId,creating:true});
    file=await google('drive','POST','/files?fields=id,webViewLink',{name:'G2G — Phục chế ảnh đề thi',mimeType:MIME,parents:[folderId],appProperties:{g2gImageRegistry:sourceMarker}});
  }
  const next={spreadsheetId:file.id,url:file.webViewLink,folderId,initializing:true};
  await saveState(next);
  return next;
}

async function initialize(google,state){
  const metadata=await google('sheets','GET',`/${state.spreadsheetId}?fields=sheets(properties)`);
  const requests=[];
  // Keep the automatically-created blank tab; never delete an unknown tab.
  for(const [i,spec] of SHEET_TABS.entries()){
    if(metadata.sheets?.some(s=>s.properties.title===spec.title))continue;
    const sheetId=100+i;
    if(metadata.sheets?.some(s=>s.properties.sheetId===sheetId))throw appError(409,'Sheet đang khởi tạo có cấu trúc khác.');
    requests.push({addSheet:{properties:{sheetId,title:spec.title,gridProperties:{rowCount:1000,columnCount:spec.headers.length,frozenRowCount:1}}}},
      {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:sheetRows([spec.headers]),fields:'userEnteredValue'}},
      {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.1,green:0.2,blue:0.3},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}},
      {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:spec.headers.length},properties:{pixelSize:200},fields:'pixelSize'}});
  }
  if(requests.length)await google('sheets','POST',`/${state.spreadsheetId}:batchUpdate`,{requests});
}

export function createImageSheetRunner({withLock,access,readState,saveState,inventory,makeGoogle,sourceMarker}){
  let pending;
  return ()=>{
    if(pending)return pending;
    pending=withLock(async()=>{
      const connection=await access(),google=makeGoogle(connection.token);
      let state=await ensureImageSheet({google,folderId:connection.folderId,state:await readState(),saveState,sourceMarker});
      if(state.initializing){await initialize(google,state);state={...state,initializing:false};await saveState(state);}
      const result=await syncImageSheet({google,spreadsheetId:state.spreadsheetId,manifest:await inventory()});
      await saveState({...state,lastSync:new Date().toISOString(),result});
      return {...result,url:state.url};
    }).finally(()=>{pending=null;});
    return pending;
  };
}

async function withLock(fn){
  const client=await pool.connect();let locked=false,broken=false;
  try{
    locked=(await client.query('SELECT pg_try_advisory_lock(182733,1) AS locked')).rows[0].locked;
    if(!locked)return {busy:true};
    return await fn();
  }finally{
    try{if(locked)await client.query('SELECT pg_advisory_unlock(182733,1)');}catch{broken=true;}
    client.release(broken);
  }
}
export const runImageSheetSync=createImageSheetRunner({withLock,access:async()=>{
  try{return await getBackupDriveAccess();}catch{throw appError(503,'Chưa truy cập được kết nối Google Drive.');}
},readState:read,saveState:save,inventory:()=>loadExamImageInventory({withTx,origin:origin()}),makeGoogle:googleImageClient,sourceMarker:marker()});

export function registerImageSheetRoutes(app,authenticate){
  app.get('/api/exam-images/status',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    const state=await read();
    return {ready:Boolean(state?.lastSync),url:state?.url||null,lastSync:state?.lastSync||null,result:state?.result||null};
  });
  app.get('/api/exam-images/sheet',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    const state=await read();
    if(!state?.url||state.initializing)throw appError(409,'Sheet ảnh chưa sẵn sàng. Kiểm tra kết nối Drive trong Sao lưu.');
    const url=new URL(state.url);
    if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/spreadsheets/d/'))throw appError(409,'Link Sheet không hợp lệ.');
    return reply.redirect(url.href);
  });
  app.post('/api/exam-images/sync',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    return runImageSheetSync();
  });
}
