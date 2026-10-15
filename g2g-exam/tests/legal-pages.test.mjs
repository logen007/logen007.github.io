import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
for(const file of ['privacy.html','terms.html']){
  const html=read(file);
  for(const required of ['lang="vi"','name="viewport"','<h1>','admin@g2gcareer.com','/privacy.html','/terms.html'])assert.ok(html.includes(required),file+': '+required);
  assert.ok(!html.includes('<script'), 'Public policies must not require JavaScript or authentication');
  assert.ok(read('server/Dockerfile').includes('COPY privacy.html terms.html legal.css /app/public/'));
  assert.ok(read('scripts/build-web.mjs').includes("'privacy.html','terms.html','legal.css'"));
  assert.ok(read('src/views/student.js').includes('href="/'+file+'"'));
}
for(const required of ['openid','email','profile','drive.file','Limited Use','SHA-256','thu hồi','AI','7 bản'])assert.ok(read('privacy.html').includes(required),required);
console.log('Public legal pages: content, public packaging and homepage links passed.');
