// Source-book stimulus approved for the isolated G2G trial, not official exam timing.
export const DTZ_PHOTO='/speaking-assets/dtz-modelltest4-photo.png';
export function dtzTrialDefaults(){
 const photo='Was sehen Sie auf dem Foto?\nWas für eine Situation zeigt das Bild?';
 const experience='Welche Erfahrungen haben Sie damit?';
 return [...['A','B'].map(speakerSeat=>({title:'Mô tả ảnh',instruction:'Mô tả ảnh bằng tiếng Đức. Người còn lại lắng nghe.',a:photo,b:photo,seconds:120,image:DTZ_PHOTO,speakerSeat})),{title:'Trao đổi trải nghiệm',instruction:'Cùng trao đổi bằng tiếng Đức về trải nghiệm liên quan đến ảnh. Lắng nghe, hỏi thêm và trả lời bạn cùng thi.',a:experience,b:experience,seconds:180,image:DTZ_PHOTO}];
}
