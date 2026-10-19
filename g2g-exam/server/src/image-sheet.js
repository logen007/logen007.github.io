import {pool,query,withTx,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {getImageSheetGoogleAccess} from './image-sheet-google.js';
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
    // Classify allowlisted reason codes only. Never echo Google's message/body:
    // it may contain credentials, user content or request details.
    if(!response.ok){
      let reasons=[];try{const payload=await response.json();reasons=[...(payload.error?.errors||[]),...(payload.error?.details||[])].map(item=>item.reason);}catch{}
      const api=service==='drive'?'Google Drive API':'Google Sheets API';
      const message=reasons.some(reason=>['SERVICE_DISABLED','accessNotConfigured'].includes(reason))?`${api} chưa bật trong dự án OAuth đang dùng. Anh bật API trong đúng dự án Google Cloud.`
        :response.status===401?'Phiên Google đã hết hạn. Anh kết nối lại Google trong Cài đặt.'
        :reasons.some(reason=>['ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions'].includes(reason))?'Token Google chưa có đủ quyền. Anh kết nối lại Google Drive trong Cài đặt rồi chọn Exam img.'
        :response.status===404?'Google chưa cho ứng dụng thấy Exam img. Kiểm tra Project number của Picker và OAuth Sao lưu thuộc cùng dự án.'
        :`${api} chưa cho website đọc/ghi Exam img. Anh kiểm tra quyền chỉnh sửa và cấu hình Google trong Cài đặt.`;
      throw appError(400,`${message} (${service==='drive'?'Drive':'Sheets'} HTTP ${Number(response.status)||0})`);
    }
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
export const runImageSheetSync=createImageSheetRunner({withLock,access:()=>getImageSheetGoogleAccess({sheetId:IMAGE_SHEET_ID,makeGoogle:googleImageClient}),readState:read,saveState:save,inventory:()=>loadExamImageInventory({withTx,origin:origin()}),makeGoogle:googleImageClient});

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
