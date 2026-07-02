-- Extra indexes for hot dashboard/admin reads.
-- Prisma schema cannot represent these partial/concurrent indexes cleanly.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_sessions_refresh_active
  ON auth_sessions (refresh_token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_not_deleted_created_desc
  ON users (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_not_deleted_active_created_desc
  ON users (is_active, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_not_deleted_role
  ON users (role)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_user_created_desc
  ON interview_sessions (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_user_status_created_desc
  ON interview_sessions (user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_status_created_score
  ON interview_sessions (status, created_at DESC, total_score)
  WHERE total_score IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_answers_user_answered_desc
  ON interview_answers (user_id, answered_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_answers_user_score_answered_desc
  ON interview_answers (user_id, score_total, answered_at DESC)
  WHERE score_total IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_answers_score_answered_desc
  ON interview_answers (score_total, answered_at DESC)
  WHERE score_total IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_not_deleted_active_created_desc
  ON questions (is_active, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_not_deleted_created_desc
  ON questions (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_logs_success_created_desc
  ON ai_usage_logs (created_at DESC)
  WHERE error_message IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_logs_entity_created_desc
  ON admin_audit_logs (entity_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_school_majors_school_season_created_desc
  ON school_majors (school_id, admission_season_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_school_scholarships_school_season_created_desc
  ON school_scholarships (school_id, admission_season_id, created_at DESC);
