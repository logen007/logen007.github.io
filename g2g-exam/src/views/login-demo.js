import {iconHtml} from '../ui/icons.js';

// Decorative language-practice scenes, not an official paper or scored attempt.
const scenes=[
  ['choice','Chọn đáp án','Wann beginnt der Kurs?',`<div class="landing-demo-answer"><span>A</span><span>Um acht Uhr</span></div><div class="landing-demo-answer landing-demo-answer--chosen"><span>B</span><span>Um neun Uhr</span>${iconHtml('example')}</div><div class="landing-demo-answer"><span>C</span><span>Um zehn Uhr</span></div>`],
  ['binary','Đúng / Sai','Das Café ist sonntags offen.',`<p class="landing-demo-excerpt">Am Sonntag bleibt das Café geschlossen.</p><div class="landing-demo-binary"><span>Richtig</span><span class="landing-demo-answer--chosen">${iconHtml('example')} Falsch</span></div>`],
  ['gap','Điền từ','Ergänzen Sie den Satz.',`<p class="landing-demo-sentence">Ich <b>lerne</b> jeden Tag Deutsch.</p><div class="landing-demo-words"><span class="landing-demo-answer--chosen">lerne</span><span>lernen</span><span>lernst</span></div>`],
  ['match','Ghép cặp','Was passt zusammen?',`<div class="landing-demo-pairs"><span>ein Buch</span><span>lesen</span><span>Kaffee</span><span>trinken</span><span>Musik</span><span>hören</span></div>`],
  ['order','Sắp xếp câu','Ordnen Sie den Satz.',`<div class="landing-demo-words landing-demo-order"><span class="landing-demo-order-token" style="--word-shift:2">heute</span><span class="landing-demo-order-token" style="--word-shift:-1">ich</span><span class="landing-demo-order-token" style="--word-shift:1">Deutsch</span><span class="landing-demo-order-token" style="--word-shift:-2">lerne</span></div><p class="landing-demo-sentence">Ich lerne heute Deutsch.</p>`],
  ['writing','Viết','Eine Nachricht an Anna.',`<div class="landing-demo-letter"><span style="--line-index:0">Hallo Anna,</span><span style="--line-index:1">ich komme am Samstag.</span><span style="--line-index:2">Liebe Grüße von Mai</span></div>`],
];

export function loginDemoHtml(){
  const delay=index=>`style="--scene-delay:${index*6-36.8}s"`;
  return `<div class="landing-demo-slides">${scenes.map(([kind,label,title,body],i)=>`<div class="landing-demo-question landing-demo-question--${kind}" data-scene="${i+1}" ${delay(i)}><div class="landing-demo-content"><div class="landing-demo-meta"><span class="landing-demo-type">${label}</span><span class="landing-demo-eyebrow">Câu ${i+1} / 6</span></div><h2 lang="de">${title}</h2><div lang="de">${body}</div></div></div>`).join('')}</div><div class="landing-demo-nav"><div>${scenes.map((_,i)=>`<span data-scene-step="${i+1}" ${delay(i)}${i===0?' class="current"':''}>${i+1}</span>`).join('')}</div></div>`;
}
