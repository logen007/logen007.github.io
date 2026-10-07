import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const p=rel=>path.join(root,rel);
const read=rel=>fs.readFileSync(p(rel),'utf8');
const write=(rel,content)=>{fs.mkdirSync(path.dirname(p(rel)),{recursive:true});fs.writeFileSync(p(rel),content);};
const replaceOnce=(source,from,to,label)=>{
  if(!source.includes(from))throw new Error(`Không tìm thấy đoạn cần thay: ${label}`);
  return source.replace(from,to);
};

const defaultBuilder=`import {byId} from '../../core.js';
import {esc} from '../../ui/format.js';
import {uploadQuestionAudio} from '../../media.js';

const icons={
  add:'<img src="src/assets/figma-icon-3.svg" alt="">',
  remove:'<img src="src/assets/figma-icon-2.svg" alt="">',
  upload:'<img src="src/assets/figma-icon-5.svg" alt="">',
  play:'<img src="src/assets/figma-icon-4.svg" alt="">',
  imageUpload:'<img src="src/assets/figma-icon-image-upload.svg" alt="">'
};
const blank=value=>value==='Nháp'?'':value;
const audioName=q=>{
  if(q.audioName)return q.audioName;
  if(String(q.audioUrl||'').startsWith('data:'))return 'Audio đã tải lên';
  return decodeURIComponent(String(q.audioUrl||'').split('/').pop().split('?')[0]||'Audio đã tải lên');
};

function questionHtml(q,index,{defaultScore,readOnly}){
  const choices=[...(q.choices||[]),'','',''].slice(0,3);
  const audio=\`<div class="audio-upload \${q.audioUrl?'has-audio':''}"><label class="audio-file-select" title="\${q.audioUrl?'Thay audio':'Tải audio'}"><span>\${q.audioUrl?esc(audioName(q)):'Upload audio'}</span><input type="file" data-field="audio" accept="audio/*" \${readOnly?'disabled':''}></label>\${q.audioUrl?\`<button type="button" class="audio-preview" data-action="preview-inline-audio" title="Nghe thử audio" aria-label="Nghe thử audio">\${icons.play}</button><audio class="inline-audio-preview" preload="metadata" src="\${esc(q.audioUrl)}"></audio>\`:icons.upload}</div>\`;
  return \`<article class="goethe-question part-question" data-question-id="\${q.id}"><div class="goethe-question-row"><textarea data-field="title" placeholder="Câu hỏi \${index+1}" \${readOnly?'disabled':''}>\${esc(blank(q.title))}</textarea><div class="goethe-score"><label><input data-field="maxScore" type="number" min="0" value="\${Number(q.maxScore??defaultScore)}" \${readOnly?'disabled':''}><span>điểm</span></label><div class="goethe-question-actions"><button type="button" class="icon-btn" data-action="remove-inline-question" data-id="\${q.id}" title="Xóa câu" aria-label="Xóa câu" \${readOnly?'disabled':''}>\${icons.remove}</button><button type="button" class="icon-btn" data-action="add-inline-question" data-after="\${q.id}" title="Thêm câu" aria-label="Thêm câu" \${readOnly?'disabled':''}>\${icons.add}</button></div>\${audio}</div></div><div class="goethe-answer-row"><div class="goethe-choices">\${['A','B','C'].map((letter,choiceIndex)=>{const choice=choices[choiceIndex],imageUrl=typeof choice==='object'?choice.imageUrl:'',hasImage=Boolean(imageUrl);return \`<label><input data-field="correct" type="radio" name="answer-\${q.id}" value="\${choiceIndex}" \${Number(q.correctAnswer)===choiceIndex?'checked':''} \${readOnly?'disabled':''}><b>\${letter}</b><span class="choice-image-upload \${hasImage?'has-image':''}" title="\${hasImage?'Bấm để thay hình ảnh đáp án':'Tải hình ảnh đáp án'}">\${hasImage?\`<img class="choice-uploaded-image" src="\${esc(imageUrl)}" alt="Ảnh đáp án \${letter}">\`:icons.imageUpload}\${hasImage?\`<span class="choice-image-tooltip"><img src="\${esc(imageUrl)}" alt="Ảnh đáp án \${letter}"></span>\`:''}<input type="file" data-choice-image="\${choiceIndex}" accept="image/*" \${readOnly?'disabled':''}></span><input data-choice="\${choiceIndex}" placeholder="Nhập đáp án" value="\${esc(blank(typeof choice==='object'?choice.text:choice))}" \${readOnly?'disabled':''}></label>\`;}).join('')}</div></div></article>\`;
}

export function renderBuilder({data,exam,section,readOnly=false}={}){
  if(!section)return '<div class="rong">Chọn một phần để cấu hình.</div>';
  const defaultScore=Number(exam.settings?.skillSettings?.[section.skill]?.defaultQuestionScore??exam.settings?.defaultQuestionScore??1);
  const questions=(section.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean);
  return \`<div class="part-editor" data-template-type="\${esc(section.templateType||'GENERIC')}"><div class="goethe-instruction"><textarea id="sectionInstruction" placeholder="Đề bài" \${readOnly?'disabled':''}>\${esc(section.instruction||'')}</textarea>\${readOnly?'':\`<button class="nut nho" type="button" data-action="add-inline-question">+ Thêm câu</button>\`}</div><div class="goethe-questions">\${questions.map((q,index)=>questionHtml(q,index,{defaultScore,readOnly})).join('')||'<div class="rong">Chưa có câu hỏi trong bài này.</div>'}</div></div>\`;
}

export function bindBuilder({root=document,data,exam,section,pendingAudioUploads=new Map(),notify=()=>{}}={}){
  if(!section)return;
  const resetAudioPreview=button=>{
    button.innerHTML=icons.play;
    button.title='Nghe thử audio';
    button.setAttribute('aria-label','Nghe thử audio');
  };
  const bindInlineAudioPreview=button=>button.onclick=async()=>{
    const control=button.closest('.audio-upload'),audio=control?.querySelector('.inline-audio-preview');
    if(!audio)return;
    if(!audio.paused){audio.pause();audio.currentTime=0;resetAudioPreview(button);return;}
    root.querySelectorAll('.inline-audio-preview').forEach(item=>{
      if(item===audio)return;
      item.pause();item.currentTime=0;
      const other=item.closest('.audio-upload')?.querySelector('.audio-preview');if(other)resetAudioPreview(other);
    });
    try{
      if(audio.ended)audio.currentTime=0;
      await audio.play();
      button.innerHTML='<span class="audio-stop-icon" aria-hidden="true"></span>';
      button.title='Dừng audio';button.setAttribute('aria-label','Dừng audio');
      audio.onended=()=>resetAudioPreview(button);
      audio.onpause=()=>{if(!audio.ended)resetAudioPreview(button);};
    }catch{notify('Không thể phát audio này. Hãy thử chọn lại tệp.');}
  };
  const showUploadedAudio=(control,{url,name})=>{
    control.classList.add('has-audio');
    const label=control.querySelector('.audio-file-select span');if(label)label.textContent=name;
    control.querySelector(':scope > img')?.remove();
    let audio=control.querySelector('.inline-audio-preview');
    if(!audio){audio=document.createElement('audio');audio.className='inline-audio-preview';audio.preload='metadata';control.append(audio);}
    audio.src=url;
    let button=control.querySelector('.audio-preview');
    if(!button){button=document.createElement('button');button.type='button';button.className='audio-preview';control.insertBefore(button,audio);bindInlineAudioPreview(button);}
    resetAudioPreview(button);
  };
  root.querySelectorAll('.audio-upload input[data-field="audio"]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.audio-upload'),questionId=input.closest('.part-question')?.dataset.questionId,label=control?.querySelector('.audio-file-select span');
    if(!file||!control||!questionId||!label)return;
    input.disabled=true;label.textContent='Đang tải audio · 0%';
    const upload={name:file.name,promise:null};
    upload.promise=uploadQuestionAudio(file,{onProgress:percent=>{if(pendingAudioUploads.get(questionId)===upload)label.textContent=\`Đang tải audio · \${percent}%\`;}}).then(url=>{
      if(pendingAudioUploads.get(questionId)===upload)showUploadedAudio(control,{url,name:file.name});
      return {url,name:file.name};
    }).catch(error=>{
      if(pendingAudioUploads.get(questionId)===upload){pendingAudioUploads.delete(questionId);label.textContent='Tải audio thất bại';notify(error.message);}
      throw error;
    }).finally(()=>{if(pendingAudioUploads.get(questionId)===upload)input.disabled=false;});
    pendingAudioUploads.set(questionId,upload);upload.promise.catch(()=>{});
  });
  root.querySelectorAll('[data-choice-image]').forEach(input=>input.onchange=()=>{
    const file=input.files?.[0],control=input.closest('.choice-image-upload');if(!file||!control)return;
    control.classList.add('has-image');control.title='Bấm để thay hình ảnh đáp án';
    const objectUrl=URL.createObjectURL(file),thumbnail=control.querySelector(':scope > img');
    if(thumbnail){thumbnail.src=objectUrl;thumbnail.className='choice-uploaded-image';thumbnail.alt='Ảnh đáp án đã chọn';}
    control.querySelector('.choice-image-tooltip')?.remove();
    const tooltip=document.createElement('span'),preview=new Image();tooltip.className='choice-image-tooltip';preview.alt='Ảnh đáp án đã chọn';preview.src=objectUrl;tooltip.append(preview);control.append(tooltip);
  });
  const updateSkillTotals=()=>{
    const draftScores=new Map([...root.querySelectorAll('.part-question[data-question-id]')].map(card=>[card.dataset.questionId,Math.max(0,Number(card.querySelector('[data-field="maxScore"]')?.value)||0)]));
    root.querySelectorAll('[data-skill-total]').forEach(total=>{
      const sum=(exam.sections||[]).filter(item=>item.skill===total.dataset.skill).flatMap(item=>item.questionIds||[]).reduce((score,id)=>score+((draftScores.get(id)??Number(byId(data.questions,id)?.maxScore))||0),0);
      total.textContent=\`\${Number.isInteger(sum)?sum:Number(sum.toFixed(2))} điểm\`;
    });
  };
  root.querySelectorAll('[data-field="maxScore"]').forEach(input=>input.oninput=updateSkillTotals);
  root.querySelectorAll('[data-action="preview-inline-audio"]').forEach(bindInlineAudioPreview);
}
`;
write('src/part-templates/default/builder.js',defaultBuilder);

const a1Builder=`import {renderBuilder as renderDefaultBuilder,bindBuilder as bindDefaultBuilder} from '../default/builder.js';

export function renderBuilder(options={}){
  const body=renderDefaultBuilder(options);
  if(options.readOnly)return body;
  return \`<div class="part-template-toolbar"><button class="nut" type="button" data-action="edit-part-template">Cấu hình Part</button></div>\${body}\`;
}

export function bindBuilder(options={}){return bindDefaultBuilder(options);}
`;
write('src/part-templates/a1-listening-part-1/builder.js',a1Builder);

write('src/part-templates/a1-listening-part-1/index.js',`export {openA1ListeningPart1Editor as openEditor} from './editor.js';\nexport {mountStudentRuntime} from './student.js';\nexport {validateA1ListeningPart1} from './validator.js';\nexport {renderBuilder,bindBuilder} from './builder.js';\n`);

write('src/part-templates/index.js',`import {renderBuilder as renderDefaultBuilder,bindBuilder as bindDefaultBuilder} from './default/builder.js';\nimport {renderBuilder as renderA1ListeningPart1Builder,bindBuilder as bindA1ListeningPart1Builder} from './a1-listening-part-1/builder.js';\n\nconst loaders={\n  A1_LISTENING_PART_1:()=>import('./a1-listening-part-1/index.js'),\n};\nconst builders={\n  A1_LISTENING_PART_1:{render:renderA1ListeningPart1Builder,bind:bindA1ListeningPart1Builder},\n};\nconst fallbackBuilder={render:renderDefaultBuilder,bind:bindDefaultBuilder};\n\nexport function hasPartTemplate(type){return Boolean(loaders[type]);}\nexport function renderPartBuilder(type,options={}){return (builders[type]||fallbackBuilder).render(options);}\nexport function bindPartBuilder(type,options={}){return (builders[type]||fallbackBuilder).bind(options);}\n\nasync function loadPartTemplate(type){\n  const load=loaders[type];\n  if(!load)throw new Error(\`Chưa có module cho template \${type||'không xác định'}.\`);\n  return load();\n}\n\nexport async function openPartTemplate(type,options={}){\n  const module=await loadPartTemplate(type);\n  if(typeof module.openEditor!=='function')throw new Error(\`Template \${type} chưa có editor.\`);\n  return module.openEditor(options);\n}\n\nexport async function mountPartTemplateStudent(type,options={}){\n  const module=await loadPartTemplate(type);\n  if(typeof module.mountStudentRuntime!=='function')return;\n  return module.mountStudentRuntime(options);\n}\n`);

const oldBuilder=read('src/views/builder.js');
const gradingAt=oldBuilder.indexOf('export function gradingDetailHtml');
if(gradingAt<0)throw new Error('Không tìm thấy gradingDetailHtml trong builder.js');
const gradingSuffix=oldBuilder.slice(gradingAt);
const builderHead=`import {byId,isMaster} from '../core.js';\nimport {esc,fmtDate} from '../ui/format.js';\nimport {getExamSpec,groupSectionsBySkill} from '../exam-specs/index.js';\nimport {renderPartBuilder} from '../part-templates/index.js';\n\nexport function examBuilderHtml({data,user,exam,section,readOnly}){\n  const spec=getExamSpec(exam.provider,exam.level);\n  const configured=Boolean(spec?.configured);\n  const groups=groupSectionsBySkill(exam,spec);\n  const sectionScore=item=>(item.questionIds||[]).map(id=>byId(data.questions,id)).filter(Boolean).reduce((sum,q)=>sum+(Number(q.maxScore)||0),0);\n  const icons={gear:'<img src="src/assets/figma-icon-1.svg" alt="">'};\n  const partLabel=(item,skill)=>String(item.name||'').startsWith(skill+' ')?String(item.name).replace(skill+' ','Bài '):item.name;\n  const editableStructure=!readOnly&&!configured;\n  return \`<main class="khung goethe-builder"><div class="tieu-de-trang"><div><input id="examTitle" class="exam-title-input" value="\${esc(exam.title)}" \${readOnly?'disabled':''}><p>\${esc([exam.provider,exam.level].filter(Boolean).join(' ')||'Bài thi')}</p></div><div class="nhom-nut"><button class="nut" data-action="back-admin">Quay lại</button><button class="nut" data-action="save-exam" \${readOnly?'disabled':''}>Lưu nháp</button><button class="nut chinh" data-action="publish-exam" data-id="\${exam.id}" \${exam.status==='published'||readOnly?'disabled':''}>\${exam.status==='published'?'Đã xuất bản':'Xuất bản'}</button></div></div>\${readOnly?'<div class="goi-y" style="margin-bottom:14px"><b>Đã khóa cấu trúc</b><br>Để thay đổi nội dung, hãy tạo một bài/phiên bản mới.</div>':''}<div class="goethe-layout"><aside class="goethe-outline">\${groups.map(([skill,items])=>\`<section class="goethe-skill"><div><b>\${esc(skill)}</b><span data-skill-total="\${esc(skill)}">\${items.reduce((sum,item)=>sum+sectionScore(item),0)} điểm</span>\${readOnly?'':\`<button class="gear" data-action="open-exam-settings" data-skill="\${esc(skill)}" title="Cài đặt \${esc(skill)}" aria-label="Cài đặt \${esc(skill)}">\${icons.gear}</button>\`}</div>\${items.map(item=>\`<button class="goethe-part \${section?.id===item.id?'active':''}" data-action="select-section" data-id="\${item.id}"><span>\${esc(partLabel(item,skill))}</span><small>\${(item.questionIds||[]).length} câu</small>\${editableStructure?\`<span class="phan-tool"><span class="icon-btn" data-action="move-section" data-id="\${item.id}" data-dir="up">↑</span><span class="icon-btn" data-action="move-section" data-id="\${item.id}" data-dir="down">↓</span><span class="icon-btn" data-action="remove-section" data-id="\${item.id}">×</span></span>\`:''}</button>\`).join('')}</section>\`).join('')}\${editableStructure?'<button class="nut full" data-action="add-section" style="margin-top:10px">+ Thêm phần</button>':''}</aside><section class="goethe-editor">\${section?renderPartBuilder(section.templateType,{data,user,exam,section,readOnly}):'<div class="rong">Chọn một phần để cấu hình.</div>'}</section></div></main>\`;\n}\n\n`;
write('src/views/builder.js',builderHead+gradingSuffix);

let app=read('src/app.js');
app=replaceOnce(app,"import {hasPartTemplate,openPartTemplate} from './part-templates/index.js';","import {hasPartTemplate,openPartTemplate,bindPartBuilder} from './part-templates/index.js';",'import Part Registry');
app=app.replaceAll("if(section&&exam.provider==='GOETHE'&&exam.level==='A1'){","if(section&&app.querySelector('.part-question[data-question-id]')){");
app=app.replaceAll('.goethe-question[data-question-id]','.part-question[data-question-id]');
app=replaceOnce(app,"    const defaultTimes={Nghe:20,'Đọc':25,'Viết':20};\n    const setting=exam.settings?.skillSettings?.[skill]||{};","    const setting=exam.settings?.skillSettings?.[skill]||{};\n    const sectionDefaultTime=(exam.sections||[]).find(item=>item.skill===skill)?.timeMinutes??20;",'skill default time');
app=app.replace('value="${Number(setting.timeMinutes??defaultTimes[skill]??20)}"','value="${Number(setting.timeMinutes??sectionDefaultTime)}"');
const bindStart=app.indexOf('  const resetAudioPreview=button=>{');
const bindEndNeedle="  app.querySelectorAll('[data-action=\"preview-inline-audio\"]').forEach(bindInlineAudioPreview);\n";
const bindEnd=app.indexOf(bindEndNeedle,bindStart);
if(bindStart<0||bindEnd<0)throw new Error('Không tìm thấy block media binding cũ trong bindBuilder');
const binderReplacement=`  const section=exam.sections.find(item=>item.id===ui.builderSectionId)||exam.sections[0];\n  bindPartBuilder(section?.templateType,{root:app,data,exam,section,pendingAudioUploads,notify});\n`;
app=app.slice(0,bindStart)+binderReplacement+app.slice(bindEnd+bindEndNeedle.length);
app=app.replace("  app.querySelectorAll('[data-action=\"open-bank-picker\"]').forEach(b=>b.onclick=bankPicker);\n",'');
app=app.replace('  bindFilters();\n','');
const filterStart=app.indexOf('function bindFilters(){');
if(filterStart>=0){const filterEnd=app.indexOf('\nasync function toggleTeacher',filterStart);if(filterEnd<0)throw new Error('Không tìm thấy cuối bindFilters');app=app.slice(0,filterStart)+app.slice(filterEnd+1);}
write('src/app.js',app);

let tests=read('tests/architecture.test.mjs');
const anchor="test('Media garbage collector được khởi động từ server',()=>{";
const addition=`test('Builder định tuyến editor theo templateType thay vì hard-code Goethe A1',()=>{\n  const builder=read('src/views/builder.js'),registry=read('src/part-templates/index.js'),app=read('src/app.js');\n  assert.ok(builder.includes('renderPartBuilder(section.templateType'));\n  assert.equal(builder.includes("provider==='GOETHE'"),false);\n  assert.equal(builder.includes('goetheA1BuilderHtml'),false);\n  assert.ok(registry.includes('renderPartBuilder'));assert.ok(registry.includes('bindPartBuilder'));\n  assert.ok(fs.existsSync(path.join(root,'src/part-templates/default/builder.js')));\n  assert.ok(fs.existsSync(path.join(root,'src/part-templates/a1-listening-part-1/builder.js')));\n  assert.ok(app.includes('bindPartBuilder(section?.templateType'));\n  assert.equal(app.includes("exam.provider==='GOETHE'&&exam.level==='A1'"),false);\n});\n\n`;
if(!tests.includes(addition.trim()))tests=replaceOnce(tests,anchor,addition+anchor,'architecture test anchor');
write('tests/architecture.test.mjs',tests);

console.log('Step 8 builder refactor applied.');
