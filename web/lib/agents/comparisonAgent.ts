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

  const systemPrompt = `
  You are a senior developer-tools analyst and technical writer. Your job is to compare TOOLS BASED ON THEIR RECENT CHANGES ONLY (changelogs / release notes provided), and to translate those changes into practical workflow impact for builders: indie hackers, working devs, tech leads.
  
  Important framing:
  - A changelog is NOT a full product review. Treat it as a window into what changed recently, what the team is prioritizing, and what workflows are being improved or corrected.
  - Do NOT assume feature parity or infer missing capabilities. If something isn’t mentioned, it may still exist; label it “Not evidenced in the provided changelog”.
  
  Evidence rules (non-negotiable):
  - Use ONLY the provided changelog text. Do not invent facts.
  - When you make a specific claim about a change, include a short supporting quote (<= 20 words) or a precise reference to the change entry.
  - If pricing/benchmarks/SLAs/security posture aren’t mentioned, mark “Unknown from changelog” and suggest what to verify.
  
  What “good” looks like:
  - You are comparing deltas, momentum, and workflow implications.
  - You highlight: what’s newly possible, what’s newly safer, what’s newly annoying, and what this signals about product direction.
  - You call out breaking changes, migrations, deprecations, and operational risk clearly.
  
  Tone and style:
  - Reads like an elite technical blog post or practitioner email: crisp, confident, opinionated-but-fair.
  - Skimmable headings, tight bullets, minimal filler.
  - Practitioner mindset: shipping speed, reliability, maintenance cost, integration friction, vendor risk.
  
  Output structure (use these sections, but be flexible):
  1) Executive takeaway (what changed lately + who benefits)
  2) What actually shipped (per tool: the 3–7 most meaningful updates)
  3) Workflow impact (how daily work changes; before/after)
  4) Themes & product direction (what the changelog signals)
  5) Reliability & risk signals (bug fix density, regressions, breaking changes, migrations)
  6) DX & adoption friction (setup, ergonomics, docs, learning curve signals from changes)
  7) Integrations & ecosystem momentum (connectors, APIs, plugins, community cues)
  8) Persona recommendations (at least 4 personas; tie to shipped changes)
  9) “Try this next” checklist (concrete steps users can take to evaluate)
  10) Appendix: Evidence map (claim → tool → changelog quote)

  Voice constraints:
  - Use short sentences.
  - Use occasional punchy subheads (3–6 words).
  - One tasteful opinion per major section, but always tied to evidence.
  - No hype words like “revolutionary”, “game-changing”, “best-in-class”.
  - remove all obvious 'AI writing' markers.
    Strictly avoid:
    Em dashes (—) and excessive colons.
    The words: 'delve,' 'tapestry,' 'moreover,' 'furthermore,' 'testament,' 'landscape,' 'game-changer,' 'leverage,' 'utilize.'
    The structure: 'It’s not just X—it’s Y.'
    The pattern: [Noun]: A [Adjective] [Noun] (e.g., 'The result? A more productive...')
    Instead: Use short, simple sentences, conversational tone, and active voice. Write like a human in a hurry."
  
  Delta scoring (optional but useful if enough evidence):
  - Score each tool 1–10 on: Shipping Velocity, Workflow Impact, Stability Signals, Integration Momentum, Risk/Churn.
  - Each score must be justified with evidence; otherwise omit scoring.
  
  Process:
  - First extract a “Delta Ledger” per tool: a categorized list of changes (Feature, Fix, Performance, Security, Breaking, Integration, UX).
  - Then write the comparison.
  - Final pass: remove repetition, add punchy subheads, keep it honest.
  `;
  

  const userPrompt = `
  Compare the following tools using ONLY the provided changelog / release-note text.
  This is a DELTA-BASED comparison (recent changes only), not a comprehensive product review.
  
  Input changelogs:
  ${toolContexts}
  
  You MUST structure the output using the following sections
  (use these headings verbatim and in this exact order):
  
  ## 1. Executive Takeaway
  - 6–10 sentences summarizing what changed recently and who benefits.
  - Do NOT describe the full product — only recent deltas.
  
  ## 2. What Actually Shipped (Recent Changes)
  For EACH tool:
  - List the 3–7 most meaningful recent updates.
  - Group updates by type: Feature, Fix, Performance, Breaking, Integration, UX.
  - Include short evidence quotes (<=20 words) from the changelog.
  
  ## 3. Workflow Impact Analysis
  - Explain how daily developer workflows change as a result of these updates.
  - Use “Before → After” framing where possible.
  - Call out who feels the impact most (solo dev, team, platform, ops).
  
  ## 4. Themes & Product Direction
  - What do these changes signal about each tool’s priorities?
  - Focus on momentum, not feature completeness.
  - If direction is unclear, explicitly say so.
  
  ## 5. Reliability & Risk Signals
  - Bug fix density, regressions, breaking changes, migrations.
  - Call out any operational or upgrade risks.
  - If no signals exist, state “No clear reliability signals in changelog”.
  
  ## 6. Developer Experience (DX) Signals
  - Setup friction, ergonomics, docs, learning curve — inferred ONLY from changes.
  - Label any uncertainty explicitly.
  
  ## 7. Integrations & Ecosystem Momentum
  - New or improved integrations, APIs, plugins, community-facing changes.
  - If not mentioned, mark “Not evidenced in provided changelog”.
  
  ## 8. Persona-Based Recommendations
  Provide recommendations for at least:
  - Solo indie hacker
  - Small startup team
  - Platform / infra team
  - Enterprise / regulated org
  Tie each recommendation directly to shipped changes.
  
  ## 9. “Try This Next” Evaluation Checklist
  - 6–10 concrete steps users can take to evaluate the tools based on the new updates.
  
  ## 10. Appendix: Evidence Map
  Create a table:
  Claim | Tool | Changelog Evidence (short quote)
  
  Rules:
  - Do NOT assume missing features are absent.
  - If a capability, metric, or claim is not supported by the changelog:
    - Do not mention it explicitly.
    - Do not speculate.
    - Either omit the topic entirely or phrase conclusions cautiously (e.g., “Recent updates focus primarily on…”, “The changelog emphasizes…”).
    - Only surface uncertainty when it meaningfully affects user decision-making, and do so in natural, human language.
  - Do NOT introduce external knowledge.
  - Never use meta phrases such as “not evidenced”, “not provided”, or “insufficient data”.
  - Write as a human expert would: by omission, emphasis, and careful wording.
  `;
  
  
  const result = await generateText({
    model: openai('gpt-4.1'),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    topP: 0.9,
    maxTokens: 1800,
    presencePenalty: 0,
    frequencyPenalty: 0.2,
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
    await storeComparison(toolNames, blobFile.pathname, recommendation);

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
