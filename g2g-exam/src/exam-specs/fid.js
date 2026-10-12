import {loadApprovedExamSpec} from './spec-loader.js';
import {GOETHE_SPECS} from './goethe.js';

const A1=await loadApprovedExamSpec('../../specs/fid/a1/exam.json');
// A2 follows the same approved source, not a second copy of its rules.
const A2={...GOETHE_SPECS.A2,provider:'FID'};
export const FID_SPECS={A1,A2};
export const FID_LEVELS=Object.freeze(Object.keys(FID_SPECS));
