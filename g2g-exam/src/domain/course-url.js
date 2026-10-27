export function normalizeCourseSlug(value){
  const slug=String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  if(slug&&(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80))throw new Error('URL dùng chữ, số và dấu gạch ngang, tối đa 80 ký tự.');
  return slug;
}
export function courseUrlPath(slug){return '/khoa-hoc/'+encodeURIComponent(normalizeCourseSlug(slug));}
export function courseUrlSlug(pathname){return /^\/khoa-hoc\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname)?.[1]||'';}

export function courseSlugFromTitle(title){
  return String(title??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'');
}
