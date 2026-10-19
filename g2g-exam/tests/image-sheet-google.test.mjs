import assert from 'node:assert/strict';
import {pickerConfiguration,registerImageSheetGoogleRoutes} from '../server/src/image-sheet-google.js';
import {chooseImageSheet,googleSheetSettingsHtml} from '../src/settings/google-sheet.js';

const config=pickerConfiguration({},{apiKey:'synthetic-picker-key-12345',projectNumber:'123456789012'});
assert.equal(config.authorized,false);
assert.equal(pickerConfiguration({...config,authorized:true},{projectNumber:config.projectNumber}).authorized,true);
assert.throws(()=>pickerConfiguration(config,{projectNumber:'project-name'}),/Project number/);
assert.throws(()=>pickerConfiguration({},{apiKey:'bad',projectNumber:'123456'}),/API key/);
let stored=config,authorized=false,accessCalls=0,saveCalls=0;
const routes=new Map(),app={get:(p,fn)=>routes.set('GET '+p,fn),post:(p,fn)=>routes.set('POST '+p,fn)};
let editable=true;
registerImageSheetGoogleRoutes(app,{authenticate:async()=>{if(!authorized)throw Error('Denied');return {id:'master'};},sheetId:'selected',storage:{read:async()=>stored,save:async next=>{stored=next;saveCalls++;}},access:async()=>{accessCalls++;return {token:'synthetic-access',folderId:'folder'};},driveStatus:async()=>({connected:true,email:'master@example.test',oauthConfigured:true}),makeGoogle:()=>async(service,method,route)=>{
  assert.equal(method,'GET');assert.ok(route.includes('selected'));
  return service==='drive'?{id:'selected',mimeType:'application/vnd.google-apps.spreadsheet',capabilities:{canEdit:editable}}:{spreadsheetId:'selected'};
}});
const headers={},reply={header:(key,value)=>{headers[key]=value;}};
for(const handler of routes.values())await assert.rejects(handler({body:{}},reply),/Denied/);
assert.equal(accessCalls,0);assert.equal(saveCalls,0);
authorized=true;
const status=await routes.get('GET /api/exam-images/google-settings')({},reply);
assert.equal(status.configured,true);assert.doesNotMatch(JSON.stringify(status),/synthetic-picker|synthetic-access/);
assert.equal(headers['Cache-Control'],'private, no-store');
await assert.rejects(routes.get('POST /api/exam-images/authorize')({body:{sheetId:'wrong'}},reply),/đúng file/);assert.equal(accessCalls,0);
editable=false;
await assert.rejects(routes.get('POST /api/exam-images/authorize')({body:{sheetId:'selected'}},reply),/chỉnh sửa/);assert.equal(saveCalls,0);
editable=true;
await routes.get('POST /api/exam-images/authorize')({body:{sheetId:'selected'}},reply);
assert.equal(stored.authorized,true);
const picker=await routes.get('POST /api/exam-images/picker')({},reply);
assert.equal(picker.accessToken,'synthetic-access');assert.equal(picker.sheetId,'selected');
assert.doesNotMatch(JSON.stringify(picker),/refreshToken|clientSecret/);
await routes.get('POST /api/exam-images/disconnect')({},reply);assert.equal(stored.authorized,false);

const html=googleSheetSettingsHtml();assert.match(html,/sGoogleConnections/);assert.match(html,/type="password"/);assert.doesNotMatch(html,/value="synthetic/);
const previousLocation=globalThis.location;globalThis.location={origin:'https://example.test'};
try{
  let callback,seen;
  class View{setMode(){return this;}setMimeTypes(){return this;}}
  class Builder{
    setAppId(){return this;}setDeveloperKey(){return this;}setOAuthToken(){return this;}setOrigin(origin){seen=origin;return this;}addView(){return this;}setCallback(fn){callback=fn;return this;}
    build(){return {setVisible:()=>{}};}
  }
  const google={picker:{DocsView:View,ViewId:{SPREADSHEETS:1},DocsViewMode:{LIST:1},PickerBuilder:Builder,Action:{CANCEL:'cancel',PICKED:'picked'}}};
  let pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'cancel'});assert.equal(await pending,false);
  pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'picked',docs:[{id:'wrong'}]});await assert.rejects(pending,/đúng file/);
  pending=chooseImageSheet({sheetId:'selected'},google);callback({action:'picked',docs:[{id:'selected'}]});assert.equal(await pending,'selected');assert.equal(seen,'https://example.test');
}finally{if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
console.log('Google Sheet settings: auth-first, encrypted config contract, private status, short-lived Picker token, exact-file/edit verification, cancel and wrong-file handling passed.');
