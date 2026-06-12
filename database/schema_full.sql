-- ============================================================
-- Database schema: AI Phỏng Vấn Du Học Trung Quốc
-- Loại CSDL: PostgreSQL
-- Mục tiêu: schema đầy đủ cho MVP + khả năng mở rộng giai đoạn sau
-- Ngày tạo: 2026-05-29
-- ============================================================

-- Ẩn các NOTICE không quan trọng khi chạy lại file nhiều lần,
-- ví dụ: trigger chưa tồn tại nên DROP TRIGGER IF EXISTS bỏ qua.
SET client_min_messages TO WARNING;

-- ============================================================
-- 1. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. Enum types
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'degree_level') THEN
    CREATE TYPE degree_level AS ENUM ('BACHELOR', 'MASTER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_category') THEN
    CREATE TYPE question_category AS ENUM (
      'PERSONAL',
      'ACADEMIC',
      'STUDY_PLAN',
      'SCHOLARSHIP',
      'CAREER_PLAN',
      'LANGUAGE',
      'SITUATION',
      'RESEARCH',
      'SCHOOL_MAJOR',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
    CREATE TYPE difficulty_level AS ENUM ('EASY', 'MEDIUM', 'HARD');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language_code') THEN
    CREATE TYPE language_code AS ENUM ('VI', 'ZH', 'EN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_mode') THEN
    CREATE TYPE interview_mode AS ENUM ('PRACTICE', 'MOCK_TEST', 'SCORING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_status') THEN
    CREATE TYPE interview_status AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAUSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_source') THEN
    CREATE TYPE question_source AS ENUM ('ADMIN_BANK', 'AI_GENERATED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audio_source') THEN
    CREATE TYPE audio_source AS ENUM ('AI_TTS', 'HUMAN_RECORDED', 'USER_RECORDING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_task_type') THEN
    CREATE TYPE ai_task_type AS ENUM (
      'GENERATE_QUESTIONS',
      'ANALYZE_STUDY_PLAN',
      'EXPLAIN_QUESTION',
      'SCORE_ANSWER',
      'GENERATE_REPORT',
      'IMPROVE_ANSWER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admission_season_status') THEN
    CREATE TYPE admission_season_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE subscription_plan AS ENUM ('FREE', 'STANDARD', 'PREMIUM', 'CENTER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');
  END IF;
END $$;

-- ============================================================
-- 3. Common trigger: tự động cập nhật updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Người dùng, xác thực, phân quyền
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'USER',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'Tài khoản người dùng, admin và super admin.';
COMMENT ON COLUMN users.password_hash IS 'Mật khẩu đã hash bằng bcrypt/argon2, không lưu mật khẩu thô.';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete, giữ dữ liệu để đối soát lịch sử nếu cần.';

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auth_sessions IS 'Phiên đăng nhập/refresh token của người dùng.';

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- ============================================================
-- 5. Hồ sơ apply du học của người dùng
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age INT CHECK (age IS NULL OR age BETWEEN 10 AND 80),
  degree_level degree_level NOT NULL,
  target_school VARCHAR(255) NOT NULL,
  target_major VARCHAR(255) NOT NULL,
  scholarship_type VARCHAR(255) NOT NULL,
  hsk_level VARCHAR(50),
  hskk_level VARCHAR(50),
  ielts_score VARCHAR(50),
  toefl_score VARCHAR(50),
  gpa VARCHAR(50),
  awards TEXT,
  research_experience TEXT,
  extracurricular_activities TEXT,
  work_experience TEXT,
  study_plan TEXT NOT NULL,
  career_plan TEXT,
  strengths TEXT,
  weaknesses TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Hồ sơ apply du học dùng làm đầu vào tạo buổi phỏng vấn.';
COMMENT ON COLUMN user_profiles.study_plan IS 'Kế hoạch học tập của người dùng, dùng để AI phân tích và tạo câu hỏi.';

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_profiles_degree_level ON user_profiles(degree_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_target_school ON user_profiles(target_school);
CREATE INDEX IF NOT EXISTS idx_user_profiles_target_major ON user_profiles(target_major);

-- ============================================================
-- 6. Mùa tuyển sinh, trường, ngành, học bổng
-- ============================================================

CREATE TABLE IF NOT EXISTS admission_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  admission_year INT NOT NULL CHECK (admission_year BETWEEN 2000 AND 2100),
  status admission_season_status NOT NULL DEFAULT 'DRAFT',
  starts_at DATE,
  ends_at DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, admission_year)
);

COMMENT ON TABLE admission_seasons IS 'Mùa tuyển sinh, ví dụ: CSC 2026, học bổng trường kỳ mùa thu 2026.';

DROP TRIGGER IF EXISTS trg_admission_seasons_updated_at ON admission_seasons;
CREATE TRIGGER trg_admission_seasons_updated_at
BEFORE UPDATE ON admission_seasons
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  name_zh VARCHAR(255),
  name_en VARCHAR(255),
  city VARCHAR(120),
  province VARCHAR(120),
  website_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE schools IS 'Danh mục trường đại học Trung Quốc.';

DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;
CREATE TRIGGER trg_schools_updated_at
BEFORE UPDATE ON schools
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_schools_city ON schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_province ON schools(province);
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);

CREATE TABLE IF NOT EXISTS majors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name_zh VARCHAR(255),
  name_en VARCHAR(255),
  degree_level degree_level NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, degree_level)
);

COMMENT ON TABLE majors IS 'Danh mục ngành học theo hệ đại học/thạc sĩ.';

DROP TRIGGER IF EXISTS trg_majors_updated_at ON majors;
CREATE TRIGGER trg_majors_updated_at
BEFORE UPDATE ON majors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_majors_degree_level ON majors(degree_level);
CREATE INDEX IF NOT EXISTS idx_majors_is_active ON majors(is_active);

CREATE TABLE IF NOT EXISTS scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(80),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scholarships IS 'Danh mục học bổng: CSC, CIS, học bổng tỉnh, học bổng trường, tự túc.';

DROP TRIGGER IF EXISTS trg_scholarships_updated_at ON scholarships;
CREATE TRIGGER trg_scholarships_updated_at
BEFORE UPDATE ON scholarships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_scholarships_is_active ON scholarships(is_active);

CREATE TABLE IF NOT EXISTS school_majors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  major_id UUID NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  admission_season_id UUID REFERENCES admission_seasons(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, major_id, admission_season_id)
);

COMMENT ON TABLE school_majors IS 'Ngành nào được mở ở trường nào theo từng mùa tuyển sinh.';

CREATE INDEX IF NOT EXISTS idx_school_majors_school_id ON school_majors(school_id);
CREATE INDEX IF NOT EXISTS idx_school_majors_major_id ON school_majors(major_id);

CREATE TABLE IF NOT EXISTS school_scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  scholarship_id UUID NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  admission_season_id UUID REFERENCES admission_seasons(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, scholarship_id, admission_season_id)
);

COMMENT ON TABLE school_scholarships IS 'Học bổng nào áp dụng cho trường nào theo từng mùa tuyển sinh.';

CREATE INDEX IF NOT EXISTS idx_school_scholarships_school_id ON school_scholarships(school_id);
CREATE INDEX IF NOT EXISTS idx_school_scholarships_scholarship_id ON school_scholarships(scholarship_id);

-- ============================================================
-- 7. Kho câu hỏi phỏng vấn
-- ============================================================

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  degree_level degree_level,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  major_id UUID REFERENCES majors(id) ON DELETE SET NULL,
  scholarship_id UUID REFERENCES scholarships(id) ON DELETE SET NULL,
  admission_season_id UUID REFERENCES admission_seasons(id) ON DELETE SET NULL,
  category question_category NOT NULL DEFAULT 'OTHER',
  difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
  language language_code NOT NULL DEFAULT 'VI',
  question_text TEXT NOT NULL,
  suggested_answer_logic TEXT,
  sample_answer TEXT,
  keywords TEXT,
  common_mistakes TEXT,
  scoring_rubric JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE questions IS 'Kho câu hỏi do admin nhập, có thể lọc theo hệ/trường/ngành/học bổng.';
COMMENT ON COLUMN questions.scoring_rubric IS 'Rubric chấm điểm dạng JSON, ví dụ: logic, relevance, language, confidence.';
COMMENT ON COLUMN questions.keywords IS 'Từ khóa nên xuất hiện trong câu trả lời.';
COMMENT ON COLUMN questions.common_mistakes IS 'Các lỗi trả lời thường gặp.';

DROP TRIGGER IF EXISTS trg_questions_updated_at ON questions;
CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_questions_degree_level ON questions(degree_level);
CREATE INDEX IF NOT EXISTS idx_questions_school_id ON questions(school_id);
CREATE INDEX IF NOT EXISTS idx_questions_major_id ON questions(major_id);
CREATE INDEX IF NOT EXISTS idx_questions_scholarship_id ON questions(scholarship_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language);
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_text_search ON questions USING GIN (to_tsvector('simple', question_text));

CREATE TABLE IF NOT EXISTS question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE question_tags IS 'Tag tự do cho câu hỏi, ví dụ: CSC, study_plan, research, motivation.';

CREATE TABLE IF NOT EXISTS question_tag_links (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES question_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_question_tag_links_tag_id ON question_tag_links(tag_id);

CREATE TABLE IF NOT EXISTS question_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language language_code NOT NULL,
  source audio_source NOT NULL,
  voice_name VARCHAR(120),
  file_url TEXT NOT NULL,
  duration_seconds NUMERIC(10, 2),
  transcript TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE question_audios IS 'Audio đọc câu hỏi bằng giọng AI hoặc giọng người thật.';

CREATE INDEX IF NOT EXISTS idx_question_audios_question_id ON question_audios(question_id);
CREATE INDEX IF NOT EXISTS idx_question_audios_language ON question_audios(language);

-- ============================================================
-- 8. Prompt AI, log AI và phân tích study plan
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type ai_task_type NOT NULL,
  name VARCHAR(150) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  output_schema JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_type, name, version)
);

COMMENT ON TABLE ai_prompt_templates IS 'Template prompt dùng cho từng tác vụ AI.';

DROP TRIGGER IF EXISTS trg_ai_prompt_templates_updated_at ON ai_prompt_templates;
CREATE TRIGGER trg_ai_prompt_templates_updated_at
BEFORE UPDATE ON ai_prompt_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_task_type ON ai_prompt_templates(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_is_active ON ai_prompt_templates(is_active);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_type ai_task_type NOT NULL,
  provider VARCHAR(80) NOT NULL,
  model VARCHAR(120),
  prompt_template_id UUID REFERENCES ai_prompt_templates(id) ON DELETE SET NULL,
  request_payload JSONB,
  response_payload JSONB,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  cost_usd NUMERIC(12, 6),
  latency_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_usage_logs IS 'Log chi phí, token, request/response và lỗi khi gọi AI.';

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_task_type ON ai_usage_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);

CREATE TABLE IF NOT EXISTS study_plan_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  ai_usage_log_id UUID REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
  strengths TEXT,
  weaknesses TEXT,
  missing_points TEXT,
  suggested_improvements TEXT,
  generated_questions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE study_plan_analyses IS 'Kết quả AI phân tích kế hoạch học tập của người dùng.';

CREATE INDEX IF NOT EXISTS idx_study_plan_analyses_user_id ON study_plan_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_analyses_profile_id ON study_plan_analyses(profile_id);

-- ============================================================
-- 9. Phòng phỏng vấn, câu hỏi trong session, câu trả lời
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  mode interview_mode NOT NULL DEFAULT 'PRACTICE',
  language language_code NOT NULL DEFAULT 'VI',
  status interview_status NOT NULL DEFAULT 'DRAFT',
  degree_level degree_level,
  target_school VARCHAR(255),
  target_major VARCHAR(255),
  scholarship_type VARCHAR(255),
  total_questions INT NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  answered_questions INT NOT NULL DEFAULT 0 CHECK (answered_questions >= 0),
  total_score NUMERIC(5, 2) CHECK (total_score IS NULL OR total_score BETWEEN 0 AND 100),
  summary_feedback TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE interview_sessions IS 'Một buổi phỏng vấn ảo của người dùng.';
COMMENT ON COLUMN interview_sessions.mode IS 'PRACTICE: có gợi ý, MOCK_TEST: thi thử, SCORING: tập trung chấm điểm.';

DROP TRIGGER IF EXISTS trg_interview_sessions_updated_at ON interview_sessions;
CREATE TRIGGER trg_interview_sessions_updated_at
BEFORE UPDATE ON interview_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_profile_id ON interview_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at ON interview_sessions(created_at);

CREATE TABLE IF NOT EXISTS interview_session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  source question_source NOT NULL,
  order_index INT NOT NULL CHECK (order_index >= 1),
  question_text TEXT NOT NULL,
  category question_category NOT NULL DEFAULT 'OTHER',
  difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
  language language_code NOT NULL DEFAULT 'VI',
  ai_reason TEXT,
  expected_answer_logic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, order_index)
);

COMMENT ON TABLE interview_session_questions IS 'Danh sách câu hỏi đã được chốt cho một buổi phỏng vấn.';
COMMENT ON COLUMN interview_session_questions.ai_reason IS 'Lý do AI chọn/tạo câu hỏi này dựa trên profile.';

CREATE INDEX IF NOT EXISTS idx_interview_session_questions_session_id ON interview_session_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_session_questions_question_id ON interview_session_questions(question_id);

CREATE TABLE IF NOT EXISTS interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  session_question_id UUID NOT NULL REFERENCES interview_session_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_audio_url TEXT,
  speech_to_text_raw TEXT,
  score_total NUMERIC(5, 2) CHECK (score_total IS NULL OR score_total BETWEEN 0 AND 100),
  score_relevance NUMERIC(5, 2) CHECK (score_relevance IS NULL OR score_relevance BETWEEN 0 AND 100),
  score_logic NUMERIC(5, 2) CHECK (score_logic IS NULL OR score_logic BETWEEN 0 AND 100),
  score_specificity NUMERIC(5, 2) CHECK (score_specificity IS NULL OR score_specificity BETWEEN 0 AND 100),
  score_language NUMERIC(5, 2) CHECK (score_language IS NULL OR score_language BETWEEN 0 AND 100),
  feedback TEXT,
  strengths TEXT,
  weaknesses TEXT,
  improved_answer TEXT,
  ai_usage_log_id UUID REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, session_question_id)
);

COMMENT ON TABLE interview_answers IS 'Câu trả lời của người dùng và kết quả chấm điểm AI.';
COMMENT ON COLUMN interview_answers.speech_to_text_raw IS 'Văn bản thô từ voice answer nếu dùng speech-to-text.';

DROP TRIGGER IF EXISTS trg_interview_answers_updated_at ON interview_answers;
CREATE TRIGGER trg_interview_answers_updated_at
BEFORE UPDATE ON interview_answers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id ON interview_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_user_id ON interview_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_score_total ON interview_answers(score_total);

CREATE TABLE IF NOT EXISTS interview_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_score NUMERIC(5, 2) CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100),
  summary TEXT,
  repeated_mistakes TEXT,
  recommended_practice TEXT,
  language_feedback TEXT,
  logic_feedback TEXT,
  next_steps TEXT,
  ai_usage_log_id UUID REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE interview_reports IS 'Báo cáo tổng kết sau một buổi phỏng vấn.';

DROP TRIGGER IF EXISTS trg_interview_reports_updated_at ON interview_reports;
CREATE TRIGGER trg_interview_reports_updated_at
BEFORE UPDATE ON interview_reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_interview_reports_user_id ON interview_reports(user_id);

-- ============================================================
-- 10. File, audio, tài liệu upload
-- ============================================================

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  uploader_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(150),
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  storage_provider VARCHAR(80) NOT NULL DEFAULT 'LOCAL',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE uploaded_files IS 'File upload: audio, avatar, tài liệu profile, bản ghi âm.';

CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner_user_id ON uploaded_files(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploader_user_id ON uploaded_files(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at);

CREATE TABLE IF NOT EXISTS voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES interview_answers(id) ON DELETE SET NULL,
  source audio_source NOT NULL DEFAULT 'USER_RECORDING',
  language language_code NOT NULL DEFAULT 'ZH',
  file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  transcript TEXT,
  pronunciation_score NUMERIC(5, 2) CHECK (pronunciation_score IS NULL OR pronunciation_score BETWEEN 0 AND 100),
  fluency_score NUMERIC(5, 2) CHECK (fluency_score IS NULL OR fluency_score BETWEEN 0 AND 100),
  speed_words_per_minute NUMERIC(8, 2),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE voice_recordings IS 'Bản ghi âm câu trả lời và kết quả phân tích giọng nói nếu có.';

CREATE INDEX IF NOT EXISTS idx_voice_recordings_user_id ON voice_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_session_id ON voice_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_answer_id ON voice_recordings(answer_id);

-- ============================================================
-- 11. Gói sử dụng, thanh toán, giới hạn lượt luyện tập
-- ============================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'FREE',
  interview_limit_per_month INT NOT NULL DEFAULT 3 CHECK (interview_limit_per_month >= 0),
  ai_question_limit_per_month INT NOT NULL DEFAULT 20 CHECK (ai_question_limit_per_month >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_subscriptions IS 'Gói sử dụng của người dùng, phục vụ thương mại hóa giai đoạn sau.';

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_is_active ON user_subscriptions(is_active);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status payment_status NOT NULL DEFAULT 'PENDING',
  provider VARCHAR(80),
  provider_transaction_id VARCHAR(255),
  note TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Thanh toán gói luyện tập nếu triển khai thương mại.';

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================================
-- 12. Cấu hình hệ thống, audit log, hoạt động người dùng
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(150) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'Cấu hình hệ thống: giới hạn AI, model mặc định, voice mặc định, v.v.';

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_audit_logs IS 'Log thao tác admin: thêm/sửa/xóa câu hỏi, trường, ngành, học bổng.';

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_activity_logs IS 'Log hoạt động người dùng: đăng nhập, tạo profile, bắt đầu phỏng vấn, hoàn thành phỏng vấn.';

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);

-- ============================================================
-- 13. Seed dữ liệu mặc định tối thiểu
-- ============================================================

INSERT INTO scholarships (name, code, description)
VALUES
  ('Học bổng Chính phủ Trung Quốc', 'CSC', 'Chinese Government Scholarship'),
  ('Học bổng Giáo viên tiếng Trung Quốc tế', 'CIS', 'International Chinese Language Teachers Scholarship'),
  ('Học bổng tỉnh', 'PROVINCE', 'Học bổng do tỉnh/thành phố cấp'),
  ('Học bổng trường', 'UNIVERSITY', 'Học bổng do trường cấp'),
  ('Tự túc', 'SELF_FUNDED', 'Không sử dụng học bổng')
ON CONFLICT (name) DO NOTHING;

INSERT INTO question_tags (name, description)
VALUES
  ('giới thiệu bản thân', 'Câu hỏi về thông tin cá nhân và động lực apply'),
  ('kế hoạch học tập', 'Câu hỏi về study plan'),
  ('định hướng nghề nghiệp', 'Câu hỏi về career plan'),
  ('nghiên cứu', 'Câu hỏi phù hợp hệ thạc sĩ/nghiên cứu'),
  ('học bổng', 'Câu hỏi về lý do xin học bổng')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  (
    'default_interview_config',
    '{"question_count": 8, "language": "VI", "mode": "PRACTICE", "ai_generated_question_count": 3}'::jsonb,
    'Cấu hình mặc định khi tạo buổi phỏng vấn.'
  ),
  (
    'default_scoring_rubric',
    '{"relevance": 25, "logic": 25, "specificity": 25, "language": 25}'::jsonb,
    'Tỷ trọng chấm điểm mặc định cho câu trả lời.'
  )
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 14. View hỗ trợ dashboard
-- ============================================================

CREATE OR REPLACE VIEW user_interview_summary AS
SELECT
  u.id AS user_id,
  u.full_name,
  u.email,
  COUNT(s.id) AS total_sessions,
  COUNT(s.id) FILTER (WHERE s.status = 'COMPLETED') AS completed_sessions,
  ROUND(AVG(s.total_score), 2) AS average_score,
  MAX(s.created_at) AS latest_session_at
FROM users u
LEFT JOIN interview_sessions s ON s.user_id = u.id
GROUP BY u.id, u.full_name, u.email;

COMMENT ON VIEW user_interview_summary IS 'Tổng quan số buổi phỏng vấn và điểm trung bình của từng user.';

CREATE OR REPLACE VIEW question_bank_summary AS
SELECT
  q.degree_level,
  q.category,
  q.difficulty,
  q.language,
  COUNT(*) AS total_questions,
  COUNT(*) FILTER (WHERE q.is_active = TRUE AND q.deleted_at IS NULL) AS active_questions
FROM questions q
GROUP BY q.degree_level, q.category, q.difficulty, q.language;

COMMENT ON VIEW question_bank_summary IS 'Thống kê kho câu hỏi theo hệ, nhóm, độ khó và ngôn ngữ.';

-- ============================================================
-- 15. Ghi chú vận hành
-- ============================================================

-- 1. Chạy file:
--    psql -U postgres -d ai_phongvan -f database/schema_full.sql
--
-- 2. Nếu dùng Prisma, có thể dùng file này làm tài liệu thiết kế,
--    sau đó đồng bộ dần vào backend/prisma/schema.prisma.
--
-- 3. Các bảng payment/subscription/voice có thể chưa dùng trong MVP,
--    nhưng đã để sẵn để mở rộng giai đoạn sau.

RESET client_min_messages;
