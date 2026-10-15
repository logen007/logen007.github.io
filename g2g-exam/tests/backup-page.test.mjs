import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backupPageHtml,backupItemHtml,backupSettingsHtml,backupStatusDetailsHtml,backupProgressText,backupStepsHtml,mountBackupPage} from '../src/views/backup-page.js';

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
assert.match(page,/class="nut chinh icon-btn"[^>]*aria-label="Backup ngay"/);
assert.ok(!page.includes('<fieldset'));
assert.ok(!page.includes('name="time"'));
assert.match(page,/<details data-details hidden>/);
assert.match(page,/<progress data-progress aria-label="Backup đang xử lý" hidden>/);
assert.ok(!page.match(/<progress[^>]*value=/),'Do not invent completion percentages');
for(const name of ['enabled','time','intervalDays','dailyCopies','monthlyCopies'])assert.ok(settings.includes(`name="${name}"`));
assert.match(settings,/<fieldset disabled>/);
assert.match(settings,/data-connect disabled/);
assert.match(settings,/data-disconnect[^>]* hidden/);
assert.match(settings,/data-close[^>]*aria-label="Đóng"/);
assert.equal((settings.match(/class="truong"/g)||[]).length,4);
assert.match(settings,/data-cancel/);
assert.equal((settings.match(/class="backup-setting-row"/g)||[]).length,4);
assert.match(backupProgressText({startedAt:'2026-10-16T00:00:00Z',phaseStartedAt:'2026-10-16T00:01:00Z',stepCount:10,completedSteps:2},Date.parse('2026-10-16T00:01:12Z')),/2\/10 bước hoàn tất · Tổng 1:12 · Bước này 0:12/);
assert.match(backupStepsHtml({steps:[{id:'upload',label:'Tải lên'}],phase:'upload',state:'failed'}),/Lỗi/);

const item=backupItemHtml({id:'a/b',name:'<img onerror="bad">',size:1048576,createdTime:'2026-10-15T20:00:00Z'});
assert.equal((item.match(/<td[ >]/g)||[]).length,3);
assert.match(item,/16\/10\/26/);
assert.match(item,/03:00/);
assert.match(item,/1\.0 MB/);
assert.match(item,/a%2Fb\/download/);
assert.ok(!item.includes('<img'));
assert.match(item,/&lt;img/);
assert.ok(!backupItemHtml({}).includes('NaN'));
const details=backupStatusDetailsHtml({kind:'restore',message:'<script>',startedAt:'2026-10-15T20:00:00Z',tables:32,sha256:'abc'});
assert.match(details,/Phục hồi thử/);
assert.match(details,/&lt;script&gt;/);
assert.match(details,/Bảng đã phục hồi/);
assert.ok(!details.includes('Kết thúc'));
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
 assert.equal(el('[data-progress]').hidden,true);
 assert.equal(el('[data-job]').hidden,true);
 const first=body.children[0],replacements=body.replacements;
 assert.equal(first.tagName,'tr');
 await nextPoll();assert.equal(body.children[0],first);assert.equal(body.replacements,replacements);
 live={...live,status:{state:'running',kind:'backup',startedAt:'2026-10-15T20:00:00Z',phase:'upload',step:6,stepCount:10,completedSteps:5,steps:[...['prepare','database','uploads','inventory','compress'].map(id=>({id,label:id})),{id:'upload',label:'Tải lên Drive'}],message:'Đang tải lên Drive…'}};
 await nextPoll();
 assert.equal(el('[data-progress]').hidden,false);assert.equal(el('[data-now]').disabled,true);
 assert.equal(el('[data-progress]').value,5);assert.equal(el('[data-progress]').max,10);
 assert.match(el('[data-progress-meta]').textContent,/5\/10 bước hoàn tất/);
 assert.match(el('[data-steps]').innerHTML,/Đang chạy/);
 assert.equal(body.children[0].querySelector('[data-restore]').disabled,true);
 assert.equal(body.children[0].querySelector('[data-delete]').disabled,true);
 el('[data-details]').open=true;
 live={...live,status:{...live.status,state:'failed',message:'Không thể kết nối Drive.'}};
 await nextPoll();
 assert.equal(el('[data-progress]').hidden,true);
 assert.equal(el('[data-progress-meta]').hidden,true);
 assert.equal(el('[data-job]').dataset.state,'failed');
 assert.equal(el('[data-status]').textContent,'Không thể kết nối Drive.');
 assert.equal(el('[data-details]').open,true);
 live={...live,status:{state:'success',startedAt:'2026-10-15T20:00:00Z',message:'Backup đã lên Drive và phục hồi thử thành công.',tables:32}};
 await nextPoll();
 assert.equal(el('[data-status]').hidden,true);
 assert.equal(el('[data-status]').textContent,'');
 assert.ok(!el('[data-job-details]').innerHTML.includes('Backup đã lên Drive'));
 assert.equal(el('[data-details]').hidden,false);
 live={...live,drive:{connected:false}};
 await nextPoll();
 assert.match(body.innerHTML,/<tr><td colspan="3">/);
 assert.equal(el('[data-now]').disabled,true);
 globalThis.document.hidden=true;const before=body.replacements;
 await nextPoll();assert.equal(body.replacements,before);
 console.log('Backup UI: polling preserves nodes and disclosure, real running/failure states and action locks passed');
}finally{Object.assign(globalThis,originals);}
