import {loadApprovedExamSpec} from './spec-loader.js';

const A1=await loadApprovedExamSpec('../../specs/goethe/a1/exam.json');

export const GOETHE_SPECS={
  A1,
  A2:await loadApprovedExamSpec('../../specs/goethe/a2/exam.json'),
  B1:{provider:'GOETHE',level:'B1',configured:false,skills:[]},
  B2:{provider:'GOETHE',level:'B2',configured:false,skills:[]},
};

export const GOETHE_LEVELS=Object.freeze(Object.keys(GOETHE_SPECS));
