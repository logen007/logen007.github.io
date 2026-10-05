export const APP_CONFIG = {
  version: 3,
  storageKey: 'g2g.exam.v3',
  storageRevisionKey: 'g2g.exam.v3.rev',
  autosaveMs: 2500,
  backend: 'auto',
  firebaseConfig: () => (globalThis.G2G_FIREBASE_CONFIG || null),
  functionsRegion: 'asia-southeast1',
  emailCollection: 'mail',
  defaultPassScore: 180,
  locale: 'vi-VN',
  examBrand: 'G2G Thi thử',
};

export function isFirebaseConfigured() {
  const cfg = APP_CONFIG.firebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.authDomain);
}
