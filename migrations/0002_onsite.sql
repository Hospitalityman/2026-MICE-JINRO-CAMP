-- 현장 등록(행사 당일 현장에서 등록한 학생) 구분
ALTER TABLE registrations ADD COLUMN is_onsite INTEGER NOT NULL DEFAULT 0;
