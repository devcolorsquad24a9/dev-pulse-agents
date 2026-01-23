/**
 * Monthly newsletter workflow
 *
 * Pulls the latest comparisons from Postgres + blob storage and renders the
 * monthly newsletter template (optionally sends it).
 *
 * SECURITY (workspace rules):
 * - Validates external input (limit/monthLabel/theme).
 * - Does not return or log subscriber emails.
 */

import { z } from 'zod';

import { connectDb, disconnectDb } from '../db/client';
import {
  getComparisonsByIds,
  listComparisons,
  listComparisonsSince,
  getComparisonWithContent,
} from '../db/comparisonStore';
import { listNewsletterSubscribers } from '../db/newsletterSubscribers';
import { monthlyNewsletterAgent } from '../agents/monthlyNewsletterAgent';
import {
  generateRecommendationFromComparison,
  stripRecommendationSection,
} from '../agents/comparisonRecommendation';
import { sendWithResend } from '../tools/email/resend';
import { getLastNewsletterRun, insertNewsletterRun } from '../db/newsletterRuns';

const ThemeSchema = z.enum(['dark', 'light']);

export interface RunMonthlyNewsletterOptions {
  monthLabel?: string;
  limit?: number; // number of comparisons to include
  theme?: 'dark' | 'light';
  dryRun?: boolean; // default true
  send?: boolean; // default false (requires from + subscribers + resend key)
}

export interface RunMonthlyNewsletterResult {
  subject: string;
  monthLabel: string;
  html: string;
  text: string;
  includedComparisonCount: number;
  sent: boolean;
  recipientCount?: number;
  providerEmailId?: string;
}

export async function runMonthlyNewsletterWorkflow(
  options: RunMonthlyNewsletterOptions
): Promise<RunMonthlyNewsletterResult> {
  const parsed = z
    .object({
      monthLabel: z.string().trim().min(1).max(40).optional(),
      limit: z.number().int().min(1).max(10).optional(),
      theme: ThemeSchema.optional(),
      dryRun: z.boolean().optional(),
      send: z.boolean().optional(),
    })
    .parse(options ?? {});

  const limit = parsed.limit ?? 3;
  const dryRun = parsed.dryRun ?? true;
  const send = parsed.send ?? false;
  const theme = parsed.theme ?? 'dark';

  await connectDb();
  try {
    const lastRun = await getLastNewsletterRun();

    // Only include comparisons created since the last successful send/run.
    // If there is no prior run, fall back to the most recent comparisons.
    let noChangesThisMonth = false;
    let recent =
      lastRun?.sentAt ? await listComparisonsSince(lastRun.sentAt, limit) : await listComparisons(limit);

    if (recent.length === 0) {
      // "Send anyway" mode: reuse last-run comparisons, but clearly label as no changes.
      noChangesThisMonth = true;
      if (!lastRun || !lastRun.comparisonIds || lastRun.comparisonIds.length === 0) {
        throw new Error('No comparisons available to send');
      }
      recent = await getComparisonsByIds(lastRun.comparisonIds);
      if (recent.length === 0) {
        throw new Error('No comparisons available to send');
      }
    }

    const comparisons = await Promise.all(
      recent.map(async r => {
        const stored = await getComparisonWithContent(r.toolNames);
        if (!stored) return null;

        const fullContent = stored.content;
        const comparisonContent = stripRecommendationSection(fullContent);
        const recommendation =
          r.recommendation ?? (await generateRecommendationFromComparison(fullContent, r.toolNames));

        return {
          toolNames: r.toolNames,
          comparisonContent,
          recommendation,
        };
      })
    );

    const included = comparisons.filter(Boolean) as NonNullable<(typeof comparisons)[number]>[];
    if (included.length === 0) {
      throw new Error('No comparison content could be loaded from blob storage');
    }

    const newsletter = await monthlyNewsletterAgent({
      monthLabel: parsed.monthLabel,
      comparisons: included,
      theme,
      noChangesThisMonth,
      includeFullComparison: true,
      maxFullComparisonChars: 12000,
    });

    if (dryRun || !send) {
      return {
        subject: newsletter.subject,
        monthLabel: newsletter.monthLabel,
        html: newsletter.html,
        text: newsletter.text,
        includedComparisonCount: included.length,
        sent: false,
      };
    }

    const from = process.env.NEWSLETTER_FROM;
    if (!from) {
      throw new Error('NEWSLETTER_FROM environment variable is not set');
    }

    const subscribers = await listNewsletterSubscribers();
    const to = subscribers.map(s => s.email);
    if (to.length === 0) {
      return {
        subject: newsletter.subject,
        monthLabel: newsletter.monthLabel,
        html: newsletter.html,
        text: newsletter.text,
        includedComparisonCount: included.length,
        sent: false,
        recipientCount: 0,
      };
    }

    const sent = await sendWithResend({
      from,
      to,
      subject: newsletter.subject,
      html: newsletter.html,
      text: newsletter.text,
    });

    // Persist this run so the next run can be incremental.
    await insertNewsletterRun({
      monthLabel: newsletter.monthLabel,
      subject: newsletter.subject,
      comparisonIds: recent.map(r => r.id),
      providerEmailId: sent.id,
      sentAt: new Date(),
    });

    return {
      subject: newsletter.subject,
      monthLabel: newsletter.monthLabel,
      html: newsletter.html,
      text: newsletter.text,
      includedComparisonCount: included.length,
      sent: true,
      recipientCount: to.length,
      providerEmailId: sent.id,
    };
  } finally {
    await disconnectDb();
  }
}


