// APPROVED 2026-10-10: user confirmed official Deutsch B1/B2 scoring.
// Sources: telc Deutsch B1 Übungstest 1 pp.39–40; B2 pp.45–46.
// Applies only to standard B1/B2, not dual-level or vocational formats.
export const TELC_SCORING = Object.freeze({
  status:'APPROVED', levels:['B1','B2'],
  written:{reading:75,grammar:30,listening:75,writing:45},
  writtenMax:225,writtenPass:135,oralMax:75,oralPass:45,totalMax:300,
});
