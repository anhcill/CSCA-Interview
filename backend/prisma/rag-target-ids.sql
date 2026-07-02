ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS major_id UUID,
  ADD COLUMN IF NOT EXISTS scholarship_id UUID;

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS school_id UUID,
  ADD COLUMN IF NOT EXISTS major_id UUID,
  ADD COLUMN IF NOT EXISTS scholarship_id UUID;

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_major_id ON user_profiles(major_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_scholarship_id ON user_profiles(scholarship_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_school_id ON interview_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_major_id ON interview_sessions(major_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_scholarship_id ON interview_sessions(scholarship_id);

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_school_id FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_major_id FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_scholarship_id FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE interview_sessions
    ADD CONSTRAINT fk_interview_sessions_school_id FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE interview_sessions
    ADD CONSTRAINT fk_interview_sessions_major_id FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE interview_sessions
    ADD CONSTRAINT fk_interview_sessions_scholarship_id FOREIGN KEY (scholarship_id) REFERENCES scholarships(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
