import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backupPageHtml,backupItemHtml,backupSettingsHtml,backupProgressText,mountBackupPage} from '../src/views/backup-page.js';

const page=backupPageHtml(),settings=backupSettingsHtml();
assert.match(page,/tieu-de-trang backup-heading/);
assert.match(page,/<table class="bang backup-table"/);
assert.match(page,/<tbody data-files><\/tbody>/);
assert.equal((page.match(/<th scope="col">/g)||[]).length,3);
assert.match(page,/role="region" aria-label="Danh sách bản backup" tabindex="0"/);
assert.ok(!page.includes('the backup-panel'));
assert.ok(!page.includes('data-connection'));
const layout=readFileSync(new URL('../src/ui/layout.js',import.meta.url),'utf8');
assert.match(layout,/\['backup','Backup','backup'\]/);
assert.match(page,/<button class="nut chinh" data-now[^>]*>Sao lưu<\/button>/);
assert.ok(!page.includes('<fieldset'));
assert.ok(!page.includes('name="time"'));
assert.ok(!page.includes('<details'));
assert.ok(!page.includes('<progress'));
assert.ok(page.indexOf('data-job')<page.indexOf('data-files'),'Status occupies the first row, exactly where the newest backup will appear');
assert.match(page,/<tbody data-job hidden><tr class="backup-job-row"><td colspan="3">/);
assert.match(page,/<time data-elapsed aria-label="Tổng thời gian" hidden>/);
for(const name of ['enabled','time','intervalDays','dailyCopies','monthlyCopies'])assert.ok(settings.includes(`name="${name}"`));
assert.match(settings,/<fieldset disabled>/);
assert.match(settings,/data-connect disabled/);
assert.match(settings,/data-disconnect[^>]* hidden/);
assert.match(settings,/data-close[^>]*aria-label="Đóng"/);
assert.equal((settings.match(/class="truong"/g)||[]).length,4);
assert.match(settings,/data-cancel/);
assert.equal((settings.match(/class="backup-setting-row"/g)||[]).length,4);
assert.equal(backupProgressText({startedAt:'2026-10-16T00:00:00Z'},Date.parse('2026-10-16T00:01:12Z')),'1:12');
assert.equal(backupProgressText({startedAt:'2026-10-16T00:00:00Z',finishedAt:'2026-10-16T00:01:12Z'},Date.parse('2026-10-16T01:00:00Z')),'1:12');

const item=backupItemHtml({id:'a/b',name:'<img onerror="bad">',size:1048576,createdTime:'2026-10-15T20:00:00Z'});
assert.equal((item.match(/<td[ >]/g)||[]).length,3);
assert.match(item,/16\/10\/26/);
assert.match(item,/03:00/);
assert.match(item,/class="backup-created"/);
assert.match(item,/1\.0 MB/);
assert.match(item,/a%2Fb\/download/);
assert.ok(!item.includes('<img'));
assert.match(item,/&lt;img/);
assert.ok(!backupItemHtml({}).includes('NaN'));
const source=readFileSync(new URL('../src/views/backup-page.js',import.meta.url),'utf8');
assert.match(source,/signature===listSignature/,'Unchanged polling must preserve focused list actions');
assert.match(source,/dialog\.setAttribute\('aria-labelledby','backup-dialog-title'\)/);
assert.match(source,/\[data-close\]'\)\.focus\(\)/);
const css=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
assert.match(css,/\.backup-page \[hidden\],\.backup-dialog \[hidden\]/);
assert.match(css,/\.backup-page \.icon-btn,\.backup-dialog \.icon-btn\{--editor-control:44px\}/);
assert.match(css,/\.backup-table-wrap\{max-width:100%;overflow-x:auto\}/);
assert.ok(!css.includes('.backup-item'));
console.log('Backup UI: compact layout, popup, real status, escaping and accessibility passed');

// Exercise async status updates without opening a browser or making API requests.
const originals={document:globalThis.document,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
function node(){return {hidden:false,disabled:false,dataset:{},textContent:'',innerHTML:'',children:[],replacements:0,
 setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},
 replaceChildren(){this.children=[];this.replacements++;},append(child){this.children.push(child);},
 querySelector(selector){this.nodes??=new Map();if(!this.nodes.has(selector))this.nodes.set(selector,node());return this.nodes.get(selector);}};}
const root={...node(),isConnected:true};let nextPoll;
let live={drive:{connected:true,email:'private@example.com'},enabled:true,status:{state:'idle'}};
const files=[{id:'one',name:'g2g-test.tar.gz',size:100,createdTime:'2026-10-15T20:00:00Z'}];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
try{
 globalThis.document={hidden:false,createElement:tag=>({...node(),tagName:tag})};
 globalThis.setTimeout=fn=>{nextPoll=fn;return 1;};
 globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
 globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('getBackupStatus')?live:{files}});
 mountBackupPage(root);await settle();
 const el=selector=>root.querySelector(selector),body=el('[data-files]');
 assert.equal(el('[data-now]').disabled,false);
 assert.equal(el('[data-job]').hidden,true);
 const first=body.children[0],replacements=body.replacements;
 assert.equal(first.tagName,'tr');
 await nextPoll();assert.equal(body.children[0],first);assert.equal(body.replacements,replacements);
 live={...live,status:{state:'running',kind:'backup',startedAt:'2026-10-15T20:01:00Z',phase:'upload',message:'Đang tải lên Drive…'}};
 await nextPoll();
 assert.equal(el('[data-job]').hidden,false);assert.equal(el('[data-now]').disabled,true);
 assert.equal(el('[data-status]').textContent,'Đang tải lên Drive…');
 assert.match(el('[data-elapsed]').textContent,/^\d+:\d{2}$/);
 assert.equal(body.children[0].querySelector('[data-restore]').disabled,true);
 assert.equal(body.children[0].querySelector('[data-delete]').disabled,true);
 live={...live,status:{...live.status,state:'failed',message:'Không thể kết nối Drive.'}};
 await nextPoll();
 assert.equal(el('[data-job]').dataset.state,'failed');
 assert.equal(el('[data-status]').textContent,'Không thể kết nối Drive.');
 live={...live,status:{...live.status,state:'running'}};
 files.unshift({id:'two',name:'g2g-new.tar.gz',size:200,createdTime:'2026-10-15T20:02:00Z'});
 await nextPoll();
 assert.equal(body.children.length,1,'An uploaded archive stays out of the table until verification succeeds');
 live={...live,status:{...live.status,state:'success',fileId:'two',finishedAt:'2026-10-15T20:03:00Z',message:'Backup đã lên Drive và phục hồi thử thành công.'}};
 await nextPoll();
 assert.equal(el('[data-job]').hidden,true);
 assert.equal(el('[data-status]').textContent,'');
 assert.equal(body.children.length,2);
 assert.match(body.children[0].innerHTML,/g2g-new/);
 assert.equal(body.children[0].className,'backup-row-enter','The completed backup replaces the status at the top');
 const completedRow=body.children[0];await nextPoll();assert.equal(body.children[0],completedRow,'Completion animation must not replay on unchanged polls');
 live={...live,drive:{connected:false}};
 await nextPoll();
 assert.match(body.innerHTML,/<tr><td colspan="3">/);
 assert.equal(el('[data-now]').disabled,true);
 globalThis.document.hidden=true;const before=body.replacements;
 await nextPoll();assert.equal(body.replacements,before);
 console.log('Backup UI: in-table status, elapsed clock, verified newest-first transition and stable polling passed');
}finally{Object.assign(globalThis,originals);}
