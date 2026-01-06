import { put, list, del, head } from '@vercel/blob';
import 'dotenv/config';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const ENV = process.env.NODE_ENV || 'development';
const FOLDER = ENV === 'production' ? 'prod' : 'dev';

export interface BlobFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
}

/**
 * Save or update a changelog file in Vercel Blob storage
 */
export async function saveChangelogFile(
  toolName: string,
  content: string
): Promise<BlobFile> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const pathname = `${FOLDER}/${toolName}/changelog.txt`;
  
  // Check if file exists
  try {
    const existing = await head(pathname, { token: BLOB_TOKEN });
    if (existing) {
      // Delete old file before creating new one
      await del(existing.url, { token: BLOB_TOKEN });
    }
  } catch (error) {
    // File doesn't exist, which is fine
  }

  // Upload new file
  const blob = await put(pathname, content, {
    access: 'public',
    token: BLOB_TOKEN,
    contentType: 'text/plain',
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    size: 0, // Size not available in PutBlobResult
    uploadedAt: new Date(), // Use current date
  };
}

/**
 * Get changelog file from blob storage
 */
export async function getChangelogFile(toolName: string): Promise<string | null> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const pathname = `${FOLDER}/${toolName}/changelog.txt`;
  
  try {
    const blob = await head(pathname, { token: BLOB_TOKEN });
    if (blob) {
      // Fetch the content
      const response = await fetch(blob.url);
      return await response.text();
    }
  } catch (error) {
    // File doesn't exist
    return null;
  }
  
  return null;
}

/**
 * List all changelog files in the current environment folder
 */
export async function listChangelogFiles(): Promise<BlobFile[]> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const { blobs } = await list({
    prefix: `${FOLDER}/`,
    token: BLOB_TOKEN,
  });

  return blobs.map(blob => ({
    url: blob.url,
    pathname: blob.pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt,
  }));
}

/**
 * List all available tools that have changelogs in blob storage
 * Returns an array of tool names extracted from blob paths
 */
export async function listAvailableTools(): Promise<string[]> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const { blobs } = await list({
    prefix: `${FOLDER}/`,
    token: BLOB_TOKEN,
  });

  // Extract tool names from paths like "dev/toolname/changelog.txt"
  const toolNames = new Set<string>();
  
  for (const blob of blobs) {
    const pathParts = blob.pathname.split('/');
    // Path format: "dev/toolname/changelog.txt" or "prod/toolname/changelog.txt"
    if (pathParts.length >= 3 && pathParts[2] === 'changelog.txt') {
      toolNames.add(pathParts[1]);
    }
  }

  return Array.from(toolNames).sort();
}

/**
 * Generate a consistent path for a comparison based on tool names
 * Sorts tool names to ensure consistent paths regardless of input order
 */
function getComparisonPath(toolNames: string[]): string {
  const sortedNames = [...toolNames].sort();
  const comparisonKey = sortedNames.join('-');
  return `${FOLDER}/comparisons/${comparisonKey}/comparison.txt`;
}

/**
 * Save or update a comparison file in Vercel Blob storage
 */
export async function saveComparisonFile(
  toolNames: string[],
  content: string
): Promise<BlobFile> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const pathname = getComparisonPath(toolNames);
  
  // Check if file exists
  try {
    const existing = await head(pathname, { token: BLOB_TOKEN });
    if (existing) {
      // Delete old file before creating new one
      await del(existing.url, { token: BLOB_TOKEN });
    }
  } catch (error) {
    // File doesn't exist, which is fine
  }

  // Upload new file
  const blob = await put(pathname, content, {
    access: 'public',
    token: BLOB_TOKEN,
    contentType: 'text/plain',
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    size: 0, // Size not available in PutBlobResult
    uploadedAt: new Date(), // Use current date
  };
}

/**
 * Get comparison file from blob storage
 */
export async function getComparisonFile(toolNames: string[]): Promise<string | null> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const pathname = getComparisonPath(toolNames);
  
  try {
    const blob = await head(pathname, { token: BLOB_TOKEN });
    if (blob) {
      // Fetch the content
      const response = await fetch(blob.url);
      return await response.text();
    }
  } catch (error) {
    // File doesn't exist
    return null;
  }
  
  return null;
}

/**
 * List all comparison files in the current environment folder
 */
export async function listComparisonFiles(): Promise<BlobFile[]> {
  if (!BLOB_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
  }

  const { blobs } = await list({
    prefix: `${FOLDER}/comparisons/`,
    token: BLOB_TOKEN,
  });

  return blobs.map(blob => ({
    url: blob.url,
    pathname: blob.pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt,
  }));
}

