import { getDbClient } from './client.js';
import { generateEmbeddings, chunkText } from '../tools/embeddings.js';

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

/**
 * Store embeddings for changelog content
 */
export async function storeChangelogEmbeddings(
  toolName: string,
  toolUrl: string,
  content: string,
  blobPath: string,
  metadata?: Record<string, any>
): Promise<void> {
  const db = getDbClient();
  
  // Chunk the content
  const chunks = chunkText(content);
  
  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks);
  
  // Delete existing embeddings for this tool and blob path
  await db.query(
    'DELETE FROM changelog_embeddings WHERE tool_name = $1 AND blob_path = $2',
    [toolName, blobPath]
  );
  
  // Insert new embeddings
  for (let i = 0; i < chunks.length; i++) {
    // Format embedding array as PostgreSQL array string for pgvector
    const embeddingArray = '[' + embeddings[i].join(',') + ']';
    
    await db.query(
      `INSERT INTO changelog_embeddings 
       (tool_name, tool_url, content_chunk, embedding, metadata, blob_path)
       VALUES ($1, $2, $3, $4::vector, $5, $6)
       ON CONFLICT (tool_name, blob_path, content_chunk) 
       DO UPDATE SET 
         embedding = EXCLUDED.embedding,
         updated_at = NOW()`,
      [
        toolName,
        toolUrl,
        chunks[i],
        embeddingArray,
        JSON.stringify({ ...metadata, chunkIndex: i, totalChunks: chunks.length }),
        blobPath,
      ]
    );
  }
}

/**
 * Search for similar changelog content using vector similarity
 */
export async function searchChangelogEmbeddings(
  query: string,
  limit: number = 10,
  toolName?: string
): Promise<ChangelogEmbedding[]> {
  const db = getDbClient();
  
  // Generate embedding for query
  const queryEmbeddings = await generateEmbeddings([query]);
  const queryEmbedding = queryEmbeddings[0];
  
  // Format embedding array as PostgreSQL array string for pgvector
  const embeddingArray = '[' + queryEmbedding.join(',') + ']';
  
  // Build query
  let sql = `
    SELECT 
      id, tool_name, tool_url, content_chunk, 
      embedding::text, metadata, blob_path, created_at, updated_at,
      1 - (embedding <=> $1::vector) as similarity
    FROM changelog_embeddings
    WHERE 1 - (embedding <=> $1::vector) > 0.7
  `;
  
  const params: any[] = [embeddingArray];
  
  if (toolName) {
    sql += ' AND tool_name = $2';
    params.push(toolName);
  }
  
  sql += ' ORDER BY similarity DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await db.query(sql, params);
  
  return result.rows.map(row => ({
    id: row.id,
    toolName: row.tool_name,
    toolUrl: row.tool_url,
    contentChunk: row.content_chunk,
    embedding: JSON.parse(row.embedding),
    metadata: row.metadata,
    blobPath: row.blob_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

