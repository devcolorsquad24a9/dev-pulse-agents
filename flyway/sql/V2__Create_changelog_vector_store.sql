-- Create table for storing changelog embeddings
CREATE TABLE IF NOT EXISTS changelog_embeddings (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(255) NOT NULL,
    tool_url VARCHAR(500) NOT NULL,
    content_chunk TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB, -- Store additional metadata (date, version, etc.)
    blob_path VARCHAR(500), -- Path to blob storage file
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tool_name, blob_path, content_chunk) -- Prevent duplicates
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS changelog_embeddings_vector_idx 
ON changelog_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for tool_name lookups
CREATE INDEX IF NOT EXISTS changelog_embeddings_tool_name_idx 
ON changelog_embeddings (tool_name);

-- Create index for blob_path lookups
CREATE INDEX IF NOT EXISTS changelog_embeddings_blob_path_idx 
ON changelog_embeddings (blob_path);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_changelog_embeddings_updated_at 
BEFORE UPDATE ON changelog_embeddings 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

