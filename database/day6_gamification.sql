SET client_min_messages TO WARNING;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_language language_code NOT NULL DEFAULT 'VI',
  weekly_goal_target INT NOT NULL DEFAULT 3 CHECK (weekly_goal_target BETWEEN 1 AND 30),
  browser_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  theme VARCHAR(20) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  label VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(16) NOT NULL DEFAULT '*',
  requirement_type VARCHAR(80) NOT NULL,
  requirement_value INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES gamification_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at);

CREATE TABLE IF NOT EXISTS user_weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  target_sessions INT NOT NULL DEFAULT 3 CHECK (target_sessions BETWEEN 1 AND 30),
  completed_sessions INT NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

DROP TRIGGER IF EXISTS trg_user_weekly_goals_updated_at ON user_weekly_goals;
CREATE TRIGGER trg_user_weekly_goals_updated_at
BEFORE UPDATE ON user_weekly_goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_weekly_goals_user_id ON user_weekly_goals(user_id);

INSERT INTO gamification_badges (code, label, description, icon, requirement_type, requirement_value)
VALUES
  ('FIRST_SESSION', 'Phong van dau tien', 'Hoan thanh buoi phong van dau tien.', '🎯', 'completed_sessions', 1),
  ('THREE_SESSION_WEEK', 'Muc tieu tuan', 'Hoan thanh 3 buoi trong mot tuan.', '📅', 'weekly_completed', 3),
  ('SEVEN_DAY_STREAK', '7 ngay lien tiep', 'Luyen tap 7 ngay lien tiep.', '🔥', 'streak_days', 7),
  ('HIGH_SCORE_8', 'Diem 8+', 'Dat diem trung binh tu 8 tro len.', '⭐', 'max_score', 8),
  ('TWENTY_SESSIONS', 'Hoc khong ngung', 'Hoan thanh 20 buoi phong van.', '📚', 'completed_sessions', 20)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value;

RESET client_min_messages;
