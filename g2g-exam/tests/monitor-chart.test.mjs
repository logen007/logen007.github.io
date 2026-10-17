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
assert.match(html,/<svg[^>]*preserveAspectRatio="none"/,'Flexible CPU charts fill the viewport width without letterboxing');
assert.match(html,/M[\d.,]+ L[\d.,]+ M/,'Missing samples break the line');
assert.match(html,/0%/);
assert.match(html,/100%/);
assert.match(html,/monitor-area/);
assert.match(html,/Cao nhất/);
assert.match(html,/Trung bình/);
assert.match(html,/Hiện tại/);
const statistics=monitorChart('CPU','cpu',[{...range,stats:{maximum:100,average:37.5}}],'50%',n=>n+'%');
assert.match(statistics,/37.5%/);
assert.match(statistics,/<dl class="monitor-summary" aria-label="Thống kê CPU">/);
assert.match(statistics,/<dt>Cao nhất<\/dt><dd>100%<\/dd>/);
assert.match(statistics,/<dt>Hiện tại<\/dt><dd>50%<\/dd>/);
assert.doesNotMatch(statistics,/monitor-summary-wrap|<th>Chỉ số/,'CPU statistics do not need a horizontally scrolling table');
const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(styles,/\.monitor-summary \{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.doesNotMatch(styles,/\.monitor-summary[^}]*min-width:320px/);
assert.match(styles,/\.dashboard-ai-metrics--compact \{[^}]*repeat\(2,minmax\(0,1fr\)\)/,'Only two count cards remain');
assert.match(styles,/\.dashboard-ai-queue>\.dashboard-section-heading>\.dashboard-ai-providers \{[^}]*flex-wrap:nowrap/,'Providers share one horizontal header row');
assert.equal((html.match(/class="monitor-area" d="[^"]*Z/g)||[]).length,1,'Area exists only on contiguous samples');
assert.doesNotMatch(html,/NaN|Infinity/);
assert.match(monitorChart('R2','r2',[range],'2 KB',String),/monitor-error/);
assert.match(monitorChart('CPU','cpu',[],'—',String),/Đang thu thập dữ liệu/);
assert.doesNotMatch(monitorChart('CPU','cpu',[],'—',String),/<path/,'No invented history');
assert.match(monitorChart('<script>','cpu',[range],'x',String),/&lt;script&gt;/);
assert.equal((monitorRangePicker().match(/type="radio"/g)||[]).length,5);
console.log('Monitor ranges, real timestamps, gaps, errors and empty states passed.');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const collector=read('server/src/monitor-history.js');
assert.match(collector,/if\(busy\|\|stopped\)return/);
assert.match(collector,/setInterval\(collect,60000\)/);
assert.match(collector,/interval '366 days'/);
assert.doesNotMatch(collector,/getInfrastructureStatus|directoryBytes/,'Sampling must not scan files or exam content');
assert.match(read('server/schema.sql'),/CREATE TABLE IF NOT EXISTS monitor_samples/);
assert.match(read('server/src/actions/settings.js'),/user.role!=='master'[\s\S]*await Promise.all\(\[\s*sampleCpu\(\),\s*monitorHistory\(\)/);
