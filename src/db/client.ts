import { Client } from 'pg';
import 'dotenv/config';

let client: Client | null = null;

export function getDbClient(): Client {
  if (!client) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    client = new Client({
      connectionString: databaseUrl,
    });
  }
  return client;
}

export async function connectDb(): Promise<void> {
  const db = getDbClient();
  if (!db) {
    throw new Error('Database client not initialized');
  }
  // Only connect if not already connected
  // Check if client is ending or already connected
  if (db._ending) {
    // Client is ending, create a new one
    await disconnectDb();
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    client = new Client({
      connectionString: databaseUrl,
    });
    await client.connect();
    return;
  }
  
  // Try to connect, but catch "already connected" error
  try {
    await db.connect();
  } catch (error: any) {
    // If already connected, ignore the error
    if (error.message && error.message.includes('already been connected')) {
      // Client is already connected, which is fine
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

