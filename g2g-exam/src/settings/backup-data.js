import {r2SettingsAction} from './api.js';

let owner=null,generation=0;
const resources={status:{action:'getBackupStatus',ttl:30000},files:{action:'listBackupFiles',ttl:60000}};
export function clearBackupData(){
 owner=null;generation++;
 for(const item of Object.values(resources)){item.value=null;item.at=0;item.pending=null;item.version=(item.version||0)+1;}
}
function scope(id){if(owner!==id){clearBackupData();owner=id;}}
export function readBackupData(id){scope(id);return {status:resources.status.value,files:resources.files.value};}
export function invalidateBackupData(id,keys=['status','files']){
 if(owner!==id)return;
 for(const key of keys){const item=resources[key];item.at=0;item.version=(item.version||0)+1;item.pending=null;}
}
export function loadBackupData(id,key,{force=false}={}){
 scope(id);const item=resources[key];
 if(item.pending)return item.pending;
 if(!force&&item.value&&Date.now()-item.at<item.ttl)return Promise.resolve(item.value);
 const session=generation,version=item.version;
 const pending=r2SettingsAction(item.action).then(value=>{
  if(session!==generation||version!==item.version)throw Object.assign(Error('Backup request superseded'),{name:'AbortError'});
  item.value=value;item.at=Date.now();return value;
 }).finally(()=>{if(item.pending===pending)item.pending=null;});
 item.pending=pending;return pending;
}
clearBackupData();
