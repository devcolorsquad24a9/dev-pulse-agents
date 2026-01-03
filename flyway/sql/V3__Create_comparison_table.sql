-- Create table for storing tool comparisons
CREATE TABLE IF NOT EXISTS comparisons (
    id SERIAL PRIMARY KEY,
    tool_names TEXT[] NOT NULL, -- Array of tool names being compared
    comparison_data JSONB NOT NULL, -- Structured comparison object
    decision_rules TEXT, -- Short decision rules
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for tool_names lookups (using GIN index for array searches)
CREATE INDEX IF NOT EXISTS comparisons_tool_names_idx 
ON comparisons 
USING GIN (tool_names);

-- Create index for created_at for listing recent comparisons
CREATE INDEX IF NOT EXISTS comparisons_created_at_idx 
ON comparisons (created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comparisons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_comparisons_updated_at 
BEFORE UPDATE ON comparisons 
FOR EACH ROW 
EXECUTE FUNCTION update_comparisons_updated_at();

