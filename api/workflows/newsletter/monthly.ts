import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { z } from 'zod';

import { runMonthlyNewsletterWorkflow } from '@/src/workflows/monthlyNewsletterWorkflow.js';

function requireCronSecret(req: VercelRequest): boolean {
  const expected = process.env.NEWSLETTER_CRON_SECRET;
  if (!expected) return false;

  const provided = (req.headers['x-cron-secret'] as string | undefined) ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const BodySchema = z.object({
    limit: z.number().int().min(1).max(10).optional(),
    monthLabel: z.string().trim().min(1).max(40).optional(),
    theme: z.enum(['dark', 'light']).optional(),
    dryRun: z.boolean().optional(),
    send: z.boolean().optional(),
  });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    // SECURITY: don't echo validation errors containing user input.
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const send = parsed.data.send ?? false;
  if (send && !requireCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await runMonthlyNewsletterWorkflow(parsed.data);
    res.status(200).json(result);
  } catch (e) {
    console.error('monthly newsletter workflow failed:', e);
    res.status(500).json({ error: 'Failed to run monthly newsletter workflow' });
  }
}


