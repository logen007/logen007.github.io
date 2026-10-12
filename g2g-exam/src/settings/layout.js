export const LAYOUT_DEFAULTS={contentWidth:1600,cardRadius:24,background:'neutral'};
export const LAYOUT_CHOICES={contentWidth:[1200,1400,1600,1800],cardRadius:[12,16,20,24,28],background:['neutral','warm','cool']};
export function normalizeLayout(input={}){
  return Object.fromEntries(Object.entries(LAYOUT_DEFAULTS).map(([key,fallback])=>[key,LAYOUT_CHOICES[key].includes(input[key])?input[key]:fallback]));
}
export function layoutVariables(input={}){
  const theme=normalizeLayout(input);
  return {'--max':theme.contentWidth+'px','--r':theme.cardRadius+'px','--nen':{neutral:'#f4f5f6',warm:'#f7f5f0',cool:'#f0f5f7'}[theme.background]};
}
