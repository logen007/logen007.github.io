const skill=(key,label,defaultTimeMinutes,parts)=>({key,label,defaultTimeMinutes,defaultQuestionScore:1,parts});
const part=(key,name,questionLimit,templateType='GENERIC')=>({key,name,questionLimit,templateType});

export const GOETHE_SPECS={
  A1:{
    provider:'GOETHE',level:'A1',configured:true,
    skills:[
      skill('listening','Nghe',20,[
        part('listening-1','Nghe 1',6,'A1_LISTENING_PART_1'),
        part('listening-2','Nghe 2',4),
        part('listening-3','Nghe 3',5),
      ]),
      skill('reading','Đọc',25,[
        part('reading-1','Đọc 1',5),
        part('reading-2','Đọc 2',5),
        part('reading-3','Đọc 3',5),
      ]),
      skill('writing','Viết',20,[
        part('writing-1','Viết 1',1,'WRITING'),
        part('writing-2','Viết 2',1,'WRITING'),
      ]),
    ],
  },
  A2:{provider:'GOETHE',level:'A2',configured:false,skills:[]},
  B1:{provider:'GOETHE',level:'B1',configured:false,skills:[]},
  B2:{provider:'GOETHE',level:'B2',configured:false,skills:[]},
};

export const GOETHE_LEVELS=Object.freeze(Object.keys(GOETHE_SPECS));
