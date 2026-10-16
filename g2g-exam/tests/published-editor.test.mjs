import assert from 'node:assert/strict';
import {bindPublishedEditor} from '../src/ui/published-editor.js';
let handler,notices=[];
bindPublishedEditor({dataset:{published:'false'},addEventListener(){throw Error('Draft editing must remain unchanged');}},()=>{});
bindPublishedEditor({dataset:{published:'true'},addEventListener(type,fn,capture){assert.equal(type,'click');assert.equal(capture,true);handler=fn;}},text=>notices.push(text));
function click(action){
 const event={target:{closest:()=>action?{dataset:{action}}:null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 handler(event);return event;
}
for(const action of [undefined,'add-inline-question','remove-question','edit-part-template']){
 const event=click(action);assert.ok(event.prevented&&event.stopped);
 assert.equal(notices.at(-1),'Hãy bỏ xuất bản trước khi chỉnh sửa bài thi.');
}
const before=notices.length;
for(const action of ['back-admin','preview-exam','unpublish-exam','exam-access-settings','select-section'])assert.ok(!click(action).prevented);
assert.equal(notices.length,before,'Unpublishing and read-only navigation must remain usable');
console.log('Published editor: edit attempts show one notice, drafts and safe navigation remain usable');
