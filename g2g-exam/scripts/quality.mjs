import {spawnSync} from 'node:child_process';
import {existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const appRoot=fileURLToPath(new URL('../',import.meta.url));
export const uiTests=[
  'tests/theme.test.mjs','tests/badge-colors.test.mjs','tests/disclosure-motion.test.mjs',
  'tests/dashboard.test.mjs','tests/monitor-chart.test.mjs','tests/exam-access.test.mjs',
  'tests/name-confirm.test.mjs','tests/speaking-lab.test.mjs',
  'tests/speaking-exam-model.test.mjs','tests/speaking-exam-entry.test.mjs',
];
const integrationTests=[
  'tests/courses.integration.mjs','tests/courses-ui.test.mjs',
  'tests/backend-access.integration.mjs','tests/exam-completion.integration.mjs',
  'tests/publication.integration.mjs','tests/speaking-lab.integration.mjs',
  'tests/speaking-archive.integration.mjs',
  'tests/speaking-exams.integration.mjs','tests/speaking-exam-guards.integration.mjs',
  'tests/performance.integration.mjs','tests/performance-http.integration.mjs',
];
const extras=[
  'tests/application-defense.test.mjs',
  'tests/error-reporting.test.mjs',
  'tests/request-origin.test.mjs',
  'tests/confirm-accessibility.test.mjs',
  'tests/deploy-health.test.mjs',
  'tests/legal-pages.test.mjs','tests/speaking-devices.test.mjs',
  'tests/backup-control.test.mjs','tests/backup-policy.test.mjs',
  'tests/backup-progress.test.mjs','tests/backup-data.test.mjs','tests/backup-page.test.mjs',
];
const nodeStep=file=>({name:file,command:process.execPath,args:[file]});
const npmStep=script=>({name:script,command:'npm',args:script==='test'?['test']:['run',script]});

export function qualityPlan({risk='medium',tests=[]}={}){
  if(!['low','medium','high'].includes(risk))throw Error('Risk must be low, medium or high.');
  for(const file of tests){
    if(!/^tests\/[a-z0-9-]+\.test\.mjs$/.test(file)||!existsSync(path.join(appRoot,file)))throw Error('Choose an existing tests/*.test.mjs file, without traversal.');
    if(!realpathSync(path.join(appRoot,file)).startsWith(realpathSync(path.join(appRoot,'tests'))+path.sep))throw Error('Test symlinks must stay inside tests/.');
  }
  const steps=[{name:'syntax',command:'sh',args:['server/check-code.sh']},npmStep('test:workflow')];
  if(risk!=='low')steps.push(npmStep('test'));
  steps.push(...[...new Set([...uiTests,...tests])].map(nodeStep));
  if(risk!=='low')steps.push(npmStep('test:performance'));
  if(risk==='high')steps.push(nodeStep('tests/backend-dependencies.test.mjs'),npmStep('test:r2'),...extras.map(nodeStep),...integrationTests.filter(f=>!f.includes('performance-http')).map(nodeStep),nodeStep('tests/speaking-phone.test.mjs'),nodeStep('tests/speaking-exams-ui.test.mjs'));
  steps.push(npmStep('build:web'));
  if(risk==='high')steps.push(nodeStep('tests/performance-http.integration.mjs'),nodeStep('tests/speaking-qr.test.mjs'),
    {name:'dependency-audit:web',command:'npm',args:['audit','--audit-level=high']},
    {name:'dependency-audit:server',command:'npm',args:['audit','--prefix','server','--audit-level=high']});
  return {risk,requirements:risk==='high'?['G2G_PGLITE_PATH','G2G_JSDOM_PATH']:[],steps};
}
export function runQuality(plan,{env=process.env,run=spawnSync,log=console.log}={}){
  for(const name of plan.requirements)if(!env[name]||!existsSync(env[name]))throw Error(`Missing ${name}: use the isolated runtime described in docs/QUALITY_GATES.md. No checks were skipped.`);
  const childEnv={...env,NODE_ENV:'test'};
  // Do not inherit a production database target or start the optional HTTP preview.
  for(const key of ['DATABASE_URL','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE','G2G_PREVIEW_PORT'])delete childEnv[key];
  let completed=0;
  for(const step of plan.steps){
    log(`[quality:${plan.risk}] ${step.name}`);
    const result=run(step.command,step.args,{cwd:appRoot,env:childEnv,stdio:'inherit',shell:false,timeout:10*60*1000});
    if(result.error||result.signal||result.status!==0)throw Error(`Quality gate failed: ${step.name} (${result.error?.code||result.signal||result.status}). ${completed}/${plan.steps.length} checks completed.`);
    completed++;
  }
  log(`Automated ${plan.risk} gate passed: ${completed} checks. This is not visual, production or release approval.`);
  return completed;
}
export function parseQualityArgs(args){
  const options={risk:'medium',tests:[],plan:false};
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--plan')options.plan=true;
    else if(arg==='--risk'&&args[i+1])options.risk=args[++i];
    else if(arg==='--test'&&args[i+1])options.tests.push(args[++i]);
    else throw Error('Usage: node scripts/quality.mjs [--risk low|medium|high] [--test tests/name.test.mjs] [--plan]');
  }
  return options;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const options=parseQualityArgs(process.argv.slice(2)),plan=qualityPlan(options);
    if(options.plan)console.log(JSON.stringify(plan,null,2));else runQuality(plan);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
