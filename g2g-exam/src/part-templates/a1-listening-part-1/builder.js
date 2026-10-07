import {renderBuilder as renderDefaultBuilder,bindBuilder as bindDefaultBuilder} from '../default/builder.js';

export function renderBuilder(options={}){
  return renderDefaultBuilder(options);
}

export function bindBuilder(options={}){return bindDefaultBuilder(options);}
