CREATE TABLE "site_feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "rating" INTEGER,
  "category" VARCHAR(80),
  "message" TEXT NOT NULL,
  "page_url" VARCHAR(1000),
  "status" VARCHAR(30) NOT NULL DEFAULT 'NEW',
  "admin_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "site_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "site_feedback_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5)),
  CONSTRAINT "site_feedback_status_check" CHECK ("status" IN ('NEW', 'REVIEWED', 'RESOLVED'))
);

CREATE INDEX "idx_site_feedback_created_at" ON "site_feedback"("created_at");
CREATE INDEX "idx_site_feedback_status" ON "site_feedback"("status");
CREATE INDEX "idx_site_feedback_user_id" ON "site_feedback"("user_id");

ALTER TABLE "site_feedback"
  ADD CONSTRAINT "site_feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
