-- Tracks each monthly newsletter run so the next run can be incremental.
-- This supports "only refer to changes since the last email we sent".

CREATE TABLE IF NOT EXISTS newsletter_runs (
  id SERIAL PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  month_label TEXT,
  subject TEXT,
  comparison_ids INT[] NOT NULL,
  provider_email_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletter_runs_sent_at_idx
  ON newsletter_runs (sent_at DESC);


