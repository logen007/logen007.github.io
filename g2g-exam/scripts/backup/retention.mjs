const FILE = /^g2g-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.tar\.gz\.age$/;
export function parseArchive(name) {
  const m = FILE.exec(name);
  if (!m) return null;
  const [y,mo,d,h,mi,s] = m.slice(1).map(Number);
  const timestamp = Date.UTC(y,mo-1,d,h,mi,s);
  const date = new Date(timestamp);
  if (date.getUTCFullYear()!==y || date.getUTCMonth()!==mo-1 || date.getUTCDate()!==d || date.getUTCHours()!==h || date.getUTCMinutes()!==mi || date.getUTCSeconds()!==s) return null;
  return timestamp;
}
export function retention(names, count) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Invalid retention');
  const valid = [...new Set(names)].filter(name=>parseArchive(name)!==null).sort();
  return { keep:valid.slice(-count), remove:valid.slice(0,Math.max(0,valid.length-count)) };
}
export function monthlyDue(latestName, now=Date.now()) {
  if (!latestName) return true;
  const time = parseArchive(latestName);
  if (time===null || now<time) return false;
  return now-time>=30*86400000;
}
