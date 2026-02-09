import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { runMonthlyNewsletterWorkflow } from '@/lib/workflows/monthlyNewsletterWorkflow';

export const runtime = 'nodejs';

function requireCronSecret(req: NextRequest): boolean {
  const expected = process.env.NEWSLETTER_CRON_SECRET;
  if (!expected) return false;

  const provided = req.headers.get('x-cron-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Monthly newsletter workflow (pulls latest comparisons automatically).
 *
 * Body:
 * - limit?: number (default 3)
 * - monthLabel?: string
 * - theme?: "dark" | "light"
 * - dryRun?: boolean (default true)
 * - send?: boolean (default false)
 *
 * SECURITY:
 * - Requires `x-cron-secret` header ONLY when `send: true`.
 * - Does not return subscriber emails.
 */
export async function POST(req: NextRequest) {
  const BodySchema = z.object({
    limit: z.number().int().min(1).max(10).optional(),
    monthLabel: z.string().trim().min(1).max(40).optional(),
    theme: z.enum(['dark', 'light']).optional(),
    dryRun: z.boolean().optional(),
    send: z.boolean().optional(),
  });

  let parsed: z.infer<typeof BodySchema>;
  try {
    const body = await req.json();
    const result = BodySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const send = parsed.send ?? false;
  if (send && !requireCronSecret(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await runMonthlyNewsletterWorkflow(parsed);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Monthly newsletter workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to run monthly newsletter workflow' },
      { status: 500 }
    );
  }
}
