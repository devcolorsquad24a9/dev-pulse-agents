/**
 * Database operations for storing and retrieving comparisons
 */

import { getDbClient } from './client.js';
import { ComparisonData, ComparisonResult } from '../types/comparison.js';

/**
 * Store a comparison in the database
 */
export async function storeComparison(comparison: ComparisonData): Promise<number> {
  const db = getDbClient();
  
  // Sort tool names for consistent storage
  const sortedToolNames = [...comparison.tools].sort();
  
  const result = await db.query(
    `INSERT INTO comparisons (tool_names, comparison_data, decision_rules)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [
      sortedToolNames,
      JSON.stringify(comparison),
      comparison.decisionRules,
    ]
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
    `SELECT id, tool_names, comparison_data, decision_rules, created_at, updated_at
     FROM comparisons
     WHERE tool_names = $1
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
    comparisonData: row.comparison_data,
    decisionRules: row.decision_rules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List recent comparisons
 */
export async function listComparisons(limit: number = 10): Promise<ComparisonResult[]> {
  const db = getDbClient();
  
  const result = await db.query(
    `SELECT id, tool_names, comparison_data, decision_rules, created_at, updated_at
     FROM comparisons
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    toolNames: row.tool_names,
    comparisonData: row.comparison_data,
    decisionRules: row.decision_rules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

