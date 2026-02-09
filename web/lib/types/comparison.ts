/**
 * Type definitions for comparison agent
 */

export interface ComparisonResult {
  id: number;
  toolNames: string[];
  blobPath: string;
  recommendation?: ComparisonRecommendation;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonRecommendation {
  recommendedTool: string;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  /**
   * Optional short guidance for when another tool becomes the better choice.
   * Keyed by tool name.
   */
  whenToPickOthers?: Record<string, string>;
}

export interface ComparisonWithContent {
  id: number;
  toolNames: string[];
  blobPath: string;
  content: string;
  recommendation?: ComparisonRecommendation;
  createdAt: Date;
  updatedAt: Date;
}

