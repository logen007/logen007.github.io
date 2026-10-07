import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../src/app.js');
let source=fs.readFileSync(file,'utf8');

const importAnchor="} from './views/modals.js';\n";
if(!source.includes("from './exam-specs/index.js'")){
  source=source.replace(importAnchor,`${importAnchor}import {getProviderLevels} from './exam-specs/index.js';\nimport {createExamDraft,ensureExamMatchesConfiguredSpec} from './controllers/exam-factory.js';\n`);
}
source=source.replace('  createExam,updateExam,softDeleteExam,restoreExam,permanentlyDeleteExam,','  updateExam,softDeleteExam,restoreExam,permanentlyDeleteExam,');
source=source.replace(/\nconst GOETHE_A1_PARTS=\[[\s\S]*?\];\n/,'\n');
source=source.replace("const available=provider==='TELC'?['B1','B2']:['A1','A2','B1','B2'];","const available=getProviderLevels(provider);");

const createBlock=/  const \{level,provider,title\}=setup;[\s\S]*?  if\(exam\)\{data=await repo\.getState\(\);openBuilder\(exam\.id\);\}\n\}/;
if(!createBlock.test(source))throw new Error('Không tìm thấy block createNewExam cần refactor.');
source=source.replace(createBlock,`  const {level,provider,title}=setup;\n  const exam=await act(()=>repo.transaction(st=>createExamDraft(st,user,{level,provider,title})),null,{rerender:false});\n  if(exam){data=await repo.getState();openBuilder(exam.id);}\n}`);

const builderBlock=/async function openBuilder\(id\)\{[\s\S]*?\n\}\n\nfunction bindBuilder\(\)\{/;
if(!builderBlock.test(source))throw new Error('Không tìm thấy openBuilder cần refactor.');
source=source.replace(builderBlock,`async function openBuilder(id){\n  let exam=byId(data.exams,id);\n  const migrated=await repo.transaction(st=>ensureExamMatchesConfiguredSpec(st,user,id));\n  if(migrated){data=await repo.getState();exam=byId(data.exams,id);}\n  ui.builderExamId=id;\n  ui.builderSectionId=exam?.sections?.[0]?.id||null;\n  ui.view='builder';\n  render();\n}\n\nfunction bindBuilder(){`);

fs.writeFileSync(file,source);
console.log('app.js refactored to exam spec/factory modules');
