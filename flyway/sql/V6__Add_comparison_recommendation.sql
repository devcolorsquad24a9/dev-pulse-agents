-- Store structured recommendation alongside comparison metadata
-- This keeps the "which tool to use" decision queryable without re-running the LLM.

ALTER TABLE comparisons
ADD COLUMN IF NOT EXISTS recommendation_data JSONB;

-- Optional: index for JSONB queries later (safe to omit, but cheap)
CREATE INDEX IF NOT EXISTS comparisons_recommendation_data_gin_idx
ON comparisons
USING GIN (recommendation_data);


