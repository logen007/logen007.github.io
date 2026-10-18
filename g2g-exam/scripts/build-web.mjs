import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.env.G2G_WEB_OUT||path.join(root,'.web-build'));
const specs={};
async function collectSpecs(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await collectSpecs(file);
    else if(entry.name.endsWith('.json'))specs['/'+path.relative(root,file).split(path.sep).join('/')]=JSON.parse(await fs.readFile(file,'utf8'));
  }
}
await collectSpecs(path.join(root,'specs'));
await fs.mkdir(path.join(out,'assets'),{recursive:true});
const result=await build({
  absWorkingDir:root,entryPoints:{app:'src/app.js',features:'src/feature-loader.js',speaking:'src/speaking/phone.js'},
  outdir:path.join(out,'assets'),entryNames:'[name]-[hash]',chunkNames:'chunk-[hash]',
  bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',
  minify:true,metafile:true,external:['node:*'],
  plugins:[{name:'approved-specs',setup(builder){
    builder.onLoad({filter:/exam-specs\/spec-loader\.js$/},async args=>{
      let source=await fs.readFile(args.path,'utf8');
      source=source.replace('async function readJson(url){',`const embeddedSpecs=${JSON.stringify(specs)};\nasync function readJson(url){\n  if(url.protocol!=='file:'&&Object.hasOwn(embeddedSpecs,url.pathname))return structuredClone(embeddedSpecs[url.pathname]);`);
      return {contents:source,loader:'js',resolveDir:path.dirname(args.path)};
    });
  }}],
});
let html=await fs.readFile(path.join(root,'vi.html'),'utf8');
let speakingHtml=await fs.readFile(path.join(root,'speaking-lab.html'),'utf8');
for(const [file,metadata] of Object.entries(result.metafile.outputs)){
  if(metadata.entryPoint==='src/speaking/phone.js')speakingHtml=speakingHtml.replace('./src/speaking/phone.js','/assets/'+path.basename(file));
  if(!['src/app.js','src/feature-loader.js'].includes(metadata.entryPoint))continue;
  const original=metadata.entryPoint==='src/app.js'?'app':'feature-loader';
  html=html.replace(new RegExp(`\\./src/${original}\\.js\\?[^" ]+`),'/assets/'+path.basename(file));
}
const cssAssets={};
for(const file of ['styles.css','enhancements.css']){
  const content=await fs.readFile(path.join(root,file));
  const name=file.replace('.css','-'+createHash('sha256').update(content).digest('hex').slice(0,12)+'.css');
  cssAssets[file]='/assets/'+name;
  await fs.writeFile(path.join(out,'assets',name),content);
  html=html.replace(new RegExp(`\\./${file.replace('.','\\.')}\\?[^" ]+`),'/assets/'+name);
  speakingHtml=speakingHtml.replace(new RegExp(`\\./${file.replace('.','\\.')}\\?[^" ]+`),'/assets/'+name);
}
await fs.writeFile(path.join(out,'vi.html'),html);
await fs.writeFile(path.join(out,'index.html'),html);
await fs.writeFile(path.join(out,'speaking-lab.html'),speakingHtml);
// Reuse the app's pre-paint preference bootstrap, without requiring the app or
// authentication to read public policy content. Source templates remain JS-free.
const colorModeBoot=html.match(/<script>try\{document\.documentElement\.dataset\.colorMode=[\s\S]*?<\/script>/)?.[0];
if(!colorModeBoot)throw new Error('Missing shared color-mode bootstrap');
for(const file of ['privacy.html','terms.html','legal.css']){
  if(file.endsWith('.css')){await fs.copyFile(path.join(root,file),path.join(out,file));continue;}
  let policy=await fs.readFile(path.join(root,file),'utf8');
  policy=policy.replace('<link rel="stylesheet" href="/styles.css">',colorModeBoot+`<link rel="stylesheet" href="${cssAssets['styles.css']}">`);
  await fs.writeFile(path.join(out,file),policy);
}
await fs.copyFile(path.join(root,'server/runtime/runtime-config.js'),path.join(out,'runtime-config.js'));
await fs.copyFile(path.join(root,'media-worker.js'),path.join(out,'media-worker.js'));
await fs.cp(path.join(root,'speaking-assets'),path.join(out,'speaking-assets'),{recursive:true});
await fs.mkdir(path.join(out,'src/ui'),{recursive:true});
await fs.copyFile(path.join(root,'src/ui/media-fallback.js'),path.join(out,'src/ui/media-fallback.js'));
for(const file of await fs.readdir(path.join(out,'assets'))){
  if(!/\.(js|css)$/.test(file))continue;
  const content=await fs.readFile(path.join(out,'assets',file));
  await fs.writeFile(path.join(out,'assets',file+'.gz'),gzipSync(content));
  await fs.writeFile(path.join(out,'assets',file+'.br'),brotliCompressSync(content));
}
console.log(JSON.stringify({output:out,assets:Object.keys(result.metafile.outputs).length,embeddedSpecifications:Object.keys(specs).length}));
