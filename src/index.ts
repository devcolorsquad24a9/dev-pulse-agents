/**
 * Main entry point for the multi-agent workflow system
 * Express.js backend server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  webSearchAgent,
  processChangelogs,
  searchChangelogs,
  compareTools,
  recommendationAgent,
  newsletterAgent,
  monthlyNewsletterAgent,
} from './agents/index.js';

import { connectDb, disconnectDb } from './db/client.js';
import { listNewsletterSubscribers } from './db/newsletterSubscribers.js';
import { sendWithResend } from './tools/email/resend.js';
import { z } from 'zod';
import crypto from 'node:crypto';
import { runMonthlyNewsletterWorkflow } from './workflows/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const ToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Invalid tool name');

function requireCronSecret(req: express.Request): boolean {
  const expected = process.env.NEWSLETTER_CRON_SECRET;
  if (!expected) return false;

  const provided = req.header('x-cron-secret') ?? '';
  // Constant-time compare (best-effort).
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Multi-agent workflow system is running' });
});

// Web Search Agent endpoints
app.post('/api/agents/web-search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const result = await webSearchAgent(query);
    res.json(result);
  } catch (error) {
    console.error('Web search agent error:', error);
    res.status(500).json({ error: 'Failed to perform web search' });
  }
});

// Process changelogs from tools
app.post('/api/agents/web-search/process', async (req, res) => {
  try {
    const { tools } = req.body;
    if (!tools || !Array.isArray(tools)) {
      res.status(400).json({ error: 'Tools array is required' });
      return;
    }
    const result = await processChangelogs(tools);
    res.json(result);
  } catch (error) {
    console.error('Changelog processing error:', error);
    res.status(500).json({ error: 'Failed to process changelogs' });
  }
});

// Search changelogs using semantic search
app.post('/api/agents/web-search/search', async (req, res) => {
  try {
    const { query, toolName, limit } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const result = await searchChangelogs(query, toolName, limit);
    res.json(result);
  } catch (error) {
    console.error('Changelog search error:', error);
    res.status(500).json({ error: 'Failed to search changelogs' });
  }
});

// Comparison Agent endpoint
app.post('/api/agents/comparison', async (req, res) => {
  try {
    const { toolNames, items } = req.body;
    // Support both toolNames (new) and items (legacy) for backward compatibility
    const tools = toolNames || items;
    if (!tools || !Array.isArray(tools) || tools.length < 2) {
      res.status(400).json({ error: 'At least 2 tool names are required for comparison' });
      return;
    }
    // SECURITY (workspace rule: validate/sanitize all external input)
    const parsedTools = z.array(ToolNameSchema).min(2).safeParse(tools);
    if (!parsedTools.success) {
      res.status(400).json({ error: 'Invalid tool names' });
      return;
    }

    const result = await compareTools(parsedTools.data);
    res.json(result);
  } catch (error) {
    console.error('Comparison agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform comparison';
    res.status(500).json({ error: errorMessage });
  }
});

// Recommendation Agent endpoint
app.post('/api/agents/recommendation', async (req, res) => {
  try {
    const { context, preferences } = req.body;
    if (!context) {
      res.status(400).json({ error: 'Context is required' });
      return;
    }
    const result = await recommendationAgent(context, preferences);
    res.json(result);
  } catch (error) {
    console.error('Recommendation agent error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Newsletter Agent endpoint
app.post('/api/agents/newsletter', async (req, res) => {
  try {
    const { topics, style } = req.body;
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({ error: 'At least one topic is required' });
      return;
    }
    const result = await newsletterAgent(topics, style);
    res.json(result);
  } catch (error) {
    console.error('Newsletter agent error:', error);
    res.status(500).json({ error: 'Failed to generate newsletter' });
  }
});

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
app.post('/api/agents/newsletter/monthly', async (req, res) => {
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
    const body = await Promise.resolve(req.body);
    const result = BodySchema.safeParse(body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
    parsed = result.data;
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const dryRun = parsed.dryRun ?? true;

  try {
    const newsletter = await monthlyNewsletterAgent({
      monthLabel: parsed.monthLabel,
      comparisons: parsed.comparisons,
      theme: 'dark',
    });

    if (dryRun) {
      res.json({
        subject: newsletter.subject,
        monthLabel: newsletter.monthLabel,
        html: newsletter.html,
        text: newsletter.text,
        sent: false,
      });
      return;
    }

    if (!requireCronSecret(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const from = process.env.NEWSLETTER_FROM;
    if (!from) {
      res.status(500).json({ error: 'NEWSLETTER_FROM environment variable is not set' });
      return;
    }

    // Fetch subscribers from DB and send.
    await connectDb();
    const subscribers = await listNewsletterSubscribers();
    const to = subscribers.map(s => s.email);
    if (to.length === 0) {
      res.json({ sent: false, message: 'No subscribers found' });
      return;
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
    res.json({ sent: true, providerEmailId: sent.id, recipientCount: to.length });
  } catch (error) {
    console.error('Monthly newsletter error:', error);
    res.status(500).json({ error: 'Failed to generate/send monthly newsletter' });
  } finally {
    try {
      await disconnectDb();
    } catch {
      // Ignore disconnect errors
    }
  }
});

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
app.post('/api/workflows/newsletter/monthly', async (req, res) => {
  const BodySchema = z.object({
    limit: z.number().int().min(1).max(10).optional(),
    monthLabel: z.string().trim().min(1).max(40).optional(),
    theme: z.enum(['dark', 'light']).optional(),
    dryRun: z.boolean().optional(),
    send: z.boolean().optional(),
  });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
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
    res.json(result);
  } catch (error) {
    console.error('Monthly newsletter workflow error:', error);
    res.status(500).json({ error: 'Failed to run monthly newsletter workflow' });
  }
});

app.listen(PORT, () => {
  console.log('Multi-agent workflow system initialized');
  console.log(`Server running on port ${PORT}`);
});

