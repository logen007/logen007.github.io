// Shared outline icons: the control owns its border, size and interaction state.
const paths={
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  student:'<path d="m2 8 10-5 10 5-10 5-10-5ZM6 10v6c4 3 8 3 12 0v-6M22 8v8"/>',
  teacher:'<rect x="8" y="3" width="13" height="12" rx="2"/><circle cx="5" cy="11" r="3"/><path d="M1 21v-3a4 4 0 0 1 8 0v3M14 19h5M16 15v4"/>',
  admin:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  publish:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  unpublish:'<path d="M12 4v12M7 11l5 5 5-5M4 16v4h16v-4"/>',
  exams:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  grading:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5ZM13 20h7"/>',
  grades:'<path d="M4 20h16M7 16v-5M12 16V5M17 16V8"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  settings:'<path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-2v-3L20.5 9l-2-3-2 .5-2-1L14 3Z"/><circle cx="11.5" cy="12" r="3"/>',
  logout:'<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h12"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  example:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
};

export function iconHtml(name){
  return `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.exams}</svg>`;
}
