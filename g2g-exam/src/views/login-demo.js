import {iconHtml} from '../ui/icons.js';

// Decorative language-practice scenes, not an official paper or scored attempt.
const scenes=[
  ['choice','Chọn đáp án','Wann beginnt der Deutschkurs?',`<div class="landing-demo-answer"><span>A</span><span>Um acht Uhr</span></div><div class="landing-demo-answer landing-demo-answer--chosen"><span>B</span><span>Um neun Uhr</span>${iconHtml('example')}</div><div class="landing-demo-answer"><span>C</span><span>Um zehn Uhr</span></div>`],
  ['binary','Đúng / Sai','Am Sonntag ist das Café geöffnet.',`<p class="landing-demo-excerpt">Das Café ist sonntags geschlossen.</p><div class="landing-demo-binary"><span>Richtig</span><span class="landing-demo-answer--chosen">${iconHtml('example')} Falsch</span></div>`],
  ['gap','Điền từ','Ergänzen Sie den Satz.',`<p class="landing-demo-sentence">Ich <b>lerne</b> jeden Tag Deutsch.</p><div class="landing-demo-words"><span class="landing-demo-answer--chosen">lerne</span><span>lernen</span><span>lernst</span></div>`],
  ['match','Ghép cặp','Was passt zusammen?',`<div class="landing-demo-pairs"><span>ein Buch</span><span>lesen</span><span>Kaffee</span><span>trinken</span><span>Musik</span><span>hören</span></div>`],
  ['order','Sắp xếp câu','Bringen Sie die Wörter in die richtige Reihenfolge.',`<div class="landing-demo-words"><span>heute</span><span>ich</span><span>Deutsch</span><span>lerne</span></div><p class="landing-demo-sentence">Ich lerne heute Deutsch.</p>`],
  ['writing','Viết','Schreiben Sie eine kurze Nachricht.',`<div class="landing-demo-letter"><span>Hallo Anna,</span><span>ich komme am Samstag.</span><span>Liebe Grüße<br>Mai</span></div>`],
];

export function loginDemoHtml(){
  const delay=index=>`style="--scene-delay:${index*6-36.8}s"`;
  return `<div class="landing-demo-body"><div class="landing-demo-nav"><span>Luyện tập</span><div>${scenes.map((_,i)=>`<span data-scene-step="${i+1}" ${delay(i)}${i===0?' class="current"':''}>${i+1}</span>`).join('')}</div></div><div class="landing-demo-slides">${scenes.map(([kind,label,title,body],i)=>`<div class="landing-demo-question landing-demo-question--${kind}" data-scene="${i+1}" ${delay(i)}><div class="landing-demo-content"><div class="landing-demo-meta"><span class="landing-demo-eyebrow">Câu ${i+1}</span><span>${label}</span></div><h2 lang="de">${title}</h2><div lang="de">${body}</div></div><div class="landing-demo-progress"><div><span>Tiến trình làm bài</span><span>${i+1} / 6</span></div><div class="landing-demo-track"><span style="width:${(i+1)/6*100}%"></span></div></div></div>`).join('')}</div></div>`;
}
