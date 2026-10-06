export const PRIMARY_MASTER_EMAIL='tranc333@gmail.com';

export function normalizeEmail(value=''){
  return String(value||'').trim().toLowerCase();
}

export function isPrimaryMasterEmail(value=''){
  return normalizeEmail(value)===PRIMARY_MASTER_EMAIL;
}
