import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeThemeColor,themePalette,colorContrast,initializeTheme,acceptPublicSettings,currentTheme,saveLocalTheme} from '../src/settings/theme.js';

let passed=0;
const layoutCss=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
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
    const palette=themePalette(color);
    assert.equal(palette['--brand-primary'],color.toUpperCase());
    assert.ok(colorContrast(palette['--brand-primary'],palette['--brand-on-primary'])>=4.5,`Nút chính ${color}`);
    assert.ok(colorContrast(palette['--brand-hover'],palette['--brand-on-primary'])>=4.5,`Nút hover ${color}`);
    assert.ok(colorContrast(palette['--brand-soft'],palette['--brand-text'])>=4.5,`Trạng thái chọn ${color}`);
    assert.ok(colorContrast('#FFFFFF',palette['--brand-text'])>=4.5,`Chữ trên nền trắng ${color}`);
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
});

await test('Chế độ thật dùng màu server, không dùng màu riêng của demo',()=>{
  globalThis.G2G_DEMO_BYPASS=false;
  acceptPublicSettings({theme:{primaryColor:'#175CD3'}});
  assert.equal(currentTheme().primaryColor,'#175CD3');
});

await test('Lưu demo báo lỗi khi trình duyệt chặn lưu trữ',()=>{
  globalThis.localStorage={setItem:()=>{throw new Error('Blocked');}};
  assert.throws(()=>saveLocalTheme('#6D3DF5'),/chưa cho phép lưu/);
  assert.equal(currentTheme().primaryColor,'#175CD3');
});

console.log(`\n${passed} kiểm thử giao diện thương hiệu đã đạt.`);
