import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monitorChart,monitorRangePicker} from '../src/views/monitor-chart.js';
const start=Date.parse('2026-10-13T00:00:00Z');
const range={hours:1,bucketSeconds:60,start,end:start+3600000,points:[
  {at:new Date(start+60000).toISOString(),cpu:0,r2:1024,error:false},
  {at:new Date(start+120000).toISOString(),cpu:100,r2:2048,error:true},
  {at:new Date(start+600000).toISOString(),cpu:50,r2:2048,error:false}
]};
const html=monitorChart('CPU','cpu',[range],'50%',n=>n+'%');
assert.match(html,/M[\d.,]+ L[\d.,]+ M/,'Missing samples break the line');
assert.match(html,/0%/);
assert.match(html,/100%/);
assert.doesNotMatch(html,/NaN|Infinity/);
assert.match(monitorChart('R2','r2',[range],'2 KB',String),/monitor-error/);
assert.match(monitorChart('CPU','cpu',[],'—',String),/Đang thu thập dữ liệu/);
assert.doesNotMatch(monitorChart('CPU','cpu',[],'—',String),/<path/,'No invented history');
assert.match(monitorChart('<script>','cpu',[range],'x',String),/&lt;script&gt;/);
assert.equal((monitorRangePicker().match(/type="radio"/g)||[]).length,3);
console.log('Monitor ranges, real timestamps, gaps, errors and empty states passed.');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const collector=read('server/src/monitor-history.js');
assert.match(collector,/if\(busy\|\|stopped\)return/);
assert.match(collector,/setInterval\(collect,60000\)/);
assert.match(collector,/interval '8 days'/);
assert.doesNotMatch(collector,/getInfrastructureStatus|directoryBytes/,'Sampling must not scan files or exam content');
assert.match(read('server/schema.sql'),/CREATE TABLE IF NOT EXISTS monitor_samples/);
assert.match(read('server/src/actions/settings.js'),/user.role!=='master'[\s\S]*history:await monitorHistory/);
