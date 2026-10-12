import {loadApprovedExamSpec} from './spec-loader.js';
export const TELC_SPECS={
  B1:await loadApprovedExamSpec('../../specs/telc/b1/exam.json'),
  B2:{provider:'TELC',level:'B2',configured:false,skills:[]},
};

export const TELC_LEVELS=Object.freeze(Object.keys(TELC_SPECS));
