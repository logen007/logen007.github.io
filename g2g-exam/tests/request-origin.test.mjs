import assert from 'node:assert/strict';
import Fastify from '../server/node_modules/fastify/fastify.js';
import cors from '../server/node_modules/@fastify/cors/index.js';
import {requestOriginPolicy} from '../server/src/request-origin.js';
const policy=requestOriginPolicy({production:true,publicUrl:'https://exam.example.test/app',origins:' https://staff.example.test '});
const app=Fastify();let writes=0;
app.addHook('onRequest',async request=>policy.guard(request));
await app.register(cors,{origin:(origin,cb)=>cb(null,policy.allows(origin)),credentials:true});
app.route({method:['POST','PUT','PATCH','DELETE'],url:'/write',handler:async()=>{writes++;return {ok:true};}});
app.get('/callback',async()=>({ok:true}));
try{
  const preflight=origin=>app.inject({method:'OPTIONS',url:'/write',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}});
  const trusted=await preflight('https://exam.example.test');
  assert.equal(trusted.statusCode,204);assert.equal(trusted.headers['access-control-allow-origin'],'https://exam.example.test');
  assert.equal(trusted.headers['access-control-allow-credentials'],'true');
  assert.equal((await preflight('https://other.example.test')).headers['access-control-allow-origin'],undefined);
  for(const origin of ['https://evil.invalid','https://other.example.test','null']){
    assert.equal(policy.allows(origin),false);
    for(const type of ['application/json','text/plain','application/x-www-form-urlencoded']){
      const response=await app.inject({method:'POST',url:'/write',headers:{origin,'content-type':type},payload:type==='application/json'?'{}':'x=1'});
      assert.equal(response.statusCode,403);
    }
  }
  assert.equal(writes,0,'Rejected browser origins cannot reach the write handler');
  for(const origin of ['https://exam.example.test','https://staff.example.test',undefined]){
    const headers=origin?{origin}:{};
    assert.equal((await app.inject({method:'POST',url:'/write',headers})).statusCode,200);
  }
  assert.equal(writes,3);
  const before=writes;
  for(const site of ['cross-site','same-site','unknown','','SAME-ORIGIN','same-origin, cross-site']){
    for(const method of ['POST','PUT','PATCH','DELETE']){
      for(const type of ['application/json','text/plain','application/x-www-form-urlencoded']){
        const response=await app.inject({method,url:'/write',headers:{'sec-fetch-site':site,'content-type':type},payload:type==='application/json'?'{}':'x=1'});
        assert.equal(response.statusCode,403,`${site}/${method}/${type} without Origin is rejected`);
      }
    }
  }
  assert.equal(writes,before,'Missing-Origin browser-context rejection occurs before handler side effects');
  for(const site of ['same-origin','none']){
    assert.equal((await app.inject({method:'POST',url:'/write',headers:{'sec-fetch-site':site},payload:{}})).statusCode,200);
  }
  for(const origin of ['https://exam.example.test','https://staff.example.test']){
    for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await app.inject({method,url:'/write',headers:{origin,'sec-fetch-site':'cross-site'},payload:{}})).statusCode,200,'Explicit trusted Origin remains supported');
  }
  for(const origin of ['','null','https://evil.invalid']){
    assert.equal((await app.inject({method:'POST',url:'/write',headers:{origin,'sec-fetch-site':'same-origin'},payload:{}})).statusCode,403,'Metadata never overrides untrusted Origin');
  }
  assert.equal((await app.inject({url:'/callback',headers:{'sec-fetch-site':'cross-site'}})).statusCode,200,'Cross-site GET callbacks are unaffected');
  assert.doesNotThrow(()=>requestOriginPolicy().guard({method:'POST',headers:{'sec-fetch-site':'cross-site'}}),'Local preview contract is unchanged');
  assert.equal(requestOriginPolicy().allows('http://127.0.0.1:8765'),true,'Local preview remains usable');
  assert.equal(requestOriginPolicy({origins:'http://localhost:8080'}).allows('https://other.invalid'),false,'Explicit development allowlist is retained');
  console.log('Origin policy: exact allowlist, missing-Origin browser-context rejection before writes, trusted integrations, GET callbacks and legacy/local compatibility passed in isolated Fastify.');
}finally{await app.close();}
