-- Refactor comparisons table to use blob storage
-- Remove comparison_data and decision_rules columns, add blob_path

-- Add blob_path column
ALTER TABLE comparisons 
ADD COLUMN IF NOT EXISTS blob_path VARCHAR(500);

-- Migrate existing data: export comparison_data to blob storage would need to be done separately
-- For now, we'll just add the column and let new comparisons use blob storage

-- Remove old columns (commented out for safety - uncomment after verifying migration)
-- ALTER TABLE comparisons DROP COLUMN IF EXISTS comparison_data;
-- ALTER TABLE comparisons DROP COLUMN IF EXISTS decision_rules;

-- Create index for blob_path lookups
CREATE INDEX IF NOT EXISTS comparisons_blob_path_idx 
ON comparisons (blob_path);

-- Note: The old columns are kept for now to allow rollback if needed
-- They can be dropped in a future migration after verifying the new system works

