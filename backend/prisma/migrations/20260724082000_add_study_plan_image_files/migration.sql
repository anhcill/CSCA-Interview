ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "study_plan_image_files" JSONB;
