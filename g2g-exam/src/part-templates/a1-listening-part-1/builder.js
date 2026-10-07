import {renderBuilder as renderDefaultBuilder,bindBuilder as bindDefaultBuilder} from '../default/builder.js';

export function renderBuilder(options={}){
  const body=renderDefaultBuilder(options);
  if(options.readOnly)return body;
  return `<div class="part-template-toolbar"><button class="nut" type="button" data-action="edit-part-template">Cấu hình Part</button></div>${body}`;
}

export function bindBuilder(options={}){return bindDefaultBuilder(options);}
