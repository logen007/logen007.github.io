// Compatibility barrel: existing imports can keep using ./core.js while domain logic
// lives in small focused modules under ./domain/.
export * from './domain/base.js';
export * from './domain/questions.js';
export * from './domain/exams.js';
export * from './domain/attempts.js';
