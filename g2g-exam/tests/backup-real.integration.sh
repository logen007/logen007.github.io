#!/usr/bin/env bash
# Runs only against the disposable loopback CI PostgreSQL service.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${PGHOST:-}" == 127.0.0.1 || "${G2G_BACKUP_DISPOSABLE:-}" == true && "${PGHOST:-}" == /*/g2g-pg-drill.*/socket ]] || { echo 'Requires disposable GitHub service or an isolated local cluster' >&2; exit 1; }
export PATH="/usr/lib/postgresql/16/bin:$PATH"
root="$(mktemp -d)"
trap 'rm -rf -- "$root"' EXIT
mkdir -p "$root"/{uploads,deployment,control,work,remote}
createdb g2g_backup_fixture
createdb g2g_restore_fixture
psql -v ON_ERROR_STOP=1 -d g2g_backup_fixture -f server/schema.sql >/dev/null
psql -v ON_ERROR_STOP=1 -d g2g_backup_fixture <<'SQL'
INSERT INTO users(id,email,role,data) VALUES ('owner','owner@example.test','master','{"name":"Owner"}'),('student','student@example.test','student','{"name":"Student"}');
INSERT INTO questions(id,owner_id,data) VALUES ('q1','owner','{"prompt":"Isolated image","imageUrl":"/uploads/image.png","audioUrl":"/uploads/sample.mp3"}');
INSERT INTO exams(id,owner_id,data) VALUES ('sample','owner','{"title":"Isolated G2G Exam","sections":[{"questionIds":["q1"]}]}');
INSERT INTO attempts(id,student_id,exam_id,status,attempt_no,public_data) VALUES ('attempt','student','sample','published',1,'{"answers":{"q1":"Antwort äöü"}}');
INSERT INTO settings(id,data) VALUES ('global','{"general":{"systemName":"G2G Exam drill"}}');
CREATE TABLE media(name text PRIMARY KEY);
INSERT INTO media VALUES ('sample.mp3'),('image.png');
SQL
printf 'isolated audio bytes' > "$root/uploads/sample.mp3"
printf 'isolated image bytes' > "$root/uploads/image.png"
printf 'services: {}\n' > "$root/deployment/compose.yml"
age-keygen -o "$root/identity" 2>/dev/null
export DATABASE_URL="postgresql://postgres@/g2g_backup_fixture?host=${PGHOST}&port=${PGPORT:-5432}"
export BACKUP_MEDIA_GUARD_ENABLED=true
node tests/backup-media-lock.integration.mjs
export UPLOAD_DIR="$root/uploads" BACKUP_DEPLOY_DIR="$root/deployment"
export BACKUP_CONTROL_DIR="$root/control" BACKUP_WORKDIR="$root/work"
export BACKUP_RCLONE_REMOTE=":local:$root/remote" BACKUP_GIT_COMMIT="$(git rev-parse HEAD)"
export BACKUP_AGE_RECIPIENT="$(age-keygen -y "$root/identity")"
bash scripts/backup/backup.sh
archive="$(find "$root/remote/daily" -name '*.age' -type f)"
[[ -f "$archive" ]]
BACKUP_AGE_IDENTITY="$root/identity" bash scripts/backup/restore.sh "$archive" "$root/staging"
pg_restore --exit-on-error --no-owner --no-acl --dbname=g2g_restore_fixture "$root/staging/database.dump"
[[ "$(psql -At -d g2g_restore_fixture -c 'SELECT count(*) FROM attempts JOIN exams ON exams.id=attempts.exam_id')" == 1 ]]
[[ "$(psql -At -d g2g_restore_fixture -c "SELECT public_data#>>'{answers,q1}' FROM attempts")" == 'Antwort äöü' ]]
[[ "$(psql -At -d g2g_restore_fixture -c "SELECT role FROM users WHERE id='owner'")" == master ]]
[[ "$(psql -At -d g2g_restore_fixture -c "SELECT data#>>'{general,systemName}' FROM settings WHERE id='global'")" == 'G2G Exam drill' ]]
while IFS= read -r media; do cmp "$root/uploads/$media" "$root/staging/uploads/$media"; done < <(psql -At -d g2g_restore_fixture -c 'SELECT name FROM media')
age-keygen -o "$root/wrong-identity" 2>/dev/null
if BACKUP_AGE_IDENTITY="$root/wrong-identity" bash scripts/backup/restore.sh "$archive" "$root/wrong"; then exit 1; fi
[[ ! -e "$root/wrong" ]]
cp "$archive" "$root/tampered.age"
printf 'tampered' >> "$root/tampered.age"
if BACKUP_AGE_IDENTITY="$root/identity" bash scripts/backup/restore.sh "$root/tampered.age" "$root/tampered"; then exit 1; fi
[[ ! -e "$root/tampered" ]]
echo 'REAL_ISOLATED_RESTORE_OK: PostgreSQL 16, age, media SHA-256, local Rclone. Google Drive NOT tested.'
