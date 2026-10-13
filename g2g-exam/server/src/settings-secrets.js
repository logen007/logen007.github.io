import crypto from 'node:crypto';
import {appError} from './db.js';

let derivedKey=null,derivedFrom=null;
function key(){
  const raw=process.env.SETTINGS_ENCRYPTION_KEY;
  if(!raw)throw appError(503,'SETTINGS_ENCRYPTION_KEY chưa được cấu hình.');
  if(raw!==derivedFrom){derivedKey=crypto.scryptSync(raw,'g2g-settings-v1',32);derivedFrom=raw;}
  return derivedKey;
}
export function encrypt(value){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),enc]).toString('base64');
}
export function decrypt(blob){
  const b=Buffer.from(blob,'base64'),dec=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));
  dec.setAuthTag(b.subarray(12,28));
  return Buffer.concat([dec.update(b.subarray(28)),dec.final()]).toString('utf8');
}
