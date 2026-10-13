import {query,appError} from './db.js';
import {encrypt,decrypt} from './settings-secrets.js';
import {AI_PROVIDER_IDS} from '../../src/domain/ai-providers.js';

const keyFor=provider=>AI_PROVIDER_IDS.includes(provider)?`ai_${provider}_api_key`:null;
const envFor=provider=>provider==='grok'?'XAI_API_KEY':`${provider.toUpperCase()}_API_KEY`;

export async function setAiApiKey(provider,value,userId){
  const key=keyFor(provider),secret=String(value||'').trim();
  if(!key)throw appError(400,'Nhà cung cấp AI không hợp lệ.');
  if(!secret||secret.length>1000)throw appError(400,'API key AI không hợp lệ.');
  await query(`INSERT INTO secrets(key,value_enc,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value_enc=EXCLUDED.value_enc,updated_at=now(),updated_by=EXCLUDED.updated_by`,[key,encrypt(secret),userId]);
  return {configured:true};
}

export async function aiApiKeyStatus(){
  const result=await query(`SELECT key,updated_at FROM secrets WHERE key=ANY($1::text[])`,[AI_PROVIDER_IDS.map(keyFor)]);
  const saved=new Map(result.rows.map(row=>[row.key,row.updated_at]));
  return Object.fromEntries(AI_PROVIDER_IDS.map(provider=>{
    const key=keyFor(provider),updatedAt=saved.get(key)||null;
    return [provider,{configured:Boolean(updatedAt||process.env[envFor(provider)]),stored:Boolean(updatedAt),updatedAt,source:updatedAt?'settings':process.env[envFor(provider)]?'environment':null}];
  }));
}

export async function aiApiKeys(provider){
  if(provider&&!AI_PROVIDER_IDS.includes(provider))throw appError(400,'Nhà cung cấp AI không hợp lệ.');
  const providers=provider?[provider]:AI_PROVIDER_IDS;
  const result=await query('SELECT key,value_enc FROM secrets WHERE key=ANY($1::text[])',[providers.map(keyFor)]);
  const saved=new Map(result.rows.map(row=>[row.key,row.value_enc]));
  return Object.fromEntries(providers.map(provider=>{
    const encrypted=saved.get(keyFor(provider));
    return [provider+'ApiKey',(encrypted?decrypt(encrypted):'')||process.env[envFor(provider)]||''];
  }));
}
