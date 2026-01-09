# Database Schema Documentation

## Extensions

### pgvector
- **Purpose**: Enables vector similarity search operations
- **Migration**: `V1__Enable_pgvector.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Tables

### `changelog_embeddings`

Stores changelog content as vector embeddings for semantic search operations.

#### Schema Definition

```sql
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
```

#### Columns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `tool_name` | VARCHAR(255) | NOT NULL | Name of the tool/changelog source |
| `tool_url` | VARCHAR(500) | NOT NULL | URL of the changelog page |
| `content_chunk` | TEXT | NOT NULL | Chunked text content from changelog |
| `embedding` | vector(1536) | NULL | OpenAI text-embedding-3-small embedding vector |
| `metadata` | JSONB | NULL | Additional metadata (date, version, chunkIndex, totalChunks, etc.) |
| `blob_path` | VARCHAR(500) | NULL | Path to Vercel Blob storage file |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Record last update timestamp |

#### Constraints

- **UNIQUE**: `(tool_name, blob_path, content_chunk)` - Prevents duplicate entries for the same tool, blob path, and content chunk combination

#### Indexes

1. **`changelog_embeddings_vector_idx`**
   - **Type**: IVFFlat
   - **Column**: `embedding`
   - **Operator**: `vector_cosine_ops`
   - **Configuration**: `lists = 100`
   - **Purpose**: Optimizes cosine similarity searches for semantic search

2. **`changelog_embeddings_tool_name_idx`**
   - **Type**: B-tree
   - **Column**: `tool_name`
   - **Purpose**: Fast lookups by tool name

3. **`changelog_embeddings_blob_path_idx`**
   - **Type**: B-tree
   - **Column**: `blob_path`
   - **Purpose**: Fast lookups by blob storage path

#### Triggers

**`update_changelog_embeddings_updated_at`**
- **Event**: BEFORE UPDATE
- **Function**: `update_updated_at_column()`
- **Purpose**: Automatically updates the `updated_at` timestamp when a row is modified

## Database Functions

### `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

**Purpose**: Trigger function that automatically sets `updated_at` to the current timestamp on row updates.

## Migration Files

- **V1__Enable_pgvector.sql**: Enables the pgvector extension
- **V2__Create_changelog_vector_store.sql**: Creates the `changelog_embeddings` table with all indexes and triggers

## Usage

This schema supports the Web Search Agent's changelog processing pipeline:

1. **Storage**: Stores chunked changelog content with vector embeddings
2. **Search**: Enables semantic similarity search using pgvector
3. **Tracking**: Maintains metadata and references to blob storage
4. **Deduplication**: Prevents duplicate entries through unique constraints

## TypeScript Interface

```typescript
export interface ChangelogEmbedding {
  id: number;
  toolName: string;
  toolUrl: string;
  contentChunk: string;
  embedding: number[];
  metadata: Record<string, any>;
  blobPath: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Related Files

- **Migration Files**: `flyway/sql/V1__Enable_pgvector.sql`, `flyway/sql/V2__Create_changelog_vector_store.sql`
- **TypeScript Interface**: `src/db/vectorStore.ts`
- **Database Client**: `src/db/client.ts`

