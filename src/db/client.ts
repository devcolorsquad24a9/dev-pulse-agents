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
  await db.connect();
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

