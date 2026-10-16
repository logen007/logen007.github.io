const allowed=new Set(['back-admin','preview-exam','unpublish-exam','exam-access-settings','select-section']);
export function bindPublishedEditor(root,notify){
 if(!root||root.dataset.published!=='true')return;
 root.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(allowed.has(action))return;
  event.preventDefault();event.stopImmediatePropagation();
  notify('Hãy bỏ xuất bản trước khi chỉnh sửa bài thi.');
 },true);
}
