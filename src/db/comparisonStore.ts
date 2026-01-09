/**
 * Database operations for storing and retrieving comparisons
 */

import { getDbClient } from './client.js';
import { ComparisonResult, ComparisonRecommendation } from '../types/comparison.js';
import { getComparisonFile } from '../storage/blob.js';

/**
 * Store a comparison in the database
 */
export async function storeComparison(
  toolNames: string[],
  blobPath: string,
  recommendation?: ComparisonRecommendation
): Promise<number> {
  const db = getDbClient();
  
  // Sort tool names for consistent storage
  const sortedToolNames = [...toolNames].sort();
  
  const result = await db.query(
    `INSERT INTO comparisons (tool_names, blob_path, recommendation_data)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [sortedToolNames, blobPath, recommendation ?? null]
  );
  
  return result.rows[0].id;
}

export async function updateComparisonRecommendation(
  id: number,
  recommendation: ComparisonRecommendation
): Promise<void> {
  const db = getDbClient();
  await db.query(
    `UPDATE comparisons
     SET recommendation_data = $2
     WHERE id = $1`,
    [id, recommendation]
  );
}

/**
 * Retrieve an existing comparison by tool names
 */
export async function getComparison(toolNames: string[]): Promise<ComparisonResult | null> {
  const db = getDbClient();
  
  // Sort tool names for consistent lookup
  const sortedToolNames = [...toolNames].sort();
  
  const result = await db.query(
    `SELECT id, tool_names, blob_path, recommendation_data, created_at, updated_at
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
    recommendation: row.recommendation_data ?? undefined,
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
    `SELECT id, tool_names, blob_path, recommendation_data, created_at, updated_at
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
    recommendation: row.recommendation_data ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listComparisonsSince(
  since: Date,
  limit: number = 10
): Promise<ComparisonResult[]> {
  const db = getDbClient();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 10;

  const result = await db.query(
    `SELECT id, tool_names, blob_path, recommendation_data, created_at, updated_at
     FROM comparisons
     WHERE blob_path IS NOT NULL
       AND created_at > $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [since, safeLimit]
  );

  return result.rows.map(row => ({
    id: row.id,
    toolNames: row.tool_names,
    blobPath: row.blob_path,
    recommendation: row.recommendation_data ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getComparisonsByIds(ids: number[]): Promise<ComparisonResult[]> {
  const db = getDbClient();
  const uniqueIds = Array.from(new Set(ids)).filter(n => Number.isFinite(n)) as number[];
  if (uniqueIds.length === 0) return [];

  const result = await db.query(
    `SELECT id, tool_names, blob_path, recommendation_data, created_at, updated_at
     FROM comparisons
     WHERE id = ANY($1::int[])
     ORDER BY created_at DESC`,
    [uniqueIds]
  );

  return result.rows.map(row => ({
    id: row.id,
    toolNames: row.tool_names,
    blobPath: row.blob_path,
    recommendation: row.recommendation_data ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

