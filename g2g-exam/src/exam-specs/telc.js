import {loadApprovedExamSpec} from './spec-loader.js';
const B1=await loadApprovedExamSpec('../../specs/telc/b1/exam.json');
// User-approved shared structure: B2 differs only in its level identity.
export const TELC_SPECS={
  B1,
  B2:{...B1,level:'B2'},
};

export const TELC_LEVELS=Object.freeze(Object.keys(TELC_SPECS));
