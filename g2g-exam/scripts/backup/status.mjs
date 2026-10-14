import {mkdir, readFile, rename, writeFile, chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const STATES = new Set(['queued','running','success','failed']);
const validTime = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
export function validateStatus(value) {
  if (!value || !STATES.has(value.state) || !validTime(value.updatedAt)) throw new Error('Invalid backup status');
  if (value.startedAt !== undefined && !validTime(value.startedAt)) throw new Error('Invalid start time');
  if (value.finishedAt !== undefined && !validTime(value.finishedAt)) throw new Error('Invalid finish time');
  if (value.archive !== undefined && !/^g2g-\d{8}T\d{6}Z\.tar\.gz\.age$/.test(value.archive)) throw new Error('Invalid archive');
  return {state:value.state,updatedAt:value.updatedAt,...(value.startedAt?{startedAt:value.startedAt}:{}),...(value.finishedAt?{finishedAt:value.finishedAt}:{}),...(value.archive?{archive:value.archive}:{})};
}
export async function readStatus(directory) {
  try {return validateStatus(JSON.parse(await readFile(join(directory,'status.json'),'utf8')));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function writeStatus(directory, value) {
  const safe=validateStatus(value);
  await mkdir(directory,{recursive:true,mode:0o700});
  const temp=join(directory,`.status-${randomUUID()}.tmp`);
  try {await writeFile(temp,JSON.stringify(safe)+'\n',{mode:0o640,flag:'wx'});await chmod(temp,0o640);await rename(temp,join(directory,'status.json'));}
  catch(error){const {rm}=await import('node:fs/promises');await rm(temp,{force:true});throw error;}
  return safe;
}
export function dashboardBackupLabel(status, now=Date.now()) {
  if(!status)return 'Backup · Chưa có';
  if(status.state==='running')return 'Backup · Đang chạy';
  if(status.state==='failed')return 'Backup · Thất bại';
  if(status.state==='queued')return 'Backup · Đang chờ';
  const when=Date.parse(status.finishedAt||status.updatedAt);
  if(!Number.isFinite(when))return 'Backup · Chưa xác minh';
  if(now-when>36*3600000)return 'Backup · Quá hạn';
  return 'Backup · OK';
}
