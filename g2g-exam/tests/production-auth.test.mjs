import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {loginReturnPath} from '../server/src/auth-routing.js';
import {createRepository} from '../src/repository.js';
import {ApiRepository} from '../src/repositories/api.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log(`✓ ${name}`);}

await test('Production config ignores route/demo identity and never loads the retired bypass',()=>{
  for(const pathname of ['/','/adm','/teacher','/student']){
    const window={G2G_DEMO_BYPASS:true};
    vm.runInNewContext(read('server/runtime/runtime-config.js'),{window,location:{pathname}});
    assert.equal(window.G2G_API_BASE,'/api');
    assert.equal(window.G2G_DEMO_BYPASS,false);
  }
  vm.runInNewContext(read('src/demo-bypass.js'),{});
  assert.doesNotMatch(read('vi.html'),/<script[^>]+demo-bypass/);
  assert.match(read('vi.html'),/href="\/api\/auth\/google"/);
  assert.match(read('src/app.js'),/repo.mode==='local'&&populateGoetheA1TestFixture/);
});

await test('Login returns to the correct role with safe editing links',()=>{
  assert.equal(loginReturnPath('/adm?edit=exam-123','teacher'),'/teacher?edit=exam-123');
  assert.equal(loginReturnPath('/teacher?edit=exam-123','master'),'/adm?edit=exam-123');
  assert.equal(loginReturnPath('/adm?edit=exam-123','student'),'/student');
  for(const path of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test','/api/auth/logout','/\nevil.test']){
    assert.equal(loginReturnPath(path,'master'),'/adm');
  }
});

await test('API is authoritative, initial state is ready, and edits are persisted through authenticated commit',async()=>{
  const names=['fetch','G2G_API_BASE','G2G_DEMO_BYPASS','localStorage','sessionStorage'];
  const previous=new Map(names.map(name=>[name,globalThis[name]]));
  const user={id:'google:teacher',role:'teacher',active:true};
  let state={schemaVersion:6,revision:1,users:[user],exams:[],questions:[]},authenticated=true,failState=false;
  const requests=[],repos=[];
  globalThis.G2G_API_BASE='/api';globalThis.G2G_DEMO_BYPASS=true;
  globalThis.localStorage={getItem:()=>{throw Error('Must not read local data');}};
  globalThis.sessionStorage={getItem:()=>{throw Error('Must not read demo identity');}};
  globalThis.fetch=async(url,options)=>{
    requests.push({url,options});assert.equal(options.credentials,'include');
    if(url.endsWith('/auth/me'))return {ok:true,json:async()=>({user:authenticated?user:null})};
    if(url.endsWith('/state')){
      if(failState)return {ok:false,status:503,json:async()=>({error:'Database unavailable'})};
      return {ok:true,json:async()=>structuredClone(state)};
    }
    if(url.endsWith('/commit')){
      const {operations}=JSON.parse(options.body);
      assert.equal(operations.length,1);assert.equal(operations[0].collection,'exams');
      state.exams=[operations[0].item];state.revision++;
      return {ok:true,json:async()=>({ok:true})};
    }
    throw Error(`Unexpected ${url}`);
  };
  try{
    const repo=await createRepository();repos.push(repo);
    assert.ok(repo instanceof ApiRepository);
    assert.equal((await repo.getState()).users[0].id,user.id);
    assert.deepEqual(requests.map(r=>r.url),['/api/auth/me','/api/state']);
    await repo.transaction(next=>{next.exams.push({id:'server-draft',ownerId:user.id,title:'Server draft'});});
    assert.equal((await repo.getState()).exams[0].id,'server-draft');
    const otherDevice=await createRepository();repos.push(otherDevice);
    assert.equal((await otherDevice.getState()).exams[0].title,'Server draft');
    failState=true;
    await assert.rejects(createRepository(),/Database unavailable/);
    failState=false;authenticated=false;requests.length=0;
    const anonymous=await createRepository();repos.push(anonymous);
    assert.equal(await anonymous.getCurrentUser(),null);
    assert.ok(requests.every(r=>r.url==='/api/auth/me'));
    assert.equal((await anonymous.getState()).exams.length,0);
  }finally{
    repos.forEach(repo=>clearInterval(repo.poll));
    for(const [name,value]of previous){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
  }
});

function authHarness({existing=null,payload={sub:'new',email:'student@example.test',email_verified:true},master=false}={}){
  const routes=new Map(),writes=[],cookies=[];let exchanges=0;
  const appError=(code,text)=>Object.assign(new Error(text),{statusCode:code});
  const context={crypto,process:{env:{NODE_ENV:'production',PUBLIC_URL:'https://exam.g2gcareer.com',GOOGLE_CLIENT_ID:'test-id',GOOGLE_CLIENT_SECRET:'test-secret'}},
    loginReturnPath,appError,now:()=>new Date().toISOString(),normalizeEmail:x=>x.trim().toLowerCase(),isPrimaryMasterEmail:()=>master,
    getSettings:async()=>({auth:{googleLoginEnabled:true,allowNewStudents:true,teacherEmails:[]}}),
    query:async(sql,args)=>{if(sql.startsWith('SELECT'))return {rowCount:existing?1:0,rows:existing?[existing]:[]};writes.push({sql,args});return {rowCount:1};},
    OAuth2Client:class{
      generateAuthUrl(options){return `https://accounts.google.com/?state=${options.state}`;}
      async getToken(){exchanges++;return {tokens:{id_token:'verified-test-token'}};}
      async verifyIdToken(options){assert.equal(options.audience,'test-id');return {getPayload:()=>payload};}
    }
  };
  const source=read('server/src/auth.js').replace(/^import .*;\n/gm,'').replace(/export /g,'');
  vm.runInNewContext(source,context);
  const registered=context.registerAuthRoutes({get:(url,fn)=>routes.set(url,fn),post:(url,fn)=>routes.set(url,fn)});
  const request={cookies:{g2g_oauth_state:'valid-state',g2g_return_to:'/adm?edit=server-draft'},query:{code:'test-code',state:'valid-state'},unsignCookie:value=>({valid:Boolean(value),value})};
  const reply={setCookie:(name,value,options)=>cookies.push({name,value,options}),clearCookie:()=>{},redirect:value=>value};
  return {routes,writes,cookies,request,reply,registered,context,exchanges:()=>exchanges};
}

await test('Google callback verifies state and email before writing an account or session',async()=>{
  const h=authHarness();await h.registered;
  h.request.query.state='wrong';
  await assert.rejects(h.routes.get('/api/auth/google/callback')(h.request,h.reply),/không hợp lệ/);
  assert.equal(h.exchanges(),0);assert.equal(h.writes.length,0);assert.equal(h.cookies.length,0);
  for(const email_verified of [false,undefined]){
    const unverified=authHarness({payload:{sub:'new',email:'student@example.test',email_verified}});await unverified.registered;
    await assert.rejects(unverified.routes.get('/api/auth/google/callback')(unverified.request,unverified.reply),/chưa xác minh/);
    assert.equal(unverified.writes.length,0);assert.equal(unverified.cookies.length,0);
  }
});

await test('New Google accounts are students; primary master uses server authorization and preserves deep link',async()=>{
  for(const master of [false,true]){
    const h=authHarness({master});await h.registered;
    const redirect=await h.routes.get('/api/auth/google/callback')(h.request,h.reply);
    assert.equal(redirect,master?'/adm?edit=server-draft':'/student');
    assert.equal(h.writes[0].args[2],master?'master':'student');
    const session=h.cookies.find(c=>c.name==='g2g_session');
    assert.equal(session.value,'google:new');
    assert.equal(session.options.httpOnly,true);assert.equal(session.options.signed,true);assert.equal(session.options.secure,true);
  }
});

await test('Inactive accounts cannot login and JSON profile cannot override authoritative database role',async()=>{
  const existing={id:'google:new',email:'student@example.test',role:'student',active:false,data:{role:'master',active:true,id:'forged'}};
  const h=authHarness({existing});await h.registered;
  const user=await h.context.userById(existing.id);
  assert.equal(user.id,existing.id);assert.equal(user.role,'student');assert.equal(user.active,false);
  await assert.rejects(h.routes.get('/api/auth/google/callback')(h.request,h.reply),/vô hiệu hóa/);
  assert.equal(h.cookies.length,0);assert.equal(h.writes.length,0);
  h.request.cookies.g2g_session=existing.id;
  assert.equal(await h.context.currentUser(h.request),null);
});

await test('Cutover backs up before app deployment and performs no browser import',()=>{
  const deploy=read('server/auto-deploy.sh');
  assert.ok(deploy.indexOf('pg_dump -U g2g g2g_exam')<deploy.indexOf('up -d --build app'));
  assert.match(deploy,/backup FAILED; refusing cutover/);
  assert.match(deploy,/umask 077/);
  assert.match(deploy,/gzip -t/);
  assert.doesNotMatch(deploy,/down -v|pg_restore|TRUNCATE/);
});

console.log(`\n${passed} production login/persistence tests passed.`);
