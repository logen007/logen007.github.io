export const DEFAULT_PRIMARY_COLOR='#111827';
export const SELECTION_STRENGTH_RANGE={min:5,max:35};
export function normalizeThemeColor(value){
  const color=String(value??'').trim();
  return /^#[0-9a-f]{6}$/i.test(color)?color.toUpperCase():null;
}
export function validateButtonTheme(input={}){
  if(input.secondaryColor!==undefined&&!normalizeThemeColor(input.secondaryColor))throw new Error('Nút phụ cần mã màu # và 6 ký tự hex.');
  const value=input.selectionStrength;
  if(value!==undefined&&(!Number.isInteger(value)||value<SELECTION_STRENGTH_RANGE.min||value>SELECTION_STRENGTH_RANGE.max))throw new Error('Độ đậm khi đang chọn phải từ 5 đến 35%.');
}
export function normalizeButtonTheme(input={}){
  const value=input.selectionStrength;
  return {secondaryColor:normalizeThemeColor(input.secondaryColor)||'#FFFFFF',selectionStrength:Number.isInteger(value)&&value>=5&&value<=35?value:7};
}
function rgb(color){return color.slice(1).match(/../g).map(channel=>parseInt(channel,16));}
function mix(color,target,amount){
  const a=rgb(color),b=rgb(target);
  return '#'+a.map((channel,index)=>Math.round(channel*(1-amount)+b[index]*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function luminance(color){
  const channels=rgb(color).map(channel=>{const value=channel/255;return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;});
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
export function colorContrast(a,b){
  const values=[luminance(a),luminance(b)].sort((left,right)=>right-left);
  return (values[0]+0.05)/(values[1]+0.05);
}
const foreground=color=>colorContrast(color,'#FFFFFF')>=colorContrast(color,'#000000')?'#FFFFFF':'#000000';
// Selection is derived from primary, never an unrelated third color.
export function themePalette(value,options={}){
  const primary=normalizeThemeColor(value)||DEFAULT_PRIMARY_COLOR;
  const {secondaryColor:secondary,selectionStrength}=normalizeButtonTheme(options);
  const onPrimary=foreground(primary),onSecondary=foreground(secondary);
  const soft=mix(primary,'#FFFFFF',1-selectionStrength/100);
  let text=primary;
  for(let amount=0.05;(colorContrast(text,soft)<4.5||colorContrast(text,'#FFFFFF')<4.5)&&amount<=1;amount+=0.05)text=mix(primary,'#000000',amount);
  return {
    '--brand-primary':primary,'--brand-on-primary':onPrimary,'--brand-text':text,
    '--brand-soft':soft,'--brand-border':mix(primary,'#FFFFFF',Math.max(0.25,1-selectionStrength/100-0.17)),
    '--brand-hover':mix(primary,onPrimary==='#FFFFFF'?'#000000':'#FFFFFF',0.08),'--brand-ring':text,
    '--button-secondary':secondary,'--button-secondary-text':onSecondary,
    '--button-secondary-border':mix(secondary,onSecondary,0.15),
    '--button-secondary-hover':secondary==='#FFFFFF'?'#F3F4F5':mix(secondary,onSecondary==='#FFFFFF'?'#000000':'#FFFFFF',0.08),
  };
}
