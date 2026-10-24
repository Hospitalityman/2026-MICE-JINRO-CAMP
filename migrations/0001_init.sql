-- 프로그램(차시 x 학과) 6개
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  session INTEGER NOT NULL,            -- 1,2,3 (차시)
  dept TEXT NOT NULL,                  -- 'tour' | 'cook'
  capacity INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'open'  -- open | cancelled(폐강) | closed(마감)
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,                 -- 숫자만
  email TEXT,
  school TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 3,
  class_no INTEGER,
  student_no INTEGER,
  grade_pct REAL,                      -- 예상 내신 (상위 %)
  guardian_name TEXT,
  guardian_phone TEXT,
  teacher_name TEXT,
  teacher_phone TEXT,
  allergy TEXT NOT NULL DEFAULT '',    -- 빈 문자열 = 없음
  uniform_ok INTEGER NOT NULL DEFAULT 0,
  consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,                -- confirmed | waiting | cancelled
  attended INTEGER NOT NULL DEFAULT 0,
  attended_at TEXT,
  is_manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT,                   -- self | admin
  promoted_at TEXT,
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- 1인 1회: 활성(확정/대기) 신청은 이름+휴대폰 중복 불가 (DB 레벨에서 원자적으로 보장)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_person
  ON registrations(name, phone) WHERE status IN ('confirmed','waiting');
CREATE INDEX IF NOT EXISTS idx_reg_program_status ON registrations(program_id, status, id);
CREATE INDEX IF NOT EXISTS idx_reg_lookup ON registrations(name, phone);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_fail (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO programs (id, session, dept, capacity, status) VALUES
  (1,1,'tour',30,'open'),(2,1,'cook',30,'open'),
  (3,2,'tour',30,'open'),(4,2,'cook',30,'open'),
  (5,3,'tour',30,'open'),(6,3,'cook',30,'open');

INSERT OR IGNORE INTO settings (key, value) VALUES ('apply_open','1');
