import {esc} from './format.js';
import {iconHtml} from './icons.js';
import {WRITING_FORM_TYPES,isScoredWritingField,writingFormScore,writingOptions,writingPointLayout,normalizeWritingRows} from '../domain/writing-form.js';

const labels={heading:'Tiêu đề',note:'Đoạn hướng dẫn',static:'Thông tin có sẵn',text:'Ô điền',truefalse:'Đúng / sai',choice:'Chọn phương án',image:'Hình ảnh',signature:'Chữ ký mẫu'};
const field=(label,hook,value,disabled,multi=false)=>`<label class="writing-setup-field"><span>${label}</span>${multi?`<textarea ${hook} ${disabled}>${esc(value||'')}</textarea>`:`<input ${hook} value="${esc(value||'')}" ${disabled}>`}</label>`;

export function writingFormEditor(q,{readOnly=false}={}){
  q={...q,rubric:normalizeWritingRows(q.rubric)};
  const disabled=readOnly?'disabled':'';
  const blocks=(q.rubric||[]).map((row,index)=>{
    const type=row.type||'text',scored=isScoredWritingField({...row,hidden:false});
    let content='';
    if(type==='heading'||type==='note')content=field(type==='heading'?'Tiêu đề trong khung':'Nội dung','data-rubric-value',row.value??row.answers,disabled,true);
    else if(type==='image')content=`<label class="writing-image-picker">${row.imageUrl?`<img src="${esc(row.imageUrl)}" alt="Ảnh trong form">`:`${iconHtml('image')}<span>Chọn hình ảnh</span>`}<input type="file" data-rubric-image accept="image/*" ${disabled}></label>${field('Mô tả ảnh','data-rubric-label',row.label,disabled)}`;
    else {
      content=field('Nhãn hiển thị','data-rubric-label',row.label,disabled);
      if(scored){
        if(type==='text')content+=`${field('Đáp án đúng','data-rubric-answer',row.answers,disabled)}<small class="writing-answer-help">Mỗi đáp án được chấp nhận cách nhau bởi dấu |. Ví dụ: đáp án 1|đáp án 2|đáp án 3</small>`;
        else content+=`<div class="writing-option-setup">${writingOptions(row).map((option,i)=>`<label><input type="radio" data-rubric-correct name="form-correct-${esc(q.id)}-${index}" value="${i}" ${row.correctIndex!=null&&Number(row.correctIndex)===i?'checked':''} ${disabled}><input data-rubric-option aria-label="Phương án ${i+1}" value="${esc(option)}" ${disabled}></label>`).join('')}${type==='choice'?`<button type="button" class="text-link" data-action="add-form-option" data-id="${esc(q.id)}" data-index="${index}" ${disabled}>+ Phương án</button>`:''}<small>Chọn đáp án tham khảo; học viên chỉ thấy các phương án có nội dung.</small></div>`;
      }else content+=field(type==='signature'?'Tên ký mẫu':'Nội dung có sẵn','data-rubric-value',row.value??row.answers,disabled);
    }
    return `<section class="writing-setup-block ${row.hidden?'is-hidden':''}" data-rubric-index="${index}" data-rubric-hidden="${Boolean(row.hidden)}"><input type="hidden" data-rubric-type value="${esc(type)}"><header><strong>${labels[type]||labels.text}${row.hidden?' · Đang ẩn':''}</strong><div class="writing-block-actions">${scored?`<label class="writing-score"><input data-rubric-score type="number" min="0" step="0.01" aria-label="Điểm của trường" value="${row.maxScore??1}" ${disabled}> điểm</label>`:''}<button class="icon-btn" type="button" data-action="remove-rubric-row" data-id="${esc(q.id)}" data-index="${index}" aria-label="Ẩn hoặc xóa khối này" ${disabled}>${iconHtml('close')}</button><button class="icon-btn" type="button" data-action="add-rubric-row" data-id="${esc(q.id)}" data-index="${index}" aria-label="Thêm khối cùng loại ở cuối" ${disabled}>${iconHtml('plus')}</button></div></header><div class="writing-block-content writing-block-content--${esc(type)}">${content}</div></section>`;
  }).join('');
  return `<article class="writing-form part-question" data-editor-mode="form-fields" data-structured-form="true" data-question-id="${esc(q.id)}"><div class="writing-form-intro"><strong>Biểu mẫu học viên điền</strong><span data-writing-total>${writingFormScore(q.rubric)} điểm</span></div>${blocks}<div class="writing-add-blocks" aria-label="Thêm thành phần vào cuối biểu mẫu">${WRITING_FORM_TYPES.map(type=>`<button type="button" class="nut nho" data-action="add-rubric-row" data-id="${esc(q.id)}" data-type="${type}" ${disabled}>+ ${labels[type]}</button>`).join('')}</div></article>`;
}

export function readWritingRow(element,previous={}){
  const type=element.querySelector('[data-rubric-type]')?.value||'text';
  return {...previous,type,label:element.querySelector('[data-rubric-label]')?.value.trim()||'',value:element.querySelector('[data-rubric-value]')?.value||'',answers:element.querySelector('[data-rubric-answer]')?.value.trim()||'',options:[...element.querySelectorAll('[data-rubric-option]')].map(x=>x.value),correctIndex:element.querySelector('[data-rubric-correct]:checked')?Number(element.querySelector('[data-rubric-correct]:checked').value):null,example:Boolean(element.querySelector('[data-rubric-example]')?.checked),maxScore:isScoredWritingField({type})?Math.max(0,Number(element.querySelector('[data-rubric-score]')?.value)||0):0,hidden:element.dataset.rubricHidden==='true'};
}

export function writingSubmission(q,answer={}){
  q={...q,rubric:normalizeWritingRows(q.rubric)};
  return `<dl>${(q.rubric||[]).flatMap((row,index)=>{
    if(!isScoredWritingField(row))return [];
    const expected=['choice','truefalse'].includes(row.type)?writingOptions(row)[row.correctIndex]||'':String(row.answers||'').split('|').map(item=>item.trim()).filter(Boolean).join(' · ');
    return [`<dt><strong>${esc(row.label||'Ô điền')} · ${Number(row.maxScore)||0} điểm</strong></dt><dd>${esc(answer?.[index]||'(Chưa trả lời)')}${expected?`<br><small>Tham khảo: ${esc(expected)}</small>`:''}</dd>`];
  }).join('')}</dl>`;
}

export function writingFormDisplay(q,answer={}){
  q={...q,rubric:normalizeWritingRows(q.rubric)};
  const groups=[],{markers}=writingPointLayout(q.rubric);
  for(const [index,row] of (q.rubric||[]).entries()){
    if(row.hidden)continue;
    const type=row.type||'text',marker=markers[index];
    const val=answer?.[index]??'',hook=`class="answer-form-field" data-q="${esc(q.id)}" data-field-index="${index}" aria-label="${esc(row.label||labels[type])}"`;
    let html;
    if(type==='heading')html=`<h3>${esc(row.value??row.answers??'')}</h3>`;
    else if(type==='note')html=`<p>${esc(row.value??row.answers??'')}</p>`;
    else if(type==='image')html=row.imageUrl?`<img src="${esc(row.imageUrl)}" alt="${esc(row.label||'Hình trong biểu mẫu')}">`:'';
    else if(type==='static'||type==='signature')html=`<span class="form-given ${type==='signature'?'form-signature':''}">${esc(row.value??row.answers??'')}</span>`;
    else if(type==='choice'||type==='truefalse')html=`<div class="form-options">${writingOptions(row).filter(option=>String(option).trim()).map(option=>`<label><input ${hook} type="radio" name="writing-${esc(q.id)}-${index}" value="${esc(option)}" ${val===option?'checked':''}><span>${esc(option)}</span></label>`).join('')}</div>`;
    else html=`<input ${hook} type="text" value="${esc(val)}" autocomplete="off">`;
    const full=['heading','note','image'].includes(type),last=groups.at(-1),cell=`<div class="form-cell">${html}</div>`;
    if(!full&&row.label&&last&&!last.full&&last.label===row.label){last.cells.push(cell);if(marker)last.markers.push(marker);}
    else groups.push({full,type,label:row.label||'',cells:[cell],markers:marker?[marker]:[]});
  }
  return `<div class="writing-paper" aria-label="Biểu mẫu">${groups.map(group=>`<div class="form-line ${group.full?'form-line--full':''} form-line--${esc(group.type)}">${group.full?'':`<span class="form-label">${esc(group.label)}</span>`}<div class="form-answer-line"><div class="form-cells">${group.cells.join('')}</div>${group.full?'':`<div class="form-point-column">${group.markers.map(marker=>`<span class="form-point">${marker}</span>`).join('')}</div>`}</div></div>`).join('')}</div>`;
}
