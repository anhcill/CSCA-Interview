CREATE TABLE IF NOT EXISTS "question_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "major_id" UUID NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_assignments_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "question_assignments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE,
  CONSTRAINT "question_assignments_major_id_fkey"
    FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_assignments_question_id_school_id_major_id_key"
  ON "question_assignments"("question_id", "school_id", "major_id");

CREATE INDEX IF NOT EXISTS "idx_question_assignments_target"
  ON "question_assignments"("school_id", "major_id");

CREATE INDEX IF NOT EXISTS "idx_question_assignments_question_id"
  ON "question_assignments"("question_id");

INSERT INTO "question_assignments" ("question_id", "school_id", "major_id", "created_by")
SELECT "id", "school_id", "major_id", "created_by"
FROM "questions"
WHERE "school_id" IS NOT NULL
  AND "major_id" IS NOT NULL
ON CONFLICT ("question_id", "school_id", "major_id") DO NOTHING;

INSERT INTO "school_majors" ("school_id", "major_id", "note")
SELECT DISTINCT q."school_id", q."major_id", 'Tự động đồng bộ từ kho câu hỏi hiện có'
FROM "questions" q
WHERE q."school_id" IS NOT NULL
  AND q."major_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "school_majors" sm
    WHERE sm."school_id" = q."school_id"
      AND sm."major_id" = q."major_id"
      AND sm."admission_season_id" IS NULL
  );
