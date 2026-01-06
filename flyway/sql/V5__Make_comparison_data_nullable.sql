-- Make comparison_data nullable to allow new inserts without it
-- This fixes the NOT NULL constraint violation when inserting with only blob_path
ALTER TABLE comparisons 
ALTER COLUMN comparison_data DROP NOT NULL;

