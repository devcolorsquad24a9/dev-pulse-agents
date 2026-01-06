/**
 * Database operations for storing and retrieving comparisons
 */

import { getDbClient } from './client.js';
import { ComparisonResult } from '../types/comparison.js';
import { getComparisonFile } from '../storage/blob.js';

/**
 * Store a comparison in the database
 */
export async function storeComparison(
  toolNames: string[],
  blobPath: string
): Promise<number> {
  const db = getDbClient();
  
  // Sort tool names for consistent storage
  const sortedToolNames = [...toolNames].sort();
  
  const result = await db.query(
    `INSERT INTO comparisons (tool_names, blob_path)
     VALUES ($1, $2)
     RETURNING id`,
    [sortedToolNames, blobPath]
  );
  
  return result.rows[0].id;
}

/**
 * Retrieve an existing comparison by tool names
 */
export async function getComparison(toolNames: string[]): Promise<ComparisonResult | null> {
  const db = getDbClient();
  
  // Sort tool names for consistent lookup
  const sortedToolNames = [...toolNames].sort();
  
  const result = await db.query(
    `SELECT id, tool_names, blob_path, created_at, updated_at
     FROM comparisons
     WHERE tool_names = $1 AND blob_path IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [sortedToolNames]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    toolNames: row.tool_names,
    blobPath: row.blob_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get comparison with content from blob storage
 */
export async function getComparisonWithContent(
  toolNames: string[]
): Promise<{ result: ComparisonResult; content: string } | null> {
  const result = await getComparison(toolNames);
  
  if (!result) {
    return null;
  }
  
  const content = await getComparisonFile(toolNames);
  
  if (!content) {
    // Blob file missing but database record exists
    return null;
  }
  
  return { result, content };
}

/**
 * List recent comparisons
 */
export async function listComparisons(limit: number = 10): Promise<ComparisonResult[]> {
  const db = getDbClient();
  
  const result = await db.query(
    `SELECT id, tool_names, blob_path, created_at, updated_at
     FROM comparisons
     WHERE blob_path IS NOT NULL
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    toolNames: row.tool_names,
    blobPath: row.blob_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

