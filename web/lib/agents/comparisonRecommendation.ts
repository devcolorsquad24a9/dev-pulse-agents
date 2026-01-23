/**
 * Shared comparison recommendation utilities.
 *
 * SECURITY (workspace rules):
 * - Tool names are validated before being used in any blob-path-related logic elsewhere.
 * - This module only generates structured recommendations; it does not touch filesystem/paths.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import type { ComparisonRecommendation } from '../types/comparison.js';

const RecommendationSchema = z.object({
  recommendedTool: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.string().min(1),
  whenToPickOthers: z.record(z.string(), z.string()).optional(),
});

function normalizeToolNameCandidate(candidate: string, toolNames: string[]): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  const exact = toolNames.find(t => t === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const ci = toolNames.find(t => t.toLowerCase() === lower);
  if (ci) return ci;

  const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const stripped = strip(trimmed);
  const loose = toolNames.find(t => strip(t) === stripped);
  return loose ?? null;
}

export async function generateRecommendationFromComparison(
  comparisonText: string,
  toolNames: string[]
): Promise<ComparisonRecommendation> {
  const system = `You are an expert at evaluating developer tools.
Given a comparison write-up, recommend which ONE tool the user should choose in general, and explain why.
If the best choice depends on context, still pick a default, then briefly note when to pick the other tools.`;

  const prompt = `Tools compared: ${toolNames.join(', ')}

Comparison:
${comparisonText}

Return a concise recommendation object. The recommendedTool MUST be exactly one of the provided tool names.`;

  const result = await generateObject({
    model: openai('gpt-4-turbo'),
    system,
    prompt,
    schema: RecommendationSchema,
  });

  const normalizedTool =
    normalizeToolNameCandidate(result.object.recommendedTool, toolNames) ?? toolNames[0];

  const whenToPickOthers = result.object.whenToPickOthers
    ? Object.fromEntries(
        Object.entries(result.object.whenToPickOthers).map(([k, v]) => {
          const nk = normalizeToolNameCandidate(k, toolNames) ?? k;
          return [nk, v];
        })
      )
    : undefined;

  return {
    recommendedTool: normalizedTool,
    confidence: result.object.confidence,
    rationale: result.object.rationale,
    whenToPickOthers,
  };
}

export function formatRecommendationSection(rec: ComparisonRecommendation): string {
  const lines: string[] = [];
  lines.push('## Recommendation');
  lines.push('');
  lines.push(`**Use ${rec.recommendedTool}.**`);
  lines.push('');
  lines.push(`Confidence: **${rec.confidence}**`);
  lines.push('');
  lines.push(rec.rationale.trim());
  if (rec.whenToPickOthers && Object.keys(rec.whenToPickOthers).length > 0) {
    lines.push('');
    lines.push('When to pick something else:');
    for (const [tool, reason] of Object.entries(rec.whenToPickOthers)) {
      lines.push(`- **${tool}**: ${reason}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function stripRecommendationSection(markdown: string): string {
  // Remove everything from "## Recommendation" onward, if present.
  const idx = markdown.search(/^##\s+Recommendation\s*$/m);
  if (idx === -1) return markdown;
  return markdown.slice(0, idx).trimEnd();
}


