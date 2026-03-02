DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alert_events'
  ) THEN
    ALTER TABLE "alert_events" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
    CREATE INDEX IF NOT EXISTS "idx_alert_user_time" ON "alert_events" ("user_id", "occurred_at");
  END IF;
END $$;
