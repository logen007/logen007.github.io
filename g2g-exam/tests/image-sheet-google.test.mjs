import assert from 'node:assert/strict';
import {pickerConfiguration,registerImageSheetGoogleRoutes,getImageSheetGoogleAccess} from '../server/src/image-sheet-google.js';
import {chooseImageSheet,googleSheetSettingsHtml,bindGoogleSheetSettings} from '../src/settings/google-sheet.js';

const config=pickerConfiguration({},{apiKey:'synthetic-picker-key-12345',projectNumber:'123456789012'});
assert.equal(config.authorized,false);
assert.equal(pickerConfiguration({...config,authorized:true},{projectNumber:config.projectNumber}).authorized,true);
assert.throws(()=>pickerConfiguration(config,{projectNumber:'project-name'}),/Project number/);
assert.throws(()=>pickerConfiguration({},{apiKey:'bad',projectNumber:'123456'}),/API key/);
let stored=config,authorized=false,accessCalls=0,saveCalls=0;
const routes=new Map(),app={get:(p,fn)=>routes.set('GET '+p,fn),post:(p,fn)=>routes.set('POST '+p,fn)};
let editable=true;
let sheetDisconnected=false;
registerImageSheetGoogleRoutes(app,{authenticate:async()=>{if(!authorized)throw Error('Denied');return {id:'master'};},sheetId:'selected',storage:{read:async()=>stored,save:async next=>{stored=next;saveCalls++;}},access:async()=>{accessCalls++;return {token:'synthetic-access'};},driveStatus:async()=>({connected:true,email:'sheet@example.test',oauthConfigured:true}),backupStatus:async()=>({connected:true,email:'backup@example.test'}),disconnect:async()=>{sheetDisconnected=true;},makeGoogle:()=>async(service,method,route)=>{
  assert.equal(method,'GET');assert.ok(route.includes('selected'));
  return service==='drive'?{id:'selected',mimeType:'application/vnd.google-apps.spreadsheet',capabilities:{canEdit:editable}}:{spreadsheetId:'selected'};
}});
const headers={},reply={header:(key,value)=>{headers[key]=value;}};
for(const handler of routes.values())await assert.rejects(handler({body:{}},reply),/Denied/);
assert.equal(accessCalls,0);assert.equal(saveCalls,0);
authorized=true;
const status=await routes.get('GET /api/exam-images/google-settings')({},reply);
assert.equal(status.configured,true);assert.doesNotMatch(JSON.stringify(status),/synthetic-picker|synthetic-access/);
assert.equal(status.email,'sheet@example.test');assert.equal(status.backup.email,'backup@example.test');
assert.equal(status.authorized,true,'A stale false local flag must not hide a verified Google grant');
assert.equal(saveCalls,0,'GET status is read-only');
assert.equal(headers['Cache-Control'],'private, no-store');
const beforeWrong=accessCalls;
await assert.rejects(routes.get('POST /api/exam-images/authorize')({body:{sheetId:'wrong'}},reply),/đúng file/);assert.equal(accessCalls,beforeWrong);
editable=false;
await assert.rejects(routes.get('POST /api/exam-images/authorize')({body:{sheetId:'selected'}},reply),/chỉnh sửa/);assert.equal(saveCalls,0);
editable=true;
await routes.get('POST /api/exam-images/authorize')({body:{sheetId:'selected'}},reply);
assert.equal(stored.authorized,true);
const picker=await routes.get('POST /api/exam-images/picker')({},reply);
assert.equal(picker.accessToken,'synthetic-access');assert.equal(picker.sheetId,'selected');
assert.doesNotMatch(JSON.stringify(picker),/refreshToken|clientSecret/);
await routes.get('POST /api/exam-images/disconnect')({},reply);assert.equal(stored.authorized,false);
assert.equal(stored.enabled,false);
const disabledStatus=await routes.get('GET /api/exam-images/google-settings')({},reply);
assert.equal(disabledStatus.disabled,true);assert.equal(disabledStatus.authorized,false);
await routes.get('POST /api/exam-images/google/disconnect')({},reply);assert.equal(sheetDisconnected,true);

let liveChecks=0;
const accessArgs={sheetId:'selected',makeGoogle:()=>async(service)=>{liveChecks++;return service==='drive'?{id:'selected',mimeType:'application/vnd.google-apps.spreadsheet',capabilities:{canEdit:true}}:{spreadsheetId:'selected'};},storage:{read:async()=>({authorized:false}),save:async()=>{throw Error('Live checks must not rewrite config');}},access:async()=>({token:'fresh',folderId:'folder'})};
assert.equal((await getImageSheetGoogleAccess(accessArgs)).token,'fresh');assert.equal(liveChecks,2,'Verify actual file/edit capability and Sheets API despite stale false flag');
for(const config of [{enabled:false},{authorized:false,folderId:'old-folder'}]){
  await assert.rejects(getImageSheetGoogleAccess({...accessArgs,storage:{read:async()=>config}}),/đã được ngắt/);
}
assert.equal(liveChecks,2,'Explicit and legacy disconnects must never reconnect automatically');
await assert.rejects(getImageSheetGoogleAccess({...accessArgs,makeGoogle:()=>async()=>{throw Error('Google denies access');}}),/Google denies/);

const html=googleSheetSettingsHtml();assert.match(html,/sGoogleConnections/);assert.match(html,/type="password"/);assert.doesNotMatch(html,/value="synthetic/);
assert.match(html,/href="\/api\/exam-images\/google\/connect"/);assert.match(html,/href="\/api\/backup\/google\/connect"/);
const previousLocation=globalThis.location;globalThis.location={origin:'https://example.test'};
try{
  let callback,seen,requestedIds,autoPick=null;
  class View{setMode(){return this;}setMimeTypes(){return this;}setFileIds(ids){requestedIds=ids;return this;}}
  class Builder{
    setAppId(){return this;}setDeveloperKey(){return this;}setOAuthToken(){return this;}setOrigin(origin){seen=origin;return this;}addView(){return this;}setCallback(fn){callback=fn;return this;}
    build(){return {setVisible:()=>{if(autoPick)queueMicrotask(()=>callback(autoPick));}};}
  }
  const google={picker:{DocsView:View,ViewId:{SPREADSHEETS:1},DocsViewMode:{LIST:1},PickerBuilder:Builder,Action:{CANCEL:'cancel',PICKED:'picked'}}};
  let pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'cancel'});assert.equal(await pending,false);
  assert.equal(requestedIds,'selected','Picker must show the known Sheet ID rather than require name search');
  pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'picked',docs:[{id:'wrong'}]});await assert.rejects(pending,/đúng file/);
  pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'picked',docs:[{id:'selected'}]});assert.equal(await pending,'selected');assert.equal(seen,'https://example.test');

  // Exercise the actual settings click handler through Picker + POST + readback.
  // These are behavior doubles, not a real browser or Google grant.
  const originals={document:globalThis.document,fetch:globalThis.fetch,google:globalThis.google};
  try{
    const nodes=new Map(),node=selector=>{
      if(!nodes.has(selector))nodes.set(selector,{textContent:'',value:'',disabled:false,setAttribute(){},removeAttribute(){}});
      return nodes.get(selector);
    };
    const root={dataset:{},isConnected:true,querySelector:node};
    globalThis.document={getElementById:()=>root};globalThis.google=google;
    let granted=false,confirmGrant=true,authorizePosts=0;
    globalThis.fetch=async(url,options)=>{
      let data;
      if(url.endsWith('/google-settings'))data={configured:true,driveConnected:true,projectNumber:'123456',authorized:granted,error:'',email:'master@example.test'};
      else if(url.endsWith('/picker'))data={sheetId:'selected',appId:'123456',apiKey:'synthetic-key',accessToken:'synthetic-token'};
      else if(url.endsWith('/authorize')){authorizePosts++;assert.equal(JSON.parse(options.body).sheetId,'selected');granted=confirmGrant;data={ok:true};}
      else throw Error('Unexpected request');
      return {ok:true,json:async()=>data};
    };
    bindGoogleSheetSettings();await new Promise(resolve=>setImmediate(resolve));
    autoPick={action:'picked',docs:[{id:'selected'}]};
    await node('[data-picker-authorize]').onclick();
    assert.equal(authorizePosts,1);assert.match(node('[data-google-status]').textContent,/Đã chọn và xác minh/);
    assert.equal(node('[data-picker-disconnect]').disabled,false);
    granted=false;autoPick={action:'cancel'};
    await node('[data-picker-authorize]').onclick();
    assert.equal(authorizePosts,1);assert.match(node('[data-google-status]').textContent,/Đã đóng cửa sổ/,'Cancellation must not be silently painted as a generic permission failure');
    confirmGrant=false;autoPick={action:'picked',docs:[{id:'selected'}]};
    await node('[data-picker-authorize]').onclick();
    assert.equal(authorizePosts,2);assert.match(node('[data-google-status]').textContent,/chưa xác minh/,'Do not claim success when post-selection readback disagrees');
  }finally{
    for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
}finally{if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
console.log('Google Sheet settings: auth-first, encrypted config contract, private status, short-lived Picker token, exact-file/edit verification, cancel and wrong-file handling passed.');
