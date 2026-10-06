import crypto from 'node:crypto';

const PRIMARY_MASTER_EMAIL_SHA256='e802ce6146d50e7a59ab34cab880877e5224abc151870943da414327177e2015';

export function normalizeEmail(value=''){
  return String(value||'').trim().toLowerCase();
}

export function isPrimaryMasterEmail(value=''){
  const hash=crypto.createHash('sha256').update(normalizeEmail(value)).digest('hex');
  return hash===PRIMARY_MASTER_EMAIL_SHA256;
}
