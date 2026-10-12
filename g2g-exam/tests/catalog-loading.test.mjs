import assert from 'node:assert/strict';
import './navigation-loading.test.mjs';
import './fid.test.mjs';
import {ApiRepository} from '../src/repositories/api.js';
import {initialStateScope,viewStateScope} from '../src/repositories/state-scope.js';
import {stateResponse} from '../server/src/state-response.js';

assert.equal(initialStateScope({role:'student'},'https://test/'),'catalog');
assert.equal(initialStateScope({role:'teacher'},'https://test/'),'catalog');
for(const query of ['?edit=e&section=s','?preview=e','?view=exam&attempt=a','?tab=grades'])
  assert.equal(initialStateScope({role:'teacher'},'https://test/'+query),'full');
assert.equal(viewStateScope('admin','exams'),'catalog');
assert.equal(viewStateScope('builder'),'full');
const reply={headers:{},header(k,v){this.headers[k]=v;return this;},code(n){this.status=n;return this;},send(){return null;}};
const first=stateResponse({revision:1,exams:[{id:'e'}]},{headers:{}},reply),etag=reply.headers.ETag;
assert.equal(stateResponse({revision:999,exams:[{id:'e'}]},{headers:{'if-none-match':etag}},reply),null);
assert.equal(reply.status,304);
assert.notEqual(stateResponse({exams:[{id:'changed'}]},{headers:{}},reply).revision,first.revision);
assert.equal(reply.headers['Cache-Control'],'private, no-cache');

const saved={fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,document:globalThis.document};
let poll,requests=[],defer=null,emit=0;
const catalog={scope:'catalog',revision:'catalog-1',exams:[{id:'e',title:'Summary'}],questions:[]};
const full={revision:'full-1',exams:[{id:'e',title:'Full',sections:[{instruction:'Keep this'}]}],questions:[{id:'q',title:'Keep question'}]};
globalThis.setInterval=fn=>(poll=fn,1);globalThis.clearInterval=()=>{};
globalThis.document={hidden:false};
globalThis.fetch=async(url,options)=>{
  requests.push({url,options});
  if(defer)return new Promise(resolve=>{defer.resolve=resolve;});
  if(options.headers['If-None-Match'])return {status:304};
  if(url.endsWith('/commit'))return {ok:true,json:async()=>({ok:true})};
  return {ok:true,json:async()=>url.endsWith('/exam-catalog')?structuredClone(catalog):structuredClone(full)};
};
try{
  const repo=new ApiRepository();repo.user={id:'t',role:'teacher'};repo.pollScope='catalog';
  repo.subscribe(()=>emit++);
  await repo.reload();repo.startPolling();
  assert.equal(requests[0].url,'/api/exam-catalog');
  const before=emit;await poll();assert.equal(emit,before,'304 must not emit or rerender');
  globalThis.document.hidden=true;const calls=requests.length;await poll();assert.equal(requests.length,calls);globalThis.document.hidden=false;
  await Promise.all([repo.ensureFull(),repo.ensureFull()]);
  assert.equal(requests.filter(r=>r.url==='/api/state').length,1,'Concurrent detail opens share one load');
  repo.setPollingScope('catalog');defer={};
  const pending=poll();await Promise.resolve();await poll();
  assert.equal(requests.at(-1).url,'/api/exam-catalog');
  const stale=defer;defer=null;
  await repo.ensureFull({refresh:true});
  stale.resolve({ok:true,json:async()=>catalog});await pending;
  assert.notEqual(repo.state.scope,'catalog','Old catalog response cannot replace freshly loaded details');
  repo.state={...catalog};repo.pollScope='catalog';
  await repo.transaction(state=>{
    assert.equal(state.questions[0].title,'Keep question','Hydrate before mutating');
    assert.equal(state.exams[0].sections[0].instruction,'Keep this');
    state.exams[0].title='Renamed';
  });
  const operations=JSON.parse(requests.find(r=>r.url.endsWith('/commit')).options.body).operations;
  assert.equal(operations.length,1);assert.equal(operations[0].item.sections[0].instruction,'Keep this');
  assert.equal(operations[0].kind,'upsert');
  console.log('Catalog loading: conditional reads, deep links, deduplication, stale responses and safe hydration passed.');
}finally{Object.assign(globalThis,saved);}
