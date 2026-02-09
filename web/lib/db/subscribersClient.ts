import { Client } from 'pg';
import 'dotenv/config';

let subscribersClient: Client | null = null;

export function getSubscribersDbClient(): Client {
  if (!subscribersClient) {
    const url = process.env.SUBSCRIBERS_DATABASE_URL;
    if (!url) {
      // Explicit, so it's obvious why sending/reading subscribers fails.
      throw new Error('SUBSCRIBERS_DATABASE_URL environment variable is not set');
    }
    subscribersClient = new Client({ connectionString: url });
  }
  return subscribersClient;
}

export async function connectSubscribersDb(): Promise<void> {
  const db = getSubscribersDbClient();
  try {
    await db.connect();
  } catch (error: any) {
    if (error?.message && String(error.message).includes('already been connected')) return;
    throw error;
  }
}

export async function disconnectSubscribersDb(): Promise<void> {
  if (subscribersClient) {
    await subscribersClient.end();
    subscribersClient = null;
  }
}


