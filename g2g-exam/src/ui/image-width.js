import {imageMaxWidth} from '../domain/question-display.js';

export const imageWidthHelp='Chiều rộng tối đa của ảnh theo pixel, ví dụ 600. Để trống để ảnh tự vừa khung. Ảnh luôn giữ đúng tỷ lệ và không tràn màn hình.';
export function imageWidthInput(value,{id='',attributes='',disabled=false}={}){
  return `<label class="image-width-control" data-tooltip="${imageWidthHelp}"><input class="truong instruction-image-width" ${id?`id="${id}"`:''} ${attributes} type="number" min="2" step="1" aria-label="Chiều rộng tối đa của ảnh (px)" title="${imageWidthHelp}" placeholder="Rộng tối đa" value="${imageMaxWidth(value)??''}" ${disabled?'disabled':''}><span aria-hidden="true">px</span></label>`;
}
