import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backupPageHtml,backupItemHtml,backupSettingsHtml,backupProgressText,mountBackupPage} from '../src/views/backup-page.js';
import {clearBackupData} from '../src/settings/backup-data.js';

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
assert.match(page,/<progress data-progress aria-label="Tiến trình sao lưu" hidden>/);
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
assert.match(item,/Thứ Sáu/);
assert.match(item,/16\/10\/2026/);
assert.match(item,/03:00/);
assert.match(item,/class="backup-created"/);
assert.match(item,/1\.0 MB/);
assert.match(item,/a%2Fb\/download/);
assert.match(item,/class="backup-created"><a class="backup-download"/);
assert.equal((item.match(/class="icon-btn"/g)||[]).length,2);
assert.ok(!item.includes('<img'));
assert.match(item,/&lt;img/);
assert.ok(!backupItemHtml({}).includes('NaN'));
const requestedDate=backupItemHtml({createdTime:'2026-10-16T12:54:00Z'});
assert.match(requestedDate,/<span>Thứ Sáu<\/span><span>16\/10\/2026<\/span><span class="backup-time">19:54<\/span>/);
assert.match(backupItemHtml({createdTime:'2026-10-17T17:00:00Z'}),/<span>Chủ Nhật<\/span><span>18\/10\/2026<\/span><span class="backup-time">00:00<\/span>/);
assert.ok(!backupItemHtml({createdTime:'invalid'}).includes('Invalid Date'));
assert.match(backupItemHtml({appProperties:{appVersion:'1.3.163'}}),/<small class="backup-version">v1\.3\.163<\/small>/);
assert.ok(!backupItemHtml({}).includes('backup-version'),'Legacy backups must not claim the current application version');
assert.ok(!backupItemHtml({appProperties:{appVersion:'<img>'}}).includes('<img>'));
const source=readFileSync(new URL('../src/views/backup-page.js',import.meta.url),'utf8');
assert.match(source,/signature===listSignature/,'Unchanged polling must preserve focused list actions');
assert.match(source,/dialog\.setAttribute\('aria-labelledby','backup-dialog-title'\)/);
assert.match(source,/\[data-close\]'\)\.focus\(\)/);
const css=readFileSync(new URL('../enhancements.css',import.meta.url),'utf8');
assert.match(css,/\.backup-table \.backup-job-row:last-child>td\{padding:0;border-bottom:1px solid var\(--vien\)\}/,'Job is the last row of its own tbody: its divider must outrank .bang tr:last-child td');
assert.match(css,/\.backup-download:hover\{color:var\(--brand-text\);text-decoration:none\}/);
const driveSource=readFileSync(new URL('../server/src/backup-google.js',import.meta.url),'utf8');
assert.match(driveSource,/appProperties:\{appVersion:APP_VERSION\}/);
assert.match(driveSource,/files\(id,name,size,createdTime,mimeType,description,appProperties\)/);
assert.match(css,/\.backup-page \[hidden\],\.backup-dialog \[hidden\]/);
assert.match(css,/\.backup-page \.icon-btn,\.backup-dialog \.icon-btn\{--editor-control:44px\}/);
assert.match(css,/\.backup-table-wrap\{max-width:100%;overflow-x:auto\}/);
assert.match(css,/\.backup-created time\{display:inline-flex;flex-wrap:nowrap;align-items:baseline;gap:8px;font-weight:600;white-space:nowrap\}/);
assert.ok(!/\.backup-created time\{[^}]*display:grid/.test(css),'Mobile date and time remain on one line');
assert.ok(!css.includes('.backup-item'));
console.log('Backup UI: compact layout, popup, real status, escaping and accessibility passed');

// Exercise async status updates without opening a browser or making API requests.
const originals={document:globalThis.document,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
const originalNow=Date.now;let time=Date.now();
function node(){return {hidden:false,disabled:false,dataset:{},textContent:'',innerHTML:'',children:[],replacements:0,
 setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},
 replaceChildren(){this.children=[];this.replacements++;},append(child){this.children.push(child);},
 insertBefore(child,before){if(child.parent){const index=child.parent.children.indexOf(child);child.parent.children.splice(index,1);}const at=before?this.children.indexOf(before):this.children.length;this.children.splice(at,0,child);child.parent=this;},
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}},
 querySelector(selector){this.nodes??=new Map();if(!this.nodes.has(selector))this.nodes.set(selector,node());return this.nodes.get(selector);}};}
const root={...node(),isConnected:true};let nextPoll;
let live={drive:{connected:true,email:'private@example.com'},enabled:true,status:{state:'idle'}};
const files=[{id:'one',name:'g2g-test.tar.gz',size:100,createdTime:'2026-10-15T20:00:00Z'}];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const poll=async(ms=60001)=>{time+=ms;await nextPoll();};
try{
 clearBackupData();Date.now=()=>time;
 globalThis.document={hidden:false,createElement:tag=>({...node(),tagName:tag}),addEventListener(){},removeEventListener(){}};
 globalThis.setTimeout=fn=>{nextPoll=fn;return 1;};
 globalThis.clearTimeout=()=>{};
 globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
 let requests=0;globalThis.fetch=async url=>{requests++;return {ok:true,json:async()=>structuredClone(url.endsWith('getBackupStatus')?live:{files})};};
 mountBackupPage(root);await settle();
 const el=selector=>root.querySelector(selector),body=el('[data-files]');
 assert.equal(el('[data-now]').disabled,false);
 assert.equal(el('[data-job]').hidden,true);
 const first=body.children[0],replacements=body.replacements;
 assert.equal(first.tagName,'tr');
 await poll();assert.equal(body.children[0],first);assert.equal(body.replacements,replacements);
 const warm={...node(),isConnected:true},beforeWarm=requests,originalPoll=nextPoll;
 mountBackupPage(warm);assert.equal(warm.querySelector('[data-files]').children.length,1,'Warm navigation paints the cached rows synchronously');await settle();assert.equal(requests,beforeWarm,'Warm navigation makes no duplicate requests');warm.isConnected=false;
 // Return polling control to the still-connected page.
 nextPoll=originalPoll;await poll();
 live={...live,status:{state:'running',kind:'backup',startedAt:'2026-10-15T20:01:00Z',phase:'upload',stepCount:10,completedSteps:5,message:'Đang tải lên Drive…'}};
 await poll();
 assert.equal(el('[data-job]').hidden,false);assert.equal(el('[data-now]').disabled,true);
 assert.equal(el('[data-status]').textContent,'Đang tải lên Drive…');
 assert.equal(el('[data-progress]').hidden,false);assert.equal(el('[data-progress]').value,5);assert.equal(el('[data-progress]').max,10);
 assert.match(el('[data-elapsed]').textContent,/^\d+:\d{2}$/);
 assert.equal(body.children[0].querySelector('[data-restore]').disabled,true);
 assert.equal(body.children[0].querySelector('[data-delete]').disabled,true);
 live={...live,status:{...live.status,state:'failed',message:'Không thể kết nối Drive.'}};
 await poll(3001);
 assert.equal(el('[data-job]').dataset.state,'failed');
 assert.equal(el('[data-status]').textContent,'Không thể kết nối Drive.');
 live={...live,status:{...live.status,state:'running'}};
 files.unshift({id:'two',name:'g2g-new.tar.gz',size:200,createdTime:'2026-10-15T20:02:00Z'});
 await poll();
 assert.equal(body.children.length,1,'An uploaded archive stays out of the table until verification succeeds');
 live={...live,status:{...live.status,state:'success',fileId:'two',finishedAt:'2026-10-15T20:03:00Z',message:'Backup đã lên Drive và phục hồi thử thành công.'}};
 await poll(3001);
 assert.equal(el('[data-job]').hidden,true);
 assert.equal(el('[data-status]').textContent,'');
 assert.equal(body.children.length,2);
 assert.match(body.children[0].innerHTML,/g2g-new/);
 assert.equal(body.children[0].className,'backup-row-enter','The completed backup replaces the status at the top');
 const completedRow=body.children[0];await poll();assert.equal(body.children[0],completedRow,'Completion animation must not replay on unchanged polls');
 live={...live,drive:{connected:false}};
 await poll();
 assert.match(body.innerHTML,/<tr><td colspan="3">/);
 assert.equal(el('[data-now]').disabled,true);
 globalThis.document.hidden=true;const before=body.replacements;
 const beforeHidden=requests;await poll();assert.equal(body.replacements,before);assert.equal(requests,beforeHidden);
 console.log('Backup UI: in-table status, elapsed clock, verified newest-first transition and stable polling passed');
}finally{Object.assign(globalThis,originals);Date.now=originalNow;clearBackupData();}
