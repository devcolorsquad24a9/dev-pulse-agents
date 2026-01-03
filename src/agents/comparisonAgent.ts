/**
 * Comparison Agent
 * Compares multiple tools based on their changelogs using a comprehensive rubric
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getChangelogFile, listAvailableTools } from '../storage/blob.js';
import { searchChangelogEmbeddings } from '../db/vectorStore.js';
import { connectDb, disconnectDb } from '../db/client.js';
import { storeComparison, getComparison } from '../db/comparisonStore.js';
import { ComparisonData } from '../types/comparison.js';

// Define Zod schema for structured output matching the comparison rubric
const comparisonRubricSchema = z.object({
  speedPerf: z.record(z.string()),
  reliabilityStability: z.record(z.string()),
  languageSupport: z.record(z.string()),
  debugging: z.record(z.string()),
  extensionsPlugins: z.record(z.string()),
  aiFeatures: z.record(z.string()),
  codeEditing: z.record(z.string()),
  remoteDevContainers: z.record(z.string()),
  collaboration: z.record(z.string()),
  integrations: z.record(z.string()),
  customization: z.record(z.string()),
  platformSupport: z.record(z.string()),
  deployment: z.record(z.string()),
  pricingLicensing: z.record(z.string()),
  updateFrequency: z.record(z.string()),
  communitySupport: z.record(z.string()),
  userInterface: z.record(z.string()),
  learningCurve: z.record(z.string()),
  bestFitPersonas: z.record(z.array(z.string())),
  useCases: z.record(z.string()),
});

const comparisonDataSchema = z.object({
  tools: z.array(z.string()),
  rubric: comparisonRubricSchema,
  decisionRules: z.string(),
});

// Rubric categories for semantic search
const RUBRIC_CATEGORIES = [
  { key: 'speedPerf', searchTerms: ['speed', 'performance', 'fast', 'slow', 'latency', 'response time', 'optimization'] },
  { key: 'reliabilityStability', searchTerms: ['reliability', 'stability', 'bug', 'crash', 'error', 'fix', 'stable'] },
  { key: 'languageSupport', searchTerms: ['language', 'programming language', 'syntax', 'parser', 'TypeScript', 'Python', 'JavaScript'] },
  { key: 'debugging', searchTerms: ['debug', 'debugger', 'breakpoint', 'inspect', 'troubleshoot'] },
  { key: 'extensionsPlugins', searchTerms: ['extension', 'plugin', 'marketplace', 'addon', 'package'] },
  { key: 'aiFeatures', searchTerms: ['AI', 'artificial intelligence', 'machine learning', 'model', 'GPT', 'Claude', 'Copilot', 'autocomplete', 'code generation'] },
  { key: 'codeEditing', searchTerms: ['autocomplete', 'refactor', 'rename', 'format', 'lint', 'snippet', 'code action'] },
  { key: 'remoteDevContainers', searchTerms: ['remote', 'container', 'Docker', 'SSH', 'WSL', 'dev container'] },
  { key: 'collaboration', searchTerms: ['collaboration', 'pair programming', 'share', 'team', 'multiplayer', 'live share'] },
  { key: 'integrations', searchTerms: ['integration', 'Git', 'CI/CD', 'API', 'webhook', 'service', 'connect'] },
  { key: 'customization', searchTerms: ['customize', 'theme', 'config', 'settings', 'workflow', 'keybinding', 'preference'] },
  { key: 'platformSupport', searchTerms: ['platform', 'OS', 'Windows', 'macOS', 'Linux', 'mobile', 'web', 'browser'] },
  { key: 'deployment', searchTerms: ['deploy', 'cloud', 'local', 'hosting', 'server', 'infrastructure'] },
  { key: 'pricingLicensing', searchTerms: ['price', 'pricing', 'license', 'subscription', 'free', 'paid', 'cost', 'tier'] },
  { key: 'updateFrequency', searchTerms: ['update', 'release', 'version', 'changelog', 'patch', 'upgrade', 'maintenance'] },
  { key: 'communitySupport', searchTerms: ['community', 'support', 'documentation', 'forum', 'discord', 'help', 'tutorial'] },
  { key: 'userInterface', searchTerms: ['UI', 'UX', 'interface', 'design', 'accessibility', 'theme', 'layout', 'view'] },
  { key: 'learningCurve', searchTerms: ['learn', 'onboarding', 'tutorial', 'guide', 'documentation', 'easy', 'simple', 'complex'] },
  { key: 'bestFitPersonas', searchTerms: ['beginner', 'enterprise', 'professional', 'developer', 'team', 'individual', 'student'] },
  { key: 'useCases', searchTerms: ['use case', 'scenario', 'workflow', 'project', 'application', 'suitable for', 'ideal for'] },
];

/**
 * Get relevant chunks for a specific rubric category using semantic search
 */
async function getRelevantChunksForComparison(
  toolName: string,
  category: { key: string; searchTerms: string[] }
): Promise<string[]> {
  // Create a query from search terms
  const query = `${category.searchTerms.join(' ')} ${toolName}`;
  
  // Search for relevant chunks (limit to top 5 per category to manage token usage)
  const chunks = await searchChangelogEmbeddings(query, 5, toolName);
  
  return chunks.map(chunk => chunk.contentChunk);
}

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
 * Generate comparison using LLM with structured output
 */
async function generateComparison(
  changelogData: Map<string, string>,
  categoryChunks: Map<string, Map<string, string[]>>,
  toolNames: string[]
): Promise<ComparisonData> {
  // Build context for each tool
  const toolContexts = toolNames.map(toolName => {
    const fullContent = changelogData.get(toolName) || '';
    const chunks = categoryChunks.get(toolName) || new Map();
    
    // Build category-specific context
    const categoryContext = RUBRIC_CATEGORIES.map(cat => {
      const relevantChunks = chunks.get(cat.key) || [];
      return `## ${cat.key}:\n${relevantChunks.length > 0 ? relevantChunks.join('\n\n') : 'No specific information found for this category.'}`;
    }).join('\n\n');
    
    return `### Tool: ${toolName}\n\nFull Changelog:\n${fullContent.substring(0, 10000)}\n\nCategory-Specific Information:\n${categoryContext}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `You are an expert at analyzing development tools and creating comprehensive comparisons. 
Analyze the provided changelog information for each tool and create a detailed comparison following the rubric below.

For each rubric category, provide:
- Pros and cons for each tool
- Specific features, capabilities, or characteristics mentioned in the changelog
- Tradeoffs and differences between tools
- If no information is available for a category, use "No information available in changelog"

Rubric Categories:
1. speedPerf: Performance metrics, speed, responsiveness, optimization
2. reliabilityStability: Bug fixes, stability improvements, error handling
3. languageSupport: Programming language support, syntax highlighting, language features
4. debugging: Debugging tools, breakpoints, inspection capabilities
5. extensionsPlugins: Extension ecosystem, plugin support, marketplace
6. aiFeatures: AI-powered features, code generation, intelligent assistance
7. codeEditing: Code editing features, autocomplete, refactoring, formatting
8. remoteDevContainers: Remote development, container support, SSH, WSL
9. collaboration: Team collaboration, pair programming, sharing features
10. integrations: Third-party integrations, Git, CI/CD, APIs, services
11. customization: Theming, configuration, workflow customization
12. platformSupport: Operating system support, platform compatibility
13. deployment: Deployment options, cloud, local, hosting
14. pricingLicensing: Pricing models, licensing, subscription tiers
15. updateFrequency: Release cadence, update patterns, maintenance
16. communitySupport: Community size, documentation, support resources
17. userInterface: UI/UX design, accessibility, interface quality
18. learningCurve: Ease of learning, onboarding, documentation quality
19. bestFitPersonas: Target users (beginner, enterprise, polyglot, etc.)
20. useCases: Specific scenarios where each tool excels

Generate decision rules that summarize when to choose each tool based on the comparison.`;

  const userPrompt = `Compare the following tools based on their changelogs:\n\n${toolContexts}\n\nCreate a comprehensive comparison following the rubric. For bestFitPersonas, provide an array of persona types (e.g., ["beginner", "enterprise", "polyglot"]).`;

  const result = await generateObject({
    model: openai('gpt-4-turbo'),
    schema: comparisonDataSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return result.object;
}

/**
 * Main function to compare tools
 */
export async function compareTools(toolNames: string[]): Promise<ComparisonData & { id?: number }> {
  if (toolNames.length < 2) {
    throw new Error('At least 2 tools are required for comparison');
  }

  // Connect to database
  await connectDb();

  try {
    // Check if comparison already exists
    const sortedToolNames = [...toolNames].sort();
    const existing = await getComparison(sortedToolNames);
    if (existing) {
      return {
        ...existing.comparisonData,
        id: existing.id,
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

    // Get relevant chunks for each category for each tool
    const categoryChunks = new Map<string, Map<string, string[]>>();
    
    for (const toolName of toolNames) {
      const toolChunks = new Map<string, string[]>();
      
      for (const category of RUBRIC_CATEGORIES) {
        const chunks = await getRelevantChunksForComparison(toolName, category);
        toolChunks.set(category.key, chunks);
      }
      
      categoryChunks.set(toolName, toolChunks);
    }

    // Generate comparison using LLM
    const comparison = await generateComparison(changelogData, categoryChunks, toolNames);

    // Store comparison in database
    const id = await storeComparison(comparison);

    return {
      ...comparison,
      id,
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
