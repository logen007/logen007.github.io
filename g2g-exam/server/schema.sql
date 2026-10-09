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

-- Lượt thi bỏ dở không phải là lịch sử làm bài và không được lưu lâu dài.
DELETE FROM notifications WHERE attempt_id IN (SELECT id FROM attempts WHERE status='abandoned');
DELETE FROM attempts WHERE status='abandoned';
