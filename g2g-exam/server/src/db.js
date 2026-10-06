import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';
import { DEFAULT_SETTINGS,mergeSettings } from './defaults.js';

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
  await pool.query(sql);
  await pool.query(`INSERT INTO settings(id,data) VALUES('global',$1::jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(DEFAULT_SETTINGS)]);
}
export const query=(text,params=[])=>pool.query(text,params);
export async function withTx(fn){const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function getSettings(client=pool){const r=await client.query(`SELECT data FROM settings WHERE id='global'`);return mergeSettings(r.rows[0]?.data||{});}
export async function audit(user,action,entityType,entityId,detail={},client=pool){await client.query(`INSERT INTO audit_log(user_id,user_name,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[user?.id||null,user?.name||user?.email||'',action,entityType,entityId,JSON.stringify(detail||{})]);}
export function appError(statusCode,message){const e=new Error(message);e.statusCode=statusCode;return e;}
