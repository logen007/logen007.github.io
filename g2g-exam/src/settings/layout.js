import {normalizeThemeColor,colorContrast} from './palette.js';

export const CONTENT_WIDTH_RANGE={min:800,max:3840};
export const LAYOUT_DEFAULTS={contentWidth:1600,cardRadius:24,background:'#F4F5F6'};
export const LAYOUT_CHOICES={cardRadius:[12,16,20,24,28]};
const legacyBackgrounds={neutral:'#F4F5F6',warm:'#F7F5F0',cool:'#F0F5F7'};
const validWidth=value=>Number.isInteger(value)&&value>=CONTENT_WIDTH_RANGE.min&&value<=CONTENT_WIDTH_RANGE.max;
const backgroundColor=value=>normalizeThemeColor(value)||(Object.hasOwn(legacyBackgrounds,value)?legacyBackgrounds[value]:null);
export function validateLayout(input={}){
  if(input.contentWidth!==undefined&&!validWidth(input.contentWidth))throw new Error(`Chiều rộng phải là số nguyên từ ${CONTENT_WIDTH_RANGE.min} đến ${CONTENT_WIDTH_RANGE.max} px.`);
  if(input.cardRadius!==undefined&&!LAYOUT_CHOICES.cardRadius.includes(input.cardRadius))throw new Error('Độ bo góc không hợp lệ.');
  if(input.background!==undefined&&!backgroundColor(input.background))throw new Error('Nền trang cần mã màu # và 6 ký tự hex.');
}
export function normalizeLayout(input={}){
  return {contentWidth:validWidth(input.contentWidth)?input.contentWidth:LAYOUT_DEFAULTS.contentWidth,
    cardRadius:LAYOUT_CHOICES.cardRadius.includes(input.cardRadius)?input.cardRadius:LAYOUT_DEFAULTS.cardRadius,
    background:backgroundColor(input.background)||LAYOUT_DEFAULTS.background};
}
export function layoutVariables(input={}){
  const theme=normalizeLayout(input);
  const text=colorContrast(theme.background,'#101318')>=colorContrast(theme.background,'#FFFFFF')?'#101318':'#FFFFFF';
  return {'--max':theme.contentWidth+'px','--r':theme.cardRadius+'px','--nen':theme.background,'--preview-text':text};
}
