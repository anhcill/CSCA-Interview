-- Agent3 Big Update: duplicate-index cleanup + composite performance indexes.
-- Safe to re-run: all drops/creates are guarded.

DROP INDEX IF EXISTS "users_role_idx";
DROP INDEX IF EXISTS "users_isActive_idx";
DROP INDEX IF EXISTS "users_is_active_idx";
DROP INDEX IF EXISTS "users_createdAt_idx";
DROP INDEX IF EXISTS "users_created_at_idx";

DROP INDEX IF EXISTS "auth_sessions_userId_idx";
DROP INDEX IF EXISTS "auth_sessions_user_id_idx";
DROP INDEX IF EXISTS "auth_sessions_expiresAt_idx";
DROP INDEX IF EXISTS "auth_sessions_expires_at_idx";

DROP INDEX IF EXISTS "user_profiles_degreeLevel_idx";
DROP INDEX IF EXISTS "user_profiles_degree_level_idx";
DROP INDEX IF EXISTS "user_profiles_targetSchool_idx";
DROP INDEX IF EXISTS "user_profiles_target_school_idx";
DROP INDEX IF EXISTS "user_profiles_targetMajor_idx";
DROP INDEX IF EXISTS "user_profiles_target_major_idx";

DROP INDEX IF EXISTS "schools_city_idx";
DROP INDEX IF EXISTS "schools_province_idx";
DROP INDEX IF EXISTS "schools_isActive_idx";
DROP INDEX IF EXISTS "schools_is_active_idx";

DROP INDEX IF EXISTS "majors_degreeLevel_idx";
DROP INDEX IF EXISTS "majors_degree_level_idx";
DROP INDEX IF EXISTS "majors_isActive_idx";
DROP INDEX IF EXISTS "majors_is_active_idx";

DROP INDEX IF EXISTS "scholarships_isActive_idx";
DROP INDEX IF EXISTS "scholarships_is_active_idx";

DROP INDEX IF EXISTS "questions_degreeLevel_idx";
DROP INDEX IF EXISTS "questions_degree_level_idx";
DROP INDEX IF EXISTS "questions_schoolId_idx";
DROP INDEX IF EXISTS "questions_school_id_idx";
DROP INDEX IF EXISTS "questions_majorId_idx";
DROP INDEX IF EXISTS "questions_major_id_idx";
DROP INDEX IF EXISTS "questions_scholarshipId_idx";
DROP INDEX IF EXISTS "questions_scholarship_id_idx";
DROP INDEX IF EXISTS "questions_category_idx";
DROP INDEX IF EXISTS "questions_difficulty_idx";
DROP INDEX IF EXISTS "questions_language_idx";
DROP INDEX IF EXISTS "questions_isActive_idx";
DROP INDEX IF EXISTS "questions_is_active_idx";

DROP INDEX IF EXISTS "interview_sessions_userId_idx";
DROP INDEX IF EXISTS "interview_sessions_user_id_idx";
DROP INDEX IF EXISTS "interview_sessions_profileId_idx";
DROP INDEX IF EXISTS "interview_sessions_profile_id_idx";
DROP INDEX IF EXISTS "interview_sessions_status_idx";
DROP INDEX IF EXISTS "interview_sessions_createdAt_idx";
DROP INDEX IF EXISTS "interview_sessions_created_at_idx";

DROP INDEX IF EXISTS "interview_session_questions_sessionId_idx";
DROP INDEX IF EXISTS "interview_session_questions_session_id_idx";
DROP INDEX IF EXISTS "interview_session_questions_questionId_idx";
DROP INDEX IF EXISTS "interview_session_questions_question_id_idx";

DROP INDEX IF EXISTS "interview_answers_sessionId_idx";
DROP INDEX IF EXISTS "interview_answers_session_id_idx";
DROP INDEX IF EXISTS "interview_answers_userId_idx";
DROP INDEX IF EXISTS "interview_answers_user_id_idx";
DROP INDEX IF EXISTS "interview_answers_scoreTotal_idx";
DROP INDEX IF EXISTS "interview_answers_score_total_idx";

CREATE INDEX IF NOT EXISTS "idx_user_profiles_major_id" ON "user_profiles"("major_id");
CREATE INDEX IF NOT EXISTS "idx_user_profiles_scholarship_id" ON "user_profiles"("scholarship_id");
CREATE INDEX IF NOT EXISTS "idx_user_profiles_school_id" ON "user_profiles"("school_id");

CREATE INDEX IF NOT EXISTS "idx_questions_lookup" ON "questions"("degree_level", "school_id", "major_id", "scholarship_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_interview_sessions_major_id" ON "interview_sessions"("major_id");
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_scholarship_id" ON "interview_sessions"("scholarship_id");
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_school_id" ON "interview_sessions"("school_id");
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_user_status_created" ON "interview_sessions"("user_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_user_created" ON "interview_sessions"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_user_status_score" ON "interview_sessions"("user_id", "status", "total_score");

CREATE INDEX IF NOT EXISTS "idx_interview_answers_session_score" ON "interview_answers"("session_id", "score_total");
