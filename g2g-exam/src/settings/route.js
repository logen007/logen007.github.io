const validTabs=new Set(['general','access','email','advanced']);
export const normalizeSettingsTab=value=>validTabs.has(value)?value:'general';
export function settingsRouteTab(href){
  const url=new URL(href||'https://local.invalid/');
  return url.searchParams.get('tab')==='settings'?normalizeSettingsTab(url.searchParams.get('settings')):null;
}
export function writeSettingsRoute(url,tab){
  url.searchParams.set('tab','settings');url.searchParams.set('settings',normalizeSettingsTab(tab));
  return url;
}
export function settingsHref(tab,href=globalThis.location?.href){
  const url=new URL(href||'https://local.invalid/adm');
  for(const key of ['edit','preview','section','view','attempt','class'])url.searchParams.delete(key);
  writeSettingsRoute(url,tab);
  return url.pathname+url.search+url.hash;
}
