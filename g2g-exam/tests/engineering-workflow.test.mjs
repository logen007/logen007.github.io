import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qualityPlan,parseQualityArgs,runQuality,uiTests} from '../scripts/quality.mjs';
import {verifyRelease} from '../scripts/verify-release.mjs';

for(const risk of ['low','medium','high']){
  const plan=qualityPlan({risk});
  assert.ok(plan.steps.some(s=>s.name==='syntax'));
  assert.ok(plan.steps.some(s=>s.name==='build:web'));
  for(const file of uiTests)assert.ok(plan.steps.some(s=>s.name===file));
  assert.ok(!JSON.stringify(plan).includes('auto-deploy'));
}
assert.throws(()=>qualityPlan({risk:'unknown'}));
for(const file of ['../tests/core.test.mjs','/tmp/core.test.mjs','tests/no-such.test.mjs','tests/core.test.mjs;echo bad'])assert.throws(()=>qualityPlan({tests:[file]}));
assert.throws(()=>parseQualityArgs(['--risk']));assert.throws(()=>parseQualityArgs(['--skip-tests']));
assert.equal(parseQualityArgs(['--risk','low','--plan']).plan,true);
assert.ok(qualityPlan({tests:['tests/core.test.mjs','tests/core.test.mjs']}).steps.filter(s=>s.name==='tests/core.test.mjs').length===1);
const high=qualityPlan({risk:'high'});
assert.deepEqual(high.requirements,['G2G_PGLITE_PATH','G2G_JSDOM_PATH']);
assert.ok(high.steps.some(s=>s.name==='dependency-audit:server'));
assert.ok(high.steps.some(s=>s.name==='tests/backend-dependencies.test.mjs'));
assert.ok(high.steps.some(s=>s.name==='tests/deploy-health.test.mjs'));
assert.ok(!high.steps.some(s=>s.name==='tests/backup-media-lock.integration.mjs'),'Real PostgreSQL drills require a separately authorized isolated environment');
let calls=0;
assert.throws(()=>runQuality(high,{env:{},run:()=>{calls++;},log:()=>{}}),/Missing/);assert.equal(calls,0);
assert.throws(()=>runQuality(qualityPlan({risk:'low'}),{env:{},run:()=>{calls++;return {status:1};},log:()=>{}}),/gate failed/);assert.equal(calls,1);
let childOptions;
const low=qualityPlan({risk:'low'});
assert.equal(runQuality(low,{env:{DATABASE_URL:'forbidden',PGHOST:'production',G2G_PREVIEW_PORT:'8080'},run:(_cmd,_args,options)=>{childOptions=options;return {status:0};},log:()=>{}}),low.steps.length);
assert.equal(childOptions.shell,false);assert.equal(childOptions.env.DATABASE_URL,undefined);assert.equal(childOptions.env.PGHOST,undefined);assert.equal(childOptions.env.G2G_PREVIEW_PORT,undefined);
for(const result of [{status:null,error:{code:'ENOENT'}},{status:0,signal:'SIGTERM'}])assert.throws(()=>runQuality(low,{env:{},run:()=>result,log:()=>{}}));

const fixture=({health={ok:true,database:true,backend:'vps'},version='1.2.3',status=200}={})=>async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
  return {ok:status===200,status,json:async()=>url.pathname==='/api/health'?health:{version}};
};
assert.equal((await verifyRelease('http://127.0.0.1:8080','1.2.3',{fetchImpl:fixture()})).ok,true);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:fixture({health:{ok:false,database:false,backend:'vps'}})}),/health failed/);
for(const health of [{ok:true,database:false,backend:'vps'},{ok:true,backend:'vps'},{ok:true,database:true,backend:'other'}])await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:fixture({health})}),/health failed/);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:async()=>{throw Error('offline');}}),/offline/);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:fixture({version:'1.2.2'})}),/version differs/);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:fixture({status:503})}),/HTTP failure/);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:async()=>{throw new DOMException('Timed out','TimeoutError');}}),/Timed out/);
await assert.rejects(verifyRelease('https://example.test','1.2.3',{fetchImpl:async()=>({ok:true,json:async()=>{throw Error('bad JSON');}})}),/invalid JSON/);
for(const url of ['file:///tmp','https://user:secret@example.test','https://example.test/api','https://example.test/?token=secret'])await assert.rejects(verifyRelease(url,'1.2.3',{fetchImpl:fixture()}));
await assert.rejects(verifyRelease('https://example.test','latest',{fetchImpl:fixture()}));
const ci=readFileSync(new URL('../../.github/workflows/g2g-check.yml',import.meta.url),'utf8');
const bootstrap=readFileSync(new URL('../../README.md',import.meta.url),'utf8');
for(const target of ['g2g-exam/AGENTS.md','G2G-CONNECTIONS.local.md','docs/ENGINEERING.md','docs/QUALITY_GATES.md','không merge main'])assert.ok(bootstrap.includes(target));
assert.doesNotMatch(bootstrap,/root@\d|BEGIN (?:OPENSSH|RSA) PRIVATE KEY|(?:\d{1,3}\.){3}\d{1,3}/,'Public bootstrap must not publish private connection metadata');
assert.match(ci,/pull_request:/);assert.match(ci,/contents: read/);assert.match(ci,/persist-credentials: false/);
assert.ok(!ci.includes('pull_request_target'),'Untrusted PR code must not run with privileged trigger');
assert.match(ci,/npm run test:workflow/);
assert.match(ci,/node tests\/publication.integration.mjs/);
assert.match(ci,/dependency-audit:/);
assert.match(ci,/node tests\/backend-dependencies.test.mjs/);
assert.match(ci,/node tests\/deploy-health.test.mjs/);
console.log('Engineering workflow: profiles, no silent skips, fail-fast, test isolation, CI contract and semantic release probes passed.');
