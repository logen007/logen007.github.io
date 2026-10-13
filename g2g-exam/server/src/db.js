import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';
import { DEFAULT_SETTINGS,mergeSettings } from './defaults.js';
import {migrateRetiredQuestionGroups} from './migrations.js';

const {Pool}=pg;
export const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  max:Number(process.env.PG_POOL_MAX||10),
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:Number(process.env.PG_CONNECT_TIMEOUT_MS||5000),
  query_timeout:Number(process.env.PG_QUERY_TIMEOUT_MS||10000),
});
export const uid=(prefix='id')=>`${prefix}-${crypto.randomUUID()}`;
export const now=()=>new Date().toISOString();

export async function initDb(){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const sql=await fs.readFile(path.resolve(here,'../schema.sql'),'utf8');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(sql);
    await migrateRetiredQuestionGroups(client);
    await client.query(`INSERT INTO settings(id,data) VALUES('global',$1::jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(DEFAULT_SETTINGS)]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
let dataRevision=0;
export const getDataRevision=()=>dataRevision;
const changesData=(sql,result)=>/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)&&result.rowCount>0;
export async function query(text,params=[]){const result=await pool.query(text,params);if(changesData(text,result))dataRevision++;return result;}
export async function withTx(fn){
  const c=await pool.connect(),original=c.query;let changed=false;
  c.query=async(text,params)=>{const result=await original.call(c,text,params);if(changesData(text,result))changed=true;return result;};
  try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');if(changed)dataRevision++;return out;}
  catch(e){await c.query('ROLLBACK');throw e;}
  finally{c.query=original;c.release();}
}
export async function getSettings(client=pool){const r=await client.query(`SELECT data FROM settings WHERE id='global'`);return mergeSettings(r.rows[0]?.data||{});}
export async function audit(user,action,entityType,entityId,detail={},client=pool){await client.query(`INSERT INTO audit_log(user_id,user_name,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[user?.id||null,user?.name||user?.email||'',action,entityType,entityId,JSON.stringify(detail||{})]);}
export function appError(statusCode,message){const e=new Error(message);e.statusCode=statusCode;return e;}
