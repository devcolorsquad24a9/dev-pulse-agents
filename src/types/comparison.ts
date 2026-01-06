/**
 * Type definitions for comparison agent
 */

export interface ComparisonResult {
  id: number;
  toolNames: string[];
  blobPath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonWithContent {
  id: number;
  toolNames: string[];
  blobPath: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

