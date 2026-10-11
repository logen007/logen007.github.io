import {loadApprovedExamSpec} from './spec-loader.js';

const [A1,A2,B1,B2]=await Promise.all([
  loadApprovedExamSpec('../../specs/goethe/a1/exam.json'),
  loadApprovedExamSpec('../../specs/goethe/a2/exam.json'),
  loadApprovedExamSpec('../../specs/goethe/b1/exam.json'),
  loadApprovedExamSpec('../../specs/goethe/b2/exam.json')
]);
export const GOETHE_SPECS={A1,A2,B1,B2};

export const GOETHE_LEVELS=Object.freeze(Object.keys(GOETHE_SPECS));
