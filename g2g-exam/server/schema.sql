CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','master')),
  active boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active',
  locked boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_owner_idx ON questions(owner_id);

CREATE TABLE IF NOT EXISTS exams (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'draft',
  locked boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exams_owner_idx ON exams(owner_id);
CREATE INDEX IF NOT EXISTS exams_status_idx ON exams(status);

ALTER TABLE exams ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
UPDATE exams SET trashed_at=updated_at WHERE status='trash' AND trashed_at IS NULL;
UPDATE questions SET trashed_at=updated_at WHERE status='trash' AND trashed_at IS NULL;
CREATE OR REPLACE FUNCTION track_trash_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status<>'trash' THEN NEW.trashed_at=NULL;
  ELSIF TG_OP='INSERT' THEN NEW.trashed_at=now();
  ELSIF OLD.status<>'trash' THEN NEW.trashed_at=now();
  ELSE NEW.trashed_at=OLD.trashed_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS exams_trash_time ON exams;
CREATE TRIGGER exams_trash_time BEFORE INSERT OR UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION track_trash_time();
DROP TRIGGER IF EXISTS questions_trash_time ON questions;
CREATE TRIGGER questions_trash_time BEFORE INSERT OR UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION track_trash_time();


CREATE TABLE IF NOT EXISTS attempts (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES users(id),
  exam_id text NOT NULL REFERENCES exams(id),
  status text NOT NULL,
  attempt_no integer NOT NULL,
  public_data jsonb NOT NULL,
  private_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, exam_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS attempts_student_idx ON attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_exam_idx ON attempts(exam_id);
CREATE INDEX IF NOT EXISTS attempts_status_idx ON attempts(status);

CREATE TABLE IF NOT EXISTS exam_codes (
  id text PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  code text,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exam_code_uses (
  code_id text NOT NULL REFERENCES exam_codes(id),
  student_id text NOT NULL REFERENCES users(id),
  attempt_id text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(code_id,student_id)
);
CREATE INDEX IF NOT EXISTS exam_codes_expiry_idx ON exam_codes(expires_at) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS exam_codes_exam_idx ON exam_codes(exam_id,expires_at);
CREATE TABLE IF NOT EXISTS exam_code_checks (
  student_id text PRIMARY KEY REFERENCES users(id),
  window_at timestamptz NOT NULL DEFAULT now(),
  checks integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS level_promotions (
  attempt_id text PRIMARY KEY REFERENCES attempts(id),
  student_id text NOT NULL REFERENCES users(id),
  from_level text NOT NULL,
  to_level text NOT NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grading_requests (
  id text PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES users(id),
  requester_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grading_exam_idx ON grading_requests(exam_id);
CREATE INDEX IF NOT EXISTS grading_requester_idx ON grading_requests(requester_id);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES users(id),
  attempt_id text REFERENCES attempts(id),
  status text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_student_idx ON notifications(student_id);

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS secrets (
  key text PRIMARY KEY,
  value_enc text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_log(at DESC);

CREATE TABLE IF NOT EXISTS classes (
  id text PRIMARY KEY,
  code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS classes_code_idx ON classes(lower(code));
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_ids text[] NOT NULL DEFAULT '{}';

-- Extend is a system-owned default class, not owned by a teacher account.
ALTER TABLE classes ALTER COLUMN created_by DROP NOT NULL;
INSERT INTO classes(id,code,description) VALUES('class-extend','Extend','Học viên ngoài')
  ON CONFLICT DO NOTHING;
UPDATE classes SET active=true,code='Extend' WHERE lower(code)='extend';
UPDATE users SET data=data||jsonb_build_object('classId',(SELECT id FROM classes WHERE lower(code)='extend'))
  WHERE role='student' AND NOT EXISTS(SELECT 1 FROM classes WHERE id=users.data->>'classId');
UPDATE users SET data=data||jsonb_build_object('level',CASE WHEN data->>'level' ~ '^[ABC][12](\.[12])?$' THEN split_part(data->>'level','.',1) ELSE 'A1' END)
  WHERE role='student' AND coalesce(data->>'level','') NOT IN ('A1','A2','B1','B2','C1','C2');
UPDATE exams SET data=data||jsonb_build_object('learningLevel',split_part(coalesce(nullif(data->>'learningLevel',''),data->>'level'),'.',1))
  WHERE coalesce(data->>'learningLevel','') NOT IN ('A1','A2','B1','B2','C1','C2')
  AND coalesce(nullif(data->>'learningLevel',''),data->>'level') ~ '^[ABC][12](\.[12])?$';

CREATE TABLE IF NOT EXISTS class_confirmation_codes (
  student_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9]{5}$'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS class_code_checks (
  student_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  checks integer NOT NULL DEFAULT 1,
  window_at timestamptz NOT NULL DEFAULT now()
);

-- Lượt thi bỏ dở không phải là lịch sử làm bài và không được lưu lâu dài.
DELETE FROM notifications WHERE attempt_id IN (SELECT id FROM attempts WHERE status='abandoned');
DELETE FROM attempts WHERE status='abandoned';
