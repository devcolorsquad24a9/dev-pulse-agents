/**
 * Web Search Agent
 * Processes changelogs from tools and stores them in vector database
 */

import { scrapeChangelog } from '../tools/scraper';
import { saveChangelogFile, getChangelogFile } from '../storage/blob';
import { storeChangelogEmbeddings, searchChangelogEmbeddings } from '../db/vectorStore';
import { connectDb, disconnectDb } from '../db/client';
import crypto from 'crypto';

export interface ToolConfig {
  name: string;
  url: string;
}

export interface ChangelogUpdateResult {
  toolName: string;
  toolUrl: string;
  updated: boolean;
  blobPath: string;
  chunksStored: number;
  error?: string;
}

/**
 * Process a single tool's changelog
 */
async function processToolChangelog(
  tool: ToolConfig
): Promise<ChangelogUpdateResult> {
  try {
    // 1. Scrape the changelog
    const scraped = await scrapeChangelog(tool.url);
    
    // 2. Get existing content from blob storage
    const existingContent = await getChangelogFile(tool.name);
    
    // 3. Check if content has changed
    const contentHash = crypto
      .createHash('sha256')
      .update(scraped.content)
      .digest('hex');
    
    const existingHash = existingContent
      ? crypto.createHash('sha256').update(existingContent).digest('hex')
      : null;
    
    const hasChanged = contentHash !== existingHash;
    
    if (!hasChanged && existingContent) {
      return {
        toolName: tool.name,
        toolUrl: tool.url,
        updated: false,
        blobPath: `${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}/${tool.name}/changelog.txt`,
        chunksStored: 0,
      };
    }
    
    // 4. Save to blob storage
    const blobFile = await saveChangelogFile(tool.name, scraped.content);
    
    // 5. Store embeddings in vector database
    await storeChangelogEmbeddings(
      tool.name,
      tool.url,
      scraped.content,
      blobFile.pathname,
      scraped.metadata
    );
    
    // Count chunks (rough estimate based on paragraphs)
    const chunks = scraped.content.split(/\n\n+/).length;
    
    return {
      toolName: tool.name,
      toolUrl: tool.url,
      updated: true,
      blobPath: blobFile.pathname,
      chunksStored: chunks,
    };
  } catch (error) {
    return {
      toolName: tool.name,
      toolUrl: tool.url,
      updated: false,
      blobPath: '',
      chunksStored: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Web Search Agent - Processes changelogs from multiple tools
 */
export async function processChangelogs(tools: ToolConfig[]) {
  // Connect to database
  await connectDb();
  
  try {
    const results: ChangelogUpdateResult[] = [];
    
    // Process each tool's changelog
    for (const tool of tools) {
      const result = await processToolChangelog(tool);
      results.push(result);
    }
    
    return {
      success: true,
      processed: results.length,
      updated: results.filter(r => r.updated).length,
      results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await disconnectDb();
  }
}

/**
 * Search changelogs using semantic search
 */
export async function searchChangelogs(
  query: string,
  toolName?: string,
  limit: number = 10
) {
  await connectDb();
  
  try {
    const results = await searchChangelogEmbeddings(query, limit, toolName);
    
    return {
      success: true,
      query,
      results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await disconnectDb();
  }
}

/**
 * Legacy web search agent (kept for backward compatibility)
 * @deprecated Use processChangelogs or searchChangelogs instead
 */
export async function webSearchAgent(query: string) {
  // For backward compatibility, redirect to search
  return await searchChangelogs(query);
}
