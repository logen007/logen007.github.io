export const APP_CONFIG={
  version:4,
  storageKey:'g2g.exam.v4',
  storageRevisionKey:'g2g.exam.v4.rev',
  autosaveMs:2500,
  defaultPassScore:180,
  locale:'vi-VN',
  examBrand:'G2G Thi thử',
};

export function hasApiBackend(){
  return Boolean(globalThis.G2G_API_BASE);
}
