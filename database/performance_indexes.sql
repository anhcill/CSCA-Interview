SET client_min_messages TO WARNING;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_status_created
  ON interview_sessions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created
  ON interview_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_status_score
  ON interview_sessions(user_id, status, total_score);

CREATE INDEX IF NOT EXISTS idx_interview_answers_user_answered
  ON interview_answers(user_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_answers_session_score
  ON interview_answers(session_id, score_total);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_badge
  ON user_badges(user_id, badge_id);

RESET client_min_messages;
