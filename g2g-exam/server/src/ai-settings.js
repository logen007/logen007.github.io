import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';

const keyFor=provider=>provider==='groq'?'ai_groq_api_key':provider==='gemini'?'ai_gemini_api_key':provider==='grok'?'ai_grok_api_key':null;
const envFor=provider=>provider==='groq'?'GROQ_API_KEY':provider==='gemini'?'GEMINI_API_KEY':'XAI_API_KEY';

export async function setAiApiKey(provider,value,userId){
  const key=keyFor(provider),secret=String(value||'').trim();
  if(!key)throw appError(400,'Nhà cung cấp AI không hợp lệ.');
  if(!secret||secret.length>1000)throw appError(400,'API key AI không hợp lệ.');
  await query(`INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now(),updated_by=EXCLUDED.updated_by`,[key,encrypt(secret),userId]);
  return {configured:true};
}

export async function aiApiKeyStatus(){
  const result=await query(`SELECT key,updated_at FROM secrets WHERE key=ANY($1::text[])`,[['ai_groq_api_key','ai_gemini_api_key','ai_grok_api_key']]);
  const saved=new Map(result.rows.map(row=>[row.key,row.updated_at]));
  return Object.fromEntries(['groq','gemini','grok'].map(provider=>{
    const key=keyFor(provider),updatedAt=saved.get(key)||null;
    return [provider,{configured:Boolean(updatedAt||process.env[envFor(provider)]),stored:Boolean(updatedAt),updatedAt,source:updatedAt?'settings':process.env[envFor(provider)]?'environment':null}];
  }));
}

async function savedSecret(key){
  const result=await query(`SELECT value_enc FROM secrets WHERE key=$1`,[key]);
  return result.rowCount?decrypt(result.rows[0].value_enc):'';
}

export async function aiApiKeys(){
  const [groqSaved,geminiSaved,grokSaved]=await Promise.all([savedSecret('ai_groq_api_key'),savedSecret('ai_gemini_api_key'),savedSecret('ai_grok_api_key')]);
  return {groqApiKey:groqSaved||process.env.GROQ_API_KEY||'',geminiApiKey:geminiSaved||process.env.GEMINI_API_KEY||'',grokApiKey:grokSaved||process.env.XAI_API_KEY||''};
}
