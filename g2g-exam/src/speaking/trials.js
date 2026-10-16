// Source-book stimulus approved for the isolated G2G trial, not official exam timing.
export const DTZ_PHOTO='/speaking-assets/dtz-modelltest4-photo.png';
export function dtzTrialDefaults(){
 const photo='Was sehen Sie auf dem Foto?\nWas für eine Situation zeigt das Bild?';
 const experience='Welche Erfahrungen haben Sie damit?';
 return ['A','B'].flatMap(speakerSeat=>[
  {title:'Mô tả ảnh',instruction:'Mô tả ảnh bằng tiếng Đức. Người còn lại lắng nghe. Khi cả hai đã xong, bấm Tôi đã nói xong.',a:photo,b:photo,seconds:120,image:DTZ_PHOTO,speakerSeat},
  {title:'Kể trải nghiệm',instruction:'Kể trải nghiệm của bạn bằng tiếng Đức. Người còn lại lắng nghe. Khi cả hai đã xong, bấm Tôi đã nói xong.',a:experience,b:experience,seconds:90,image:DTZ_PHOTO,speakerSeat}
 ]);
}
