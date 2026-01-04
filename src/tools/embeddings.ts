import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import 'dotenv/config';

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  });

  return embeddings;
}

/**
 * Chunk text into smaller pieces for embedding
 * Each chunk should be ~500-1000 tokens for optimal embedding quality
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const wordLength = word.length + 1; // +1 for space
    
    if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      
      // Start new chunk with overlap
      const overlapWords = currentChunk.slice(-Math.floor(overlap / 10));
      currentChunk = [...overlapWords, word];
      currentLength = overlapWords.join(' ').length + wordLength;
    } else {
      currentChunk.push(word);
      currentLength += wordLength;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

