import assert from 'node:assert/strict';
import {modulePreloads} from '../scripts/module-preloads.mjs';
const graph={
  'build/assets/app-A.js':{entryPoint:'src/app.js',imports:[{path:'build/assets/shared-B.js',kind:'import-statement'},{path:'build/assets/editor-C.js',kind:'dynamic-import'}]},
  'build/assets/shared-B.js':{imports:[{path:'./nested-D.js',kind:'import-statement'},{path:'https://example.invalid/sdk.js',kind:'import-statement',external:true}]},
  'build/assets/nested-D.js':{imports:[{path:'./shared-B.js',kind:'import-statement'}]},
  'build/assets/editor-C.js':{imports:[]},
  'build/assets/features-E.js':{entryPoint:'src/feature-loader.js',imports:[{path:'./shared-B.js',kind:'import-statement'}]},
  'build/assets/phone-F.js':{entryPoint:'src/speaking/phone.js',imports:[]},
};
const html=modulePreloads(graph,['src/app.js','src/feature-loader.js']);
assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),['/assets/app-A.js','/assets/shared-B.js','/assets/nested-D.js','/assets/features-E.js']);
assert.ok(!html.includes('editor-C')&&!html.includes('phone-F')&&!html.includes('example.invalid'),'Lazy/private-page SDKs are not prefetched');
assert.equal(modulePreloads(graph,['src/speaking/phone.js']),'<link rel="modulepreload" href="/assets/phone-F.js">');
console.log('Module preloads: static transitive graph, deduplication, cycles and lazy-feature isolation passed.');
