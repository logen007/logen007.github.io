import {loadApprovedExamSpec} from './spec-loader.js';

const A1=await loadApprovedExamSpec('../../specs/goethe/a1/exam.json');

export const GOETHE_SPECS={
  A1,
  A2:await loadApprovedExamSpec('../../specs/goethe/a2/exam.json'),
  B1:await loadApprovedExamSpec('../../specs/goethe/b1/exam.json'),
  B2:await loadApprovedExamSpec('../../specs/goethe/b2/exam.json'),
};

export const GOETHE_LEVELS=Object.freeze(Object.keys(GOETHE_SPECS));
