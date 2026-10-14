#!/usr/bin/env bash
# Runs only against the disposable loopback CI PostgreSQL service.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${PGHOST:-}" == 127.0.0.1 ]] || { echo 'Requires disposable GitHub Actions service' >&2; exit 1; }
export PATH="/usr/lib/postgresql/16/bin:$PATH"
root="$(mktemp -d)"
trap 'rm -rf -- "$root"' EXIT
mkdir -p "$root"/{uploads,deployment,control,work,remote}
createdb g2g_backup_fixture
createdb g2g_restore_fixture
psql -v ON_ERROR_STOP=1 -d g2g_backup_fixture <<'SQL'
CREATE TABLE exams(id text PRIMARY KEY, title text);
CREATE TABLE attempts(id text PRIMARY KEY, exam_id text REFERENCES exams(id), answer text);
CREATE TABLE media(name text PRIMARY KEY);
INSERT INTO exams VALUES ('sample','Isolated G2G Exam');
INSERT INTO attempts VALUES ('attempt','sample','Antwort äöü');
INSERT INTO media VALUES ('sample.mp3'),('image.png');
SQL
printf 'isolated audio bytes' > "$root/uploads/sample.mp3"
printf 'isolated image bytes' > "$root/uploads/image.png"
printf 'services: {}\n' > "$root/deployment/compose.yml"
age-keygen -o "$root/identity" 2>/dev/null
export DATABASE_URL='postgresql://postgres@127.0.0.1:5432/g2g_backup_fixture'
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
[[ "$(psql -At -d g2g_restore_fixture -c 'SELECT answer FROM attempts')" == 'Antwort äöü' ]]
while IFS= read -r media; do cmp "$root/uploads/$media" "$root/staging/uploads/$media"; done < <(psql -At -d g2g_restore_fixture -c 'SELECT name FROM media')
age-keygen -o "$root/wrong-identity" 2>/dev/null
if BACKUP_AGE_IDENTITY="$root/wrong-identity" bash scripts/backup/restore.sh "$archive" "$root/wrong"; then exit 1; fi
[[ ! -e "$root/wrong" ]]
cp "$archive" "$root/tampered.age"
printf 'tampered' >> "$root/tampered.age"
if BACKUP_AGE_IDENTITY="$root/identity" bash scripts/backup/restore.sh "$root/tampered.age" "$root/tampered"; then exit 1; fi
[[ ! -e "$root/tampered" ]]
echo 'REAL_ISOLATED_RESTORE_OK: PostgreSQL 16, age, media SHA-256, local Rclone. Google Drive NOT tested.'
