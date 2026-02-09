/**
 * Newsletter run persistence (main DB)
 *
 * SECURITY:
 * - Parameterized queries.
 * - No PII stored here.
 */

import { getDbClient } from './client';

export interface NewsletterRun {
  id: number;
  sentAt: Date;
  monthLabel: string | null;
  subject: string | null;
  comparisonIds: number[];
  providerEmailId: string | null;
  createdAt: Date;
}

export async function getLastNewsletterRun(): Promise<NewsletterRun | null> {
  const db = getDbClient();
  const result = await db.query(
    `SELECT id, sent_at, month_label, subject, comparison_ids, provider_email_id, created_at
     FROM newsletter_runs
     ORDER BY sent_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    sentAt: row.sent_at,
    monthLabel: row.month_label ?? null,
    subject: row.subject ?? null,
    comparisonIds: row.comparison_ids ?? [],
    providerEmailId: row.provider_email_id ?? null,
    createdAt: row.created_at,
  };
}

export async function insertNewsletterRun(input: {
  sentAt?: Date;
  monthLabel?: string;
  subject?: string;
  comparisonIds: number[];
  providerEmailId?: string;
}): Promise<number> {
  const db = getDbClient();
  const result = await db.query(
    `INSERT INTO newsletter_runs (sent_at, month_label, subject, comparison_ids, provider_email_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.sentAt ?? new Date(),
      input.monthLabel ?? null,
      input.subject ?? null,
      input.comparisonIds,
      input.providerEmailId ?? null,
    ]
  );
  return result.rows[0].id;
}


