/**
 * Newsletter subscribers (Postgres)
 *
 * SECURITY (workspace rules):
 * - Query is parameterized.
 * - Avoid logging subscriber emails/PII.
 * - Callers must validate any external input used to filter results.
 */

import { connectSubscribersDb, disconnectSubscribersDb, getSubscribersDbClient } from './subscribersClient.js';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  jobRole: string | null;
  createdAt: Date;
}

export async function listNewsletterSubscribers(limit: number = 5000): Promise<NewsletterSubscriber[]> {
  await connectSubscribersDb();
  const db = getSubscribersDbClient();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(10000, Math.floor(limit))) : 5000;

  try {
    const result = await db.query(
      `SELECT id, email, name, job_role, created_at
       FROM newsletter_subscribers
       ORDER BY created_at DESC
       LIMIT $1`,
      [safeLimit]
    );

    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name ?? null,
      jobRole: row.job_role ?? null,
      createdAt: row.created_at,
    }));
  } finally {
    await disconnectSubscribersDb();
  }
}


