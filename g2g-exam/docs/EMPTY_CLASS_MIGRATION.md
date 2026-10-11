# Empty class membership

No class is represented by JSON null, not the legacy Extend class.
New accounts and initial profiles start without a class. Staff can clear the
class picker and save; unknown nonempty codes remain invalid. Confirmation
codes continue to work for students without a class.

Deployment runs the idempotent schema migration before serving the new app:
record legacy memberships in retired_external_memberships, set those student
classIds to null, and deactivate Extend. It does not delete users, attempts,
results, class history or confirmation codes. Repeated runs do not modify
students assigned to a real class. Old browser tabs should reload.

Rollback requires a coordinated app/schema rollback: restore the previous
schema initialization, reactivate the retired class, and use
retired_external_memberships (or the pre-deployment database backup) to restore
membership only for students still without a real class. Do not overwrite
subsequent class assignments. Keep the archive until rollback is no longer
needed; permanent deletion is not part of this change.
