export const APP_CONFIG = {
  version: 2,
  storageKey: 'g2g.exam.v2',
  storageRevisionKey: 'g2g.exam.v2.rev',
  autosaveMs: 2500,
  backend: 'auto',
  firebaseConfig: () => (globalThis.G2G_FIREBASE_CONFIG || null),
  emailCollection: 'mail',
  defaultPassScore: 180,
  locale: 'vi-VN',
  examBrand: 'G2G Thi thử',
};

export function isFirebaseConfigured() {
  const cfg = APP_CONFIG.firebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.authDomain);
}
