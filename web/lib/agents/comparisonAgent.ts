/**
 * Comparison Agent
 * Compares multiple tools based on their changelogs using free-form analysis
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getChangelogFile, listAvailableTools, saveComparisonFile } from '../storage/blob';
import { connectDb, disconnectDb } from '../db/client';
import {
  storeComparison,
  getComparisonWithContent,
  updateComparisonRecommendation,
} from '../db/comparisonStore';
import type { ComparisonRecommendation } from '../types/comparison';
import {
  formatRecommendationSection,
  generateRecommendationFromComparison,
} from './comparisonRecommendation';

const ToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Invalid tool name');

/**
 * Fetch changelog content from blob storage for multiple tools
 */
async function fetchToolChangelogs(toolNames: string[]): Promise<Map<string, string>> {
  const changelogMap = new Map<string, string>();
  
  for (const toolName of toolNames) {
    const content = await getChangelogFile(toolName);
    if (content) {
      changelogMap.set(toolName, content);
    } else {
      throw new Error(`Changelog not found for tool: ${toolName}. Please ensure the tool has been processed by the web search agent.`);
    }
  }
  
  return changelogMap;
}

/**
 * Generate comparison using LLM with free-form text output
 */
async function generateComparison(
  changelogData: Map<string, string>,
  toolNames: string[]
): Promise<string> {
  // Build context for each tool
  const toolContexts = toolNames.map(toolName => {
    const fullContent = changelogData.get(toolName) || '';
    // Limit content length to manage token usage (keep first 15000 chars per tool)
    const truncatedContent = fullContent.length > 15000 
      ? fullContent.substring(0, 15000) + '\n\n[... content truncated for length ...]'
      : fullContent;
    
    return `### Tool: ${toolName}\n\nChangelog:\n${truncatedContent}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `You are an expert at analyzing development tools and creating comprehensive comparisons. 
Analyze the provided changelog information for each tool and create a detailed, well-structured comparison.

Your comparison should:
- Identify key differences, strengths, and weaknesses of each tool
- Highlight unique features and capabilities
- Discuss performance, reliability, and technical aspects
- Cover user experience, ease of use, and learning curve
- Address integrations, ecosystem, and community support
- Provide insights on pricing, licensing, and business model if available
- Suggest which tool might be better for different use cases and user personas
- Be thorough, balanced, and evidence-based using information from the changelogs

Format your comparison in clear sections with headings. Be comprehensive but concise.`;

  const userPrompt = `Compare the following tools based on their changelogs:\n\n${toolContexts}\n\nCreate a comprehensive, well-structured comparison that helps users understand the differences and make informed decisions.`;

  const result = await generateText({
    model: openai('gpt-4-turbo'),
    system: systemPrompt,
    prompt: userPrompt,
  });

  return result.text;
}

/**
 * Main function to compare tools
 */
export async function compareTools(toolNames: string[]): Promise<{
  id: number;
  toolNames: string[];
  blobPath: string;
  content: string;
  recommendation: ComparisonRecommendation;
  createdAt: Date;
  updatedAt: Date;
}> {
  // SECURITY (workspace rule: do not use unvalidated external input in file paths):
  // Tool names flow into blob path construction; validate/sanitize them up-front.
  toolNames = z.array(ToolNameSchema).min(2).parse(toolNames);

  if (toolNames.length < 2) {
    throw new Error('At least 2 tools are required for comparison');
  }

  // Connect to database
  await connectDb();

  try {
    // Check if comparison already exists
    const sortedToolNames = [...toolNames].sort();
    const existing = await getComparisonWithContent(sortedToolNames);
    if (existing) {
      const recommendation =
        existing.result.recommendation ??
        (await generateRecommendationFromComparison(existing.content, existing.result.toolNames));

      // Backfill into DB if missing.
      if (!existing.result.recommendation) {
        await updateComparisonRecommendation(existing.result.id, recommendation);
      }
      return {
        id: existing.result.id,
        toolNames: existing.result.toolNames,
        blobPath: existing.result.blobPath,
        content: existing.content,
        recommendation,
        createdAt: existing.result.createdAt,
        updatedAt: existing.result.updatedAt,
      };
    }

    // Validate tools exist
    const availableTools = await listAvailableTools();
    const missingTools = toolNames.filter(name => !availableTools.includes(name));
    if (missingTools.length > 0) {
      throw new Error(`Tools not found in blob storage: ${missingTools.join(', ')}. Please process them with the web search agent first.`);
    }

    // Fetch changelogs
    const changelogData = await fetchToolChangelogs(toolNames);

    // Generate comparison using LLM
    const comparisonText = await generateComparison(changelogData, toolNames);

    // Generate a clear "which tool should I use?" recommendation
    const recommendation = await generateRecommendationFromComparison(comparisonText, toolNames);

    // Persist the recommendation inside the blob content so users can read it inline.
    const comparisonWithRecommendation =
      comparisonText.trimEnd() + '\n\n' + formatRecommendationSection(recommendation);

    // Save comparison to blob storage
    const blobFile = await saveComparisonFile(toolNames, comparisonWithRecommendation);

    // Store comparison metadata in database
    const id = await storeComparison(toolNames, blobFile.pathname, recommendation);

    // Fetch the stored comparison to return complete data
    const stored = await getComparisonWithContent(sortedToolNames);
    if (!stored) {
      throw new Error('Failed to retrieve stored comparison');
    }

    return {
      id: stored.result.id,
      toolNames: stored.result.toolNames,
      blobPath: stored.result.blobPath,
      content: stored.content,
      recommendation,
      createdAt: stored.result.createdAt,
      updatedAt: stored.result.updatedAt,
    };
  } finally {
    await disconnectDb();
  }
}

/**
 * Legacy comparison agent function (for backward compatibility)
 * @deprecated Use compareTools instead
 */
export async function comparisonAgent(items: string[]) {
  return await compareTools(items);
}
