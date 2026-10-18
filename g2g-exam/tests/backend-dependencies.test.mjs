// Real dependency contracts, isolated files and MIME buffers: no SMTP or DB.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {brotliCompressSync} from 'node:zlib';
import Fastify from '../server/node_modules/fastify/fastify.js';
import fastifyStatic from '../server/node_modules/@fastify/static/index.js';
import {registerHooks} from 'node:module';
// Resolve through the server's package scope, exercising its public ESM export.
const hook=registerHooks({resolve(specifier,context,next){
  if(specifier==='nodemailer')return next(specifier,{...context,parentURL:new URL('../server/src/mail.js',import.meta.url).href});
  return next(specifier,context);
}});
const {default:nodemailer}=await import('nodemailer');
hook.deregister();

const scratch=await mkdtemp(path.join(os.tmpdir(),'g2g-dependencies-'));
const app=Fastify({logger:false});
try{
  const publicDir=path.join(scratch,'public'),assets=path.join(publicDir,'assets');
  await mkdir(assets,{recursive:true});
  await writeFile(path.join(scratch,'private.txt'),'OUTSIDE_SENTINEL');
  await writeFile(path.join(publicDir,'index.html'),'<h1>G2G</h1>');
  const source='console.log("G2G");';
  await writeFile(path.join(assets,'app.js'),source);
  await writeFile(path.join(assets,'app.js.br'),brotliCompressSync(source));
  await app.register(fastifyStatic,{root:assets,prefix:'/assets/',decorateReply:false,preCompressed:true});
  await app.register(fastifyStatic,{root:publicDir,prefix:'/',index:['index.html'],preCompressed:true});
  assert.equal((await app.inject('/')).body,'<h1>G2G</h1>');
  const compressed=await app.inject({url:'/assets/app.js',headers:{'accept-encoding':'br'}});
  assert.equal(compressed.statusCode,200);
  assert.equal(compressed.headers['content-encoding'],'br');
  assert.deepEqual(compressed.rawPayload,brotliCompressSync(source));
  const range=await app.inject({url:'/assets/app.js',headers:{range:'bytes=0-6'}});
  assert.equal(range.statusCode,206);assert.equal(range.body,source.slice(0,7));
  assert.equal((await app.inject('/assets/missing.js')).statusCode,404);
  for(const url of ['/../private.txt','/%2e%2e/private.txt','/assets/..%2f..%2fprivate.txt','/assets/%2e%2e%5c%2e%2e%5cprivate.txt']){
    const response=await app.inject(url);
    assert.notEqual(response.statusCode,200,url);
    assert.ok(!response.body.includes('OUTSIDE_SENTINEL'),url);
  }

  const mailer=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
  const message={from:'"G2G Career" <exam@example.test>',to:'student@example.test',replyTo:'teacher@example.test',subject:'Kết quả Prüfung',text:'Kết quả: Đạt',html:'<b>Đạt</b>',disableFileAccess:true,disableUrlAccess:true};
  const info=await mailer.sendMail({...message,attachments:[{filename:'result.txt',content:Buffer.from('Synthetic result')}]});
  assert.deepEqual(info.envelope,{from:'exam@example.test',to:['student@example.test']});
  const mime=info.message.toString();
  assert.match(mime,/Reply-To: teacher@example.test/);
  assert.match(mime,/multipart\/alternative/);assert.match(mime,/filename=result.txt/);
  assert.ok(info.messageId);
  await assert.rejects(mailer.sendMail({...message,attachments:[{path:path.join(scratch,'private.txt')}]}),/File access rejected/i);
  await assert.rejects(mailer.sendMail({...message,attachments:[{path:'https://example.invalid/private'}]}),/Url access rejected/i);
  mailer.close();
  console.log('Real static delivery, traversal rejection, MIME and mail access guards passed (no external services).');
}finally{await app.close();await rm(scratch,{recursive:true,force:true});}
