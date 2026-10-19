import {pool,query,withTx,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {getBackupDriveAccess} from './backup-google.js';
import {loadExamImageInventory} from './exam-image-inventory.js';
import {syncImageSheet} from './image-sheet-sync.js';

const KEY='exam_image_sheet';
// Explicit owner-selected destination, not a credential. Never discover/create a replacement.
export const IMAGE_SHEET_ID='1GGOH5yM8WmZHF91_QcWdFL3TUppEWrRWVA4OoY424Js';
const sheetUrl=`https://docs.google.com/spreadsheets/d/${IMAGE_SHEET_ID}/edit`;
const origin=()=>new URL(process.env.PUBLIC_URL||'http://localhost:8080').origin;
async function read(){const r=await query('SELECT value_enc FROM secrets WHERE key=$1',[KEY]);return r.rows[0]?JSON.parse(decrypt(r.rows[0].value_enc)):null;}
// Operational cursor only; it must not invalidate the exam/application state.
async function save(state){await pool.query('INSERT INTO secrets(key,value_enc) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now()',[KEY,encrypt(JSON.stringify(state))]);}

export function googleImageClient(token,fetcher=fetch){
  return async(service,method,route,body)=>{
    const base=service==='drive'?'https://www.googleapis.com/drive/v3':'https://sheets.googleapis.com/v4/spreadsheets';
    const response=await fetcher(base+route,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
    // Never log Google's body: it may echo URLs, credentials or document data.
    if(!response.ok)throw appError(400,'Google chưa cho website đọc/ghi Sheet ảnh. Kiểm tra quyền truy cập tệp và Google Sheets API của kết nối trong Sao lưu.');
    return response.status===204?{}:response.json();
  };
}

export async function ensureImageSheet({google,state}){
  const metadata=await google('sheets','GET',`/${IMAGE_SHEET_ID}?fields=spreadsheetId,spreadsheetUrl,sheets(properties)`);
  if(metadata.spreadsheetId!==IMAGE_SHEET_ID)throw appError(409,'Google trả về sai Sheet ảnh.');
  return {...(state?.spreadsheetId===IMAGE_SHEET_ID?state:{}),spreadsheetId:IMAGE_SHEET_ID,url:sheetUrl};
}

export function createImageSheetRunner({withLock,access,readState,saveState,inventory,makeGoogle}){
  let pending;
  return ()=>{
    if(pending)return pending;
    pending=withLock(async()=>{
      const connection=await access(),google=makeGoogle(connection.token);
      const state=await ensureImageSheet({google,state:await readState()});
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
  try{return await getBackupDriveAccess();}catch{throw appError(400,'Chưa truy cập được Google Drive. Anh kết nối lại Google trong Sao lưu.');}
},readState:read,saveState:save,inventory:()=>loadExamImageInventory({withTx,origin:origin()}),makeGoogle:googleImageClient});

export function registerImageSheetRoutes(app,authenticate){
  app.get('/api/exam-images/status',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    const stored=await read(),state=stored?.spreadsheetId===IMAGE_SHEET_ID?stored:null;
    return {ready:Boolean(state?.lastSync),url:state?.url||null,lastSync:state?.lastSync||null,result:state?.result||null};
  });
  app.get('/api/exam-images/sheet',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    const url=new URL(sheetUrl);
    if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/spreadsheets/d/'))throw appError(409,'Link Sheet không hợp lệ.');
    return reply.redirect(url.href);
  });
  app.post('/api/exam-images/sync',async(request,reply)=>{
    await authenticate(request);reply.header('Cache-Control','private, no-store');
    return runImageSheetSync();
  });
}
