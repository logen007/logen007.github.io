import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createR2Settings,normalizeR2Config} from '../server/src/r2-settings.js';
import {encrypt,decrypt} from '../server/src/settings-secrets.js';
import {r2SettingsCardHtml} from '../src/settings/r2.js';

process.env.SETTINGS_ENCRYPTION_KEY='local-test-encryption-key-only';
const master={id:'admin-test',role:'master'};
const input={enabled:true,account:'a'.repeat(32),bucket:'exam-media',accessKeyId:'test-access',secretAccessKey:'test-secret'};
let stored=null,reads=0,writes=0,checks=0,stops=0;
const db=async(sql,args)=>{
  if(sql.startsWith('SELECT')){reads++;return {rowCount:stored?1:0,rows:stored?[{value_enc:stored}]:[]};}
  writes++;stored=args[0];return {};
};
const service=createR2Settings({db,env:{},check:async()=>{checks++;},configure:async({env})=>env.R2_MEDIA_ENABLED==='true'?{source:()=>env.R2_BUCKET,stop:()=>{stops++;}}:null});
const runtime=await service.start({});
assert.equal(runtime.enabled,false);
for(const role of ['student','teacher',undefined])for(const name of ['getR2Settings','testR2Settings','saveR2Settings']){
  const before=reads;await assert.rejects(service.action({role},name,input),e=>e.statusCode===403);assert.equal(reads,before);
}
const tested=await service.action(master,'testR2Settings',input);
assert.match(tested.message,/thành công/);assert.equal(writes,0);assert.equal(runtime.enabled,false);
const saved=await service.action(master,'saveR2Settings',input);
assert.equal(runtime.enabled,true);assert.equal(runtime.source('file'),'exam-media');assert.equal(checks,2);
assert.equal(saved.credentialsConfigured,true);assert.equal('accessKeyId' in saved,false);assert.equal('secretAccessKey' in saved,false);
assert.ok(!stored.includes(input.secretAccessKey));assert.deepEqual(JSON.parse(decrypt(stored)),input);
await service.action(master,'saveR2Settings',{...input,accessKeyId:'',secretAccessKey:''});
assert.equal(JSON.parse(decrypt(stored)).secretAccessKey,input.secretAccessKey);
const beforeReads=reads;await runtime.source('file');assert.equal(reads,beforeReads,'media delivery must not read SQL');
await service.action(master,'saveR2Settings',{...input,enabled:false,accessKeyId:'',secretAccessKey:''});
assert.equal(runtime.enabled,false);assert.equal(await runtime.source('file'),null);assert.equal(stops,2);
const fail=createR2Settings({db,env:{},check:async()=>{throw new Error('probe failed');}});
const beforeWrites=writes;await assert.rejects(fail.action(master,'saveR2Settings',input));assert.equal(writes,beforeWrites);
assert.throws(()=>normalizeR2Config({...input,account:'https://evil.example'}));
assert.throws(()=>normalizeR2Config({...input,enabled:'true'}));
assert.throws(()=>normalizeR2Config({...input,accessKeyId:''}));
assert.throws(()=>normalizeR2Config({...input,account:'b'.repeat(32),accessKeyId:'',secretAccessKey:''},input));
assert.throws(()=>normalizeR2Config({...input,bucket:'../bucket'}));
const restart=createR2Settings({db,env:{R2_MEDIA_ENABLED:'true'}});
assert.equal((await restart.action(master,'getR2Settings')).enabled,false,'saved disable overrides environment');
// Compatibility with previously stored SMTP ciphertext; same salt and IV/tag format.
const iv=crypto.randomBytes(12),key=crypto.scryptSync(process.env.SETTINGS_ENCRYPTION_KEY,'g2g-settings-v1',32);
const cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update('old-smtp-password'),cipher.final()]);
assert.equal(decrypt(Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64')),'old-smtp-password');
assert.equal(decrypt(encrypt('new-password')),'new-password');
const html=r2SettingsCardHtml();assert.match(html,/fieldset[^>]*disabled/);assert.match(html,/type="password"/);assert.match(html,/role="status"/);
const css=fs.readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
assert.doesNotMatch(css,/#settings-panel-general\s*\{\s*grid-template-columns:minmax\(0,760px\)/);
assert.match(css,/\.cai-dat-grid\s*\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/\.cai-dat-grid\s*\{\s*grid-template-columns:1fr/);
console.log('R2 settings: encrypted storage, SMTP compatibility, role guards, redaction, retained keys, validation, test-before-enable, hot reload, env override and responsive layout passed.');
