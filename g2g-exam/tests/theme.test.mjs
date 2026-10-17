import assert from 'node:assert/strict';
import {settingsRouteTab,settingsHref} from '../src/settings/route.js';
import {initialStateScope,viewStateScope} from '../src/repositories/state-scope.js';
for(const tab of ['general','access','email']){
  const href=settingsHref(tab,'https://example.com/adm?preview=old&section=2');
  assert.equal(settingsRouteTab(new URL(href,'https://example.com').href),tab);
  assert.equal(initialStateScope({role:'master'},new URL(href,'https://example.com').href),'catalog');
  assert.doesNotMatch(href,/preview=|section=/);
}
assert.equal(settingsRouteTab('https://example.com/adm?tab=settings&settings=invalid'),'general');
assert.equal(settingsRouteTab('https://example.com/adm?tab=exams'),null);
assert.equal(viewStateScope('admin','settings'),'catalog');
import {settingsTabs,settingsTabsHtml} from '../src/settings/tabs.js';
assert.equal(settingsTabs.length,4);
assert.deepEqual(settingsTabs.map(([id])=>id),['general','access','email','advanced']);
const settingsTabMarkup=settingsTabsHtml();
assert.equal((settingsTabMarkup.match(/role="tab"/g)||[]).length,4);
assert.equal((settingsTabMarkup.match(/aria-selected="true"/g)||[]).length,1);
assert.doesNotMatch(settingsTabMarkup,/settings-panel-operations|settings-panel-appearance/);
import {readFileSync} from 'node:fs';
import {normalizeThemeColor,themePalette,colorContrast,initializeTheme,acceptPublicSettings,currentTheme,saveLocalTheme} from '../src/settings/theme.js';

let passed=0;
import {normalizeLayout,layoutVariables,validateLayout} from '../src/settings/layout.js';
import {validateButtonTheme} from '../src/settings/palette.js';
import {settingsPageHtml} from '../src/settings/view.js';
import {DEFAULT_SETTINGS} from '../server/src/defaults.js';
assert.equal(normalizeLayout({contentWidth:99999}).contentWidth,1600);
assert.equal(layoutVariables({cardRadius:16,background:'warm'})['--r'],'16px');
assert.equal(layoutVariables({background:'url(invalid)'})['--nen'],'#F4F5F6');
assert.equal(normalizeLayout({contentWidth:1537,background:'#aabbcc'}).contentWidth,1537);
assert.equal(layoutVariables({background:'#aabbcc'})['--nen'],'#AABBCC');
for(const background of ['#F4F5F6','#FFFFFF','#101318','#806040','#FFFF00']){
  const preview=layoutVariables({background});
  assert.ok(colorContrast(background,preview['--preview-text'])>=4.5,'Preview text follows its own background, not inherited dark-mode text');
}
const previewCss=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
for(const selector of ['.brand-theme-preview {','.brand-preview-caption {','.brand-theme-preview>small {']){
  assert.ok(previewCss.slice(previewCss.indexOf(selector)).split('}')[0].includes('color:var(--preview-text)'));
}
assert.equal(normalizeLayout({background:'warm'}).background,'#F7F5F0');
for(const input of [{contentWidth:0},{contentWidth:1600.5},{contentWidth:'1600'},{background:'toString'},{background:'url(evil)'}])assert.throws(()=>validateLayout(input));
for(const input of [{secondaryColor:'red'},{selectionStrength:100},{selectionStrength:7.5}])assert.throws(()=>validateButtonTheme(input));
const page=settingsPageHtml({settings:DEFAULT_SETTINGS,infra:null});
assert.match(page,/id="sAiMistral" type="password"/);
assert.match(page,/id="sAiMistralSave"/);
const mistralPage=settingsPageHtml({settings:{...DEFAULT_SETTINGS,ai:{providerPreference:'mistral'}},infra:{ai:{mistral:{configured:true}}}});
assert.doesNotMatch(mistralPage,/sAiProvider|AI ưu tiên/);
assert.match(mistralPage,/id="sAiMistralHint"[^>]*data-configured="true"[^>]*aria-label="Đã cấu hình"><\/span>/);
for(const provider of ['Groq','Gemini','Grok','Mistral','Cerebras']){
  assert.match(page,new RegExp(`class="nut chinh" id="sAi${provider}Save" aria-label="Cập nhật ${provider}">Cập nhật</button>`));
}
assert.doesNotMatch(page,/id="sRefresh"|id="sSave"|class="tich-hop-tong-quan"/);
assert.match(page,/id="sSaveBottom"/);
assert.match(page,/data-asset-pick="sLogo"/);
assert.match(page,/data-asset-pick="sFavicon"/);
assert.equal((page.match(/type="file" hidden data-image-picker-direct/g)||[]).length,2);
assert.ok(readFileSync(new URL('../src/settings/tabs.js',import.meta.url),'utf8').includes("advanced:['sGoogle','sR2Enabled','sAiGroq']"));
assert.ok(!page.includes('sRestart'));
for(const id of ['sContentWidth','sCardRadius','sBackground'])assert.ok(page.includes(id));
assert.ok(!page.includes('cai-dat-card-rong'));
assert.match(page,/id="sContentWidth" type="number"/);
assert.match(page,/id="sBackground"[^>]*maxlength="7"/);
assert.match(page,/id="sSelectionStrength" type="range"/);
assert.doesNotMatch(page,/data-theme-preset|Than đậm|Xanh dương|Xanh lá/);
const layoutCss=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(layoutCss,/--control-font-size:14px/);
assert.match(layoutCss,/:root \{ --control-font-size:16px; --control-height-sm:44px; --editor-control:44px; \}/,'Touch controls share readable text and touch-target height');
assert.match(layoutCss,/\.goethe-editor \{ --control-height:var\(--editor-control\); \}/,'Builder density controls generic input min-height too');
for(const selector of ['.nut {','.audio-upload {','.section-image-upload {','.goethe-choices label>input:last-child {']){
  const rule=layoutCss.slice(layoutCss.indexOf(selector)).split('}')[0];
  assert.ok(rule.includes('font-size:var(--control-font-size)'),`${selector} must use shared control typography`);
}
assert.match(layoutCss,/\.goethe-editor \.nut:not\(\.chinh\):not\(\.nguy\):not\(\.active\) \{[^}]*border-color:var\(--control-border\)/);
assert.match(layoutCss,/\.exam-instruction img \{[^}]*width:100%; max-width:100%; height:auto; max-height:none;/);
assert.match(layoutCss,/\.question-stimulus img \{[^}]*width:100%; max-width:100%; height:auto; max-height:none;/);
assert.doesNotMatch(layoutCss.match(/\.exam-paper \.cau-thi \{[^}]+\}/)?.[0]||'',/border-bottom:1px/);
assert.doesNotMatch(layoutCss,/\.exam-paper \.exam-instruction img \{ max-height:360px/);
assert.match(layoutCss,/--max:1600px/);
assert.match(layoutCss,/#app \{ width:min\(calc\(var\(--max\) \+ 64px\),100%\)/);
assert.match(layoutCss,/\.noi-dung-thi \{ max-width:var\(--max\)/);
assert.match(layoutCss,/\.thi--preview \{ max-width:var\(--max\)/);
async function test(name,run){await run();passed++;console.log(`✓ ${name}`);}

await test('Mã màu không hợp lệ không bị âm thầm đổi thành màu khác',()=>{
  assert.equal(normalizeThemeColor(' #aAbB09 '),'#AABB09');
  for(const value of ['',null,'red','#123','#12345g','url(example)','--brand: red'])assert.equal(normalizeThemeColor(value),null);
  assert.throws(()=>saveLocalTheme('#nothex'),/Nhập mã màu/);
});

await test('Màu rất sáng, tối và bão hòa đều có chữ đạt tương phản 4.5:1',()=>{
  const channel=[0,51,102,153,204,255];
  for(const red of channel)for(const green of channel)for(const blue of channel){
    const color='#'+[red,green,blue].map(value=>value.toString(16).padStart(2,'0')).join('');
    for(const selectionStrength of [5,7,20,35]){
    const palette=themePalette(color,{selectionStrength,secondaryColor:color});
    assert.equal(palette['--brand-primary'],color.toUpperCase());
    assert.ok(colorContrast(palette['--brand-primary'],palette['--brand-on-primary'])>=4.5,`Nút chính ${color}`);
    assert.ok(colorContrast(palette['--brand-hover'],palette['--brand-on-primary'])>=4.5,`Nút hover ${color}`);
    assert.ok(colorContrast(palette['--brand-soft'],palette['--brand-text'])>=4.5,`Trạng thái chọn ${color}`);
    assert.ok(colorContrast('#FFFFFF',palette['--brand-text'])>=4.5,`Chữ trên nền trắng ${color}`);
    assert.ok(colorContrast(palette['--button-secondary'],palette['--button-secondary-text'])>=4.5);
    assert.ok(colorContrast(palette['--button-secondary-hover'],palette['--button-secondary-text'])>=4.5);
    }
  }
});

await test('Demo áp dụng màu đã lưu trước khi đọc cấu hình; không gửi yêu cầu ghi server',async()=>{
  const storage=new Map([['g2g.theme.public.v1','#175CD3'],['g2g.theme.demo.v1','#FFEE00']]);
  const variables=new Map(),requests=[];
  globalThis.localStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  globalThis.document={documentElement:{style:{setProperty:(key,value)=>variables.set(key,value)}},querySelector:()=>null};
  globalThis.G2G_API_BASE='/api';
  globalThis.G2G_DEMO_BYPASS=true;
  globalThis.fetch=async(url,options)=>{
    requests.push({url,method:options.method});
    return {ok:true,json:async()=>({theme:{primaryColor:'#087A56'}})};
  };
  const initialization=initializeTheme();
  assert.equal(variables.get('--brand-primary'),'#FFEE00');
  await initialization;
  assert.equal(currentTheme().primaryColor,'#FFEE00');
  saveLocalTheme('#6d3df5');
  assert.equal(storage.get('g2g.theme.demo.v1'),'#6D3DF5');
  assert.equal(variables.get('--brand-primary'),'#6D3DF5');
  assert.deepEqual(requests,[{url:'/api/public-settings',method:'GET'}]);
  saveLocalTheme('#175CD3',{contentWidth:1537,background:'#ABCDEf',secondaryColor:'#111827',selectionStrength:25});
  assert.equal(currentTheme().selectionStrength,25);
  assert.equal(currentTheme().secondaryColor,'#111827');
  assert.equal(variables.get('--nen'),'#ABCDEF');
  assert.equal(JSON.parse(storage.get('g2g.theme.demo.v1.layout')).contentWidth,1537);
});

await test('Chế độ thật dùng màu server, không dùng màu riêng của demo',()=>{
  globalThis.G2G_DEMO_BYPASS=false;
  acceptPublicSettings({theme:{primaryColor:'#175CD3'}});
  assert.equal(currentTheme().primaryColor,'#175CD3');
  acceptPublicSettings({theme:{primaryColor:'#175CD3',contentWidth:1400,cardRadius:16,background:'warm'}});
  assert.equal(currentTheme().contentWidth,1400);
  assert.equal(currentTheme().cardRadius,16);
});

await test('Lưu demo báo lỗi khi trình duyệt chặn lưu trữ',()=>{
  globalThis.localStorage={setItem:()=>{throw new Error('Blocked');}};
  assert.throws(()=>saveLocalTheme('#6D3DF5'),/chưa cho phép lưu/);
  assert.equal(currentTheme().primaryColor,'#175CD3');
});

console.log(`\n${passed} kiểm thử giao diện thương hiệu đã đạt.`);

// Personal appearance does not mutate the configured brand or rebuild the page.
const {initializeColorMode,toggleColorMode,colorModeButtonHtml}=await import('../src/settings/color-mode.js');
const {darkThemePalette}=await import('../src/settings/palette.js');
const modeStorage=new Map([['g2g.color-mode.v1','dark']]);
const attributes=new Map();
const toggle={setAttribute:(key,value)=>attributes.set(key,value),innerHTML:''};
globalThis.localStorage={getItem:key=>modeStorage.get(key),setItem:(key,value)=>modeStorage.set(key,value)};
globalThis.document={documentElement:{dataset:{}},querySelectorAll:()=>[toggle]};
assert.equal(initializeColorMode(),'dark');
assert.match(colorModeButtonHtml(),/aria-pressed="true"/);
assert.equal(toggleColorMode(),'light');
assert.equal(attributes.get('aria-label'),'Chuyển sang giao diện tối');
assert.equal(modeStorage.get('g2g.color-mode.v1'),'light');
assert.equal(toggleColorMode(),'dark');
assert.equal(currentTheme().primaryColor,'#175CD3');
globalThis.localStorage={getItem:()=>{throw new Error('Blocked');},setItem:()=>{throw new Error('Blocked');}};
assert.equal(initializeColorMode(),'light');
assert.equal(toggleColorMode(),'dark');
for(const color of ['#000000','#111827','#FFFFFF','#175CD3','#087A56','#FFEE00','#6D3DF5']){
  const palette=darkThemePalette(color);
  assert.ok(colorContrast(palette['--dark-brand-primary'],'#27272E')>=4.5);
  assert.ok(colorContrast(palette['--dark-brand-primary'],palette['--dark-brand-on-primary'])>=4.5);
}
console.log('✓ Chuyển sáng/tối, lưu lựa chọn và tương phản màu tối');

assert.doesNotMatch(colorModeButtonHtml(),/\stitle=/);
assert.match(colorModeButtonHtml(),/data-no-tooltip/);
const savedMotionGlobals={matchMedia:globalThis.matchMedia,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight};
try{
  const classes=new Set(),properties=new Map();let transitions=0,finish;
  globalThis.matchMedia=()=>({matches:false});
  globalThis.innerWidth=390;globalThis.innerHeight=844;
  globalThis.document.documentElement={dataset:{},style:{setProperty:(key,value)=>properties.set(key,value)},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
  globalThis.document.startViewTransition=update=>{
    transitions++;update();
    return {ready:Promise.resolve(),finished:new Promise(resolve=>{finish=resolve;})};
  };
  initializeColorMode();assert.equal(classes.size,0,'Restored theme never animates');
  const origin={getBoundingClientRect:()=>({left:300,top:20,width:44,height:44})};
  toggleColorMode(origin);assert.ok(classes.has('color-mode-revealing'));assert.equal(transitions,1);
  assert.equal(globalThis.document.documentElement.dataset.themeReveal,'contract','Dark contracts the old light snapshot');
  assert.equal(properties.get('--theme-reveal-x'),'322px');assert.equal(properties.get('--theme-reveal-y'),'42px');
  assert.ok(parseFloat(properties.get('--theme-reveal-radius'))>=Math.hypot(322,802),'Wave covers the farthest corner');
  assert.ok(parseFloat(properties.get('--theme-reveal-feather'))>=120,'Broad alpha feather softens the boundary');
  assert.ok(parseFloat(properties.get('--theme-reveal-end'))>parseFloat(properties.get('--theme-reveal-radius')),'Feather clears every viewport corner');
  toggleColorMode(origin);assert.equal(transitions,1,'Rapid clicks do not overlap snapshots');
  finish();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(classes.size,0,'Snapshot styling is removed after finishing');
  assert.equal(globalThis.document.documentElement.dataset.themeReveal,undefined);
  toggleColorMode(origin);assert.equal(globalThis.document.documentElement.dataset.themeReveal,'expand','Light expands from the button');
  finish();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  globalThis.matchMedia=()=>({matches:true});
  toggleColorMode(origin);assert.equal(classes.size,0);assert.equal(transitions,2,'Reduced motion skips snapshots');
  globalThis.matchMedia=()=>({matches:false});
  globalThis.document.startViewTransition=()=>{throw new Error('Unavailable');};
  assert.equal(toggleColorMode(origin),'light');assert.equal(classes.size,0,'API failure still switches and cleans up');
  delete globalThis.document.startViewTransition;
  assert.equal(toggleColorMode(origin),'dark','Unsupported browsers still switch');
}finally{Object.assign(globalThis,savedMotionGlobals);}
console.log('✓ Vòng lan từ nút: phủ hết màn hình, chống chồng hiệu ứng, dọn dẹp, giảm chuyển động và fallback');
