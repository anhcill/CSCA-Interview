ALTER TABLE "interview_answers"
ADD COLUMN "submission_id" UUID;

CREATE UNIQUE INDEX "interview_answers_submission_id_key"
ON "interview_answers"("submission_id");
