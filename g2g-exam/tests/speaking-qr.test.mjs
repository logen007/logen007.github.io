import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// Exercise the actual shared module with production browser/minify/splitting
// settings. A non-splitting build masks the CommonJS namespace-export failure.
const outdir=await mkdtemp(path.join(tmpdir(),'g2g-speaking-qr-'));
await build({entryPoints:[fileURLToPath(new URL('../src/speaking/qr.js',import.meta.url))],outdir,bundle:true,splitting:true,minify:true,format:'esm',platform:'browser',target:'es2022',outExtension:{'.js':'.mjs'}});
const {drawQr}=await import(pathToFileURL(path.join(outdir,'qr.mjs')).href);
for(const width of [208,224]){
 let pixels;
 const canvas={width:0,height:0,style:{},getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),clearRect(){},putImageData(image){pixels=image.data;}})};
 assert.equal(await drawQr(canvas,'https://exam.g2gcareer.com/speaking-lab.html?session=12345678-1234-1234-1234-123456789abc',width),canvas);
 assert.equal(canvas.width,width);assert.equal(canvas.height,width);
 assert.equal(pixels.length,width*width*4);
 assert.ok(pixels.some((v,i)=>i%4===0&&v===0),'QR has dark modules');
 assert.ok(pixels.some((v,i)=>i%4===0&&v===255),'QR has white modules');
}
console.log('Speaking QR: real browser split/minified bundle renders both admin and desktop-handoff sizes.');
