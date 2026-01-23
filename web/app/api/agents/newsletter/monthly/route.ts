import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { monthlyNewsletterAgent } from '@/lib/agents/monthlyNewsletterAgent';
import { connectDb, disconnectDb } from '@/lib/db/client';
import { listNewsletterSubscribers } from '@/lib/db/newsletterSubscribers';
import { sendWithResend } from '@/lib/tools/email/resend';

export const runtime = 'nodejs';

const ToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Invalid tool name');

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
 * Monthly newsletter: generate (and optionally send) a consistent template populated from comparisons.
 *
 * Request body:
 * - comparisons: [{ toolNames: string[], comparison: { content, recommendation, blobUrl? } }]
 * - monthLabel?: string
 * - dryRun?: boolean (default true)
 *
 * SECURITY:
 * - Requires `x-cron-secret` header to send emails.
 * - Validates all external input (tool names, content types).
 * - Avoids returning subscriber emails in responses.
 */
export async function POST(req: NextRequest) {
  const BodySchema = z.object({
    monthLabel: z.string().trim().min(1).max(40).optional(),
    dryRun: z.boolean().optional(),
    comparisons: z
      .array(
        z.object({
          toolNames: z.array(ToolNameSchema).min(2),
          comparisonContent: z.string().min(1),
          recommendation: z.object({
            recommendedTool: z.string().min(1),
            confidence: z.enum(['high', 'medium', 'low']),
            rationale: z.string().min(1),
            whenToPickOthers: z.record(z.string(), z.string()).optional(),
          }),
          comparisonUrl: z.string().url().optional(),
        })
      )
      .min(1),
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

  const dryRun = parsed.dryRun ?? true;

  try {
    const newsletter = await monthlyNewsletterAgent({
      monthLabel: parsed.monthLabel,
      comparisons: parsed.comparisons,
      theme: 'dark',
    });

    if (dryRun) {
      return NextResponse.json({
        subject: newsletter.subject,
        monthLabel: newsletter.monthLabel,
        html: newsletter.html,
        text: newsletter.text,
        sent: false,
      });
    }

    if (!requireCronSecret(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const from = process.env.NEWSLETTER_FROM;
    if (!from) {
      return NextResponse.json(
        { error: 'NEWSLETTER_FROM environment variable is not set' },
        { status: 500 }
      );
    }

    // Fetch subscribers from DB and send.
    await connectDb();
    const subscribers = await listNewsletterSubscribers();
    const to = subscribers.map(s => s.email);
    if (to.length === 0) {
      return NextResponse.json({ sent: false, message: 'No subscribers found' });
    }

    // Resend accepts arrays; keep it simple for now (can be chunked later if needed).
    const sent = await sendWithResend({
      from,
      to,
      subject: newsletter.subject,
      html: newsletter.html,
      text: newsletter.text,
    });

    // SECURITY: don't return subscriber list.
    return NextResponse.json({ sent: true, providerEmailId: sent.id, recipientCount: to.length });
  } catch (error) {
    console.error('Monthly newsletter error:', error);
    return NextResponse.json(
      { error: 'Failed to generate/send monthly newsletter' },
      { status: 500 }
    );
  } finally {
    try {
      await disconnectDb();
    } catch {
      // Ignore disconnect errors
    }
  }
}
