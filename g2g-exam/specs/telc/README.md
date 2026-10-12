# Shared TELC B1/B2 structure

APPROVED by the user on 2026-10-12: TELC B2 uses exactly the same structure as
TELC B1. The single source of truth for both levels is b1/exam.json and its
referenced parts. src/exam-specs/telc.js reuses the resolved specification and
changes only the level identity to B2; do not copy the part files.

Existing authored custom exams are preserved by the exam factory's migration
guard. Shared standard scoring is defined once in scoring.js.
