import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=rel=>path.join(root,rel);
const read=rel=>fs.readFileSync(file(rel),'utf8');
const write=(rel,content)=>{fs.mkdirSync(path.dirname(file(rel)),{recursive:true});fs.writeFileSync(file(rel),content);};
const replaceOnce=(rel,from,to)=>{const source=read(rel);if(!source.includes(from))throw new Error(`Không tìm thấy marker trong ${rel}`);write(rel,source.replace(from,to));};
const json=(rel,value)=>write(rel,`${JSON.stringify(value,null,2)}\n`);

const approvedPart=({id,key,name,questionLimit,template='GENERIC'})=>({id,status:'APPROVED',key,name,questionLimit,template});

json('specs/goethe/a1/exam.json',{
  provider:'GOETHE',
  level:'A1',
  status:'APPROVED',
  skills:[
    {key:'listening',label:'Nghe',defaultTimeMinutes:20,defaultQuestionScore:1,parts:['listening/part-01.json','listening/part-02.json','listening/part-03.json']},
    {key:'reading',label:'Đọc',defaultTimeMinutes:25,defaultQuestionScore:1,parts:['reading/part-01.json','reading/part-02.json','reading/part-03.json']},
    {key:'writing',label:'Viết',defaultTimeMinutes:20,defaultQuestionScore:1,parts:['writing/part-01.json','writing/part-02.json']},
  ],
});

json('specs/goethe/a1/listening/part-01.json',approvedPart({id:'GOETHE.A1.LISTENING.PART_01',key:'listening-1',name:'Nghe 1',questionLimit:6,template:'A1_LISTENING_PART_1'}));
json('specs/goethe/a1/listening/part-02.json',approvedPart({id:'GOETHE.A1.LISTENING.PART_02',key:'listening-2',name:'Nghe 2',questionLimit:4}));
json('specs/goethe/a1/listening/part-03.json',approvedPart({id:'GOETHE.A1.LISTENING.PART_03',key:'listening-3',name:'Nghe 3',questionLimit:5}));
json('specs/goethe/a1/reading/part-01.json',approvedPart({id:'GOETHE.A1.READING.PART_01',key:'reading-1',name:'Đọc 1',questionLimit:5}));
json('specs/goethe/a1/reading/part-02.json',approvedPart({id:'GOETHE.A1.READING.PART_02',key:'reading-2',name:'Đọc 2',questionLimit:5}));
json('specs/goethe/a1/reading/part-03.json',approvedPart({id:'GOETHE.A1.READING.PART_03',key:'reading-3',name:'Đọc 3',questionLimit:5}));
json('specs/goethe/a1/writing/part-01.json',approvedPart({id:'GOETHE.A1.WRITING.PART_01',key:'writing-1',name:'Viết 1',questionLimit:1,template:'WRITING'}));
json('specs/goethe/a1/writing/part-02.json',approvedPart({id:'GOETHE.A1.WRITING.PART_02',key:'writing-2',name:'Viết 2',questionLimit:1,template:'WRITING'}));

write('src/exam-specs/spec-loader.js',`async function readJson(url){\n  if(url.protocol==='file:'){\n    const {readFile}=await import('node:fs/promises');\n    return JSON.parse(await readFile(url,'utf8'));\n  }\n  const response=await fetch(url,{cache:'no-store'});\n  if(!response.ok)throw new Error(\`Không tải được specification: \${url.pathname}\`);\n  return response.json();\n}\n\nfunction requireApproved(spec,label){\n  if(spec?.status!=='APPROVED')throw new Error(\`\${label} chưa được APPROVED.\`);\n  return spec;\n}\n\nexport async function loadApprovedExamSpec(relativePath){\n  const examUrl=new URL(relativePath,import.meta.url);\n  const source=requireApproved(await readJson(examUrl),\`Exam spec \${examUrl.pathname}\`);\n  const skills=await Promise.all((source.skills||[]).map(async skill=>{\n    const parts=await Promise.all((skill.parts||[]).map(async partPath=>{\n      const part=requireApproved(await readJson(new URL(partPath,examUrl)),\`Part spec \${partPath}\`);\n      return {\n        key:String(part.key||part.id),\n        name:String(part.name||part.id),\n        questionLimit:Math.max(0,Number(part.questionLimit||0)),\n        templateType:String(part.template||'GENERIC'),\n      };\n    }));\n    return {\n      key:String(skill.key||''),\n      label:String(skill.label||skill.key||''),\n      defaultTimeMinutes:Math.max(1,Number(skill.defaultTimeMinutes||30)),\n      defaultQuestionScore:Math.max(0,Number(skill.defaultQuestionScore??1)),\n      parts,\n    };\n  }));\n  return {provider:String(source.provider||'').toUpperCase(),level:String(source.level||'').toUpperCase(),configured:true,skills};\n}\n`);

write('src/exam-specs/goethe.js',`import {loadApprovedExamSpec} from './spec-loader.js';\n\nconst A1=await loadApprovedExamSpec('../../specs/goethe/a1/exam.json');\n\nexport const GOETHE_SPECS={\n  A1,\n  A2:{provider:'GOETHE',level:'A2',configured:false,skills:[]},\n  B1:{provider:'GOETHE',level:'B1',configured:false,skills:[]},\n  B2:{provider:'GOETHE',level:'B2',configured:false,skills:[]},\n};\n\nexport const GOETHE_LEVELS=Object.freeze(Object.keys(GOETHE_SPECS));\n`);

replaceOnce('src/domain/exams.js',
  "    skill:String(input.skill||''),\n    instruction:String(input.instruction||''),",
  "    skill:String(input.skill||''),\n    skillKey:String(input.skillKey||''),\n    templateType:String(input.templateType||'GENERIC'),\n    instruction:String(input.instruction||''),");

replaceOnce('server/Dockerfile',
  'COPY src /app/public/src\n',
  'COPY src /app/public/src\nCOPY specs /app/public/specs\n');

replaceOnce('server/src/index.js',
  "const noCache=['/', '/index.html', '/vi.html', '/runtime-config.js', '/styles.css', '/enhancements.css'].includes(pathname)||pathname.startsWith('/src/');",
  "const noCache=['/', '/index.html', '/vi.html', '/runtime-config.js', '/styles.css', '/enhancements.css'].includes(pathname)||pathname.startsWith('/src/')||pathname.startsWith('/specs/');");

replaceOnce('specs/README.md',
`Ví dụ:\n\n\`\`\`text\nspecs/goethe/a1/listening/part-01.json\n\`\`\`\n`,
`Ví dụ:\n\n\`\`\`text\nspecs/goethe/a1/exam.json\nspecs/goethe/a1/listening/part-01.json\n\`\`\`\n\n\`exam.json\` là composition root của một kỳ thi đã cấu hình: nó chỉ giữ metadata dùng chung ở cấp Level/Skill và danh sách đường dẫn tới từng Part spec. Rule riêng của Part vẫn chỉ nằm trong file Part tương ứng, để không lặp lại cùng một rule ở nhiều nơi.\n`);

replaceOnce('tests/architecture.test.mjs',
  "import {clone,byId,softDeleteQuestionGroup,restoreQuestionGroup,permanentlyDeleteQuestionGroup} from '../src/core.js';",
  "import {clone,byId,createExam,softDeleteQuestionGroup,restoreQuestionGroup,permanentlyDeleteQuestionGroup} from '../src/core.js';");

const marker="test('App tạo/migrate đề qua exam factory, không hard-code GOETHE_A1_PARTS',()=>{";
const extra=`test('Goethe A1 lấy cấu trúc production từ specs/ thay vì hard-code trong registry',()=>{\n  const source=read('src/exam-specs/goethe.js');\n  assert.ok(source.includes(\"loadApprovedExamSpec('../../specs/goethe/a1/exam.json')\"));\n  assert.equal(source.includes(\"part('listening-1'\"),false);\n  const part=JSON.parse(read('specs/goethe/a1/listening/part-01.json'));\n  assert.equal(part.status,'APPROVED');\n  assert.equal(part.questionLimit,6);\n  assert.equal(part.template,'A1_LISTENING_PART_1');\n});\n\ntest('Metadata skillKey/templateType sống sót từ spec qua createExam',()=>{\n  const state=clone(seedState),teacher=byId(state.users,'teacher-lan');\n  const spec=getExamSpec('GOETHE','A1');\n  const sections=buildSectionsFromSpec(spec,{idFactory:i=>\`meta-\${i}\`});\n  const exam=createExam(state,teacher,{title:'Metadata test',provider:'GOETHE',level:'A1',sections});\n  assert.equal(exam.sections[0].skillKey,'listening');\n  assert.equal(exam.sections[0].templateType,'A1_LISTENING_PART_1');\n  assert.equal(exam.sections[1].templateType,'GENERIC');\n});\n\ntest('Production image phục vụ specs JSON cùng app',()=>{\n  assert.ok(read('server/Dockerfile').includes('COPY specs /app/public/specs'));\n  assert.ok(read('server/src/index.js').includes(\"pathname.startsWith('/specs/')\"));\n});\n\n`;
replaceOnce('tests/architecture.test.mjs',marker,extra+marker);

console.log('Step 6 patch applied.');
