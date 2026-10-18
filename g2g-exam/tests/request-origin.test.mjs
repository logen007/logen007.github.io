import assert from 'node:assert/strict';
import Fastify from '../server/node_modules/fastify/fastify.js';
import {requestOriginPolicy} from '../server/src/request-origin.js';
const policy=requestOriginPolicy({production:true,publicUrl:'https://exam.example.test/app',origins:' https://staff.example.test '});
const app=Fastify();let writes=0;
app.addHook('onRequest',async request=>policy.guard(request));
app.post('/write',async()=>{writes++;return {ok:true};});
try{
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
  assert.equal(requestOriginPolicy().allows('http://127.0.0.1:8765'),true,'Local preview remains usable');
  assert.equal(requestOriginPolicy({origins:'http://localhost:8080'}).allows('https://other.invalid'),false,'Explicit development allowlist is retained');
  console.log('Origin policy: production exact allowlist, sibling/opaque-origin rejection before writes and local preview passed.');
}finally{await app.close();}
