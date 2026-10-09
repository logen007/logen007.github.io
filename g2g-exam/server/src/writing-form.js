import {existsSync} from 'node:fs';
const production=new URL('../../public/src/domain/writing-form.js',import.meta.url);
const domain=await import(existsSync(production)?production.href:new URL('../../src/domain/writing-form.js',import.meta.url).href);
export const {publicWritingRows,writingFormScore,normalizeWritingRows}=domain;
