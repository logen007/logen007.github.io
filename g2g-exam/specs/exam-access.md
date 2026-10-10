# Exam access and advancement — APPROVED

Approved by the user on 2026-10-10. Applies to both providers without changing Part specifications.

- Hidden exams remain listed; a valid five-character code is required to start.
- Each student can start once per code. Abandoning/deleting an attempt never restores that use.
- Multiple codes can belong to one exam. Expiry blocks new starts, not active attempts.
- Expired code text is removed; internal use records survive for audit and enforcement.
- Updated by the user: learning levels are A1, A2, B1, B2, C1, C2 only.
- A complete, published passing outcome sets the student level to the exam learning level, not the next level. This is an exact assignment, including a lower exam level.
- Apply each passing attempt once, including when its level already matches the student's level.
- Legacy sublevels normalize to their base level. Exams without a selected learning level use their format level.
- Results, promotion messages and emails share the same calculated outcome.

## Student registration and class enrollment — APPROVED

- New students start at A1 in the reserved Extend class (external students).
- Full name must be explicitly entered before starting an exam. Registration cannot select another class or change level.
- Existing assigned classes are preserved; missing classes default to Extend.
- Teachers see Extend students, search by name/email, and a random five-character confirmation code for each student.
- Confirmation codes are separate from exam access codes, bound to the authoritative student ID and email, and are never included in student state.
- The student verifies their code, then chooses an active non-Extend class. Final enrollment revalidates and consumes the code atomically.
- Each class code opens its roster. Teachers can still manage class assignments; proficiency is outcome-controlled.
