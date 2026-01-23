/**
 * Monthly Newsletter Agent
 *
 * Produces a consistent, modern HTML email (and plain-text fallback) that is
 * updated monthly with:
 * - Products/tools compared
 * - Comparison notes (quick digest)
 * - Recommendation (which tool to use + why)
 *
 * SECURITY (workspace rules):
 * - We never use unvalidated external input in blob paths or other path-like operations.
 * - We escape all dynamic content before inserting into HTML.
 * - We do not log subscriber emails/PII.
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import type { ComparisonRecommendation } from '../types/comparison';

export type NewsletterTheme = 'dark' | 'light';

export interface NewsletterComparisonInput {
  toolNames: string[];
  comparisonContent: string;
  recommendation: ComparisonRecommendation;
}

export interface MonthlyNewsletterInput {
  monthLabel?: string; // e.g. "January 2026"
  comparisons: NewsletterComparisonInput[];
  theme?: NewsletterTheme;
  /**
   * If true, the newsletter explicitly signals there were no new comparisons
   * since the last send (content is a rerun for continuity).
   */
  noChangesThisMonth?: boolean;
  /**
   * If true, include the full comparison content inline (no external link needed).
   * Default: true
   */
  includeFullComparison?: boolean;
  /**
   * Guardrail to prevent huge emails. If full comparison content exceeds this length,
   * we will truncate it and clearly label it as truncated.
   * Default: 12000
   */
  maxFullComparisonChars?: number;
}

export interface MonthlyNewsletterOutput {
  subject: string;
  html: string;
  text: string;
  monthLabel: string;
}

const ToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Invalid tool name');

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function monthLabelNow(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
}

const DigestSchema = z.object({
  title: z.string().min(1).max(120),
  highlights: z.array(z.string().min(1).max(180)).min(3).max(8),
  caveats: z.array(z.string().min(1).max(180)).max(5).optional(),
});

async function buildDigest(comparisonContent: string, toolNames: string[]) {
  // Allow local preview/testing without an OpenAI key: produce a deterministic digest.
  if (!process.env.OPENAI_API_KEY) {
    const title = `${toolNames.join(' vs ')} — monthly digest`;
    const lines = comparisonContent
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 6);
    const highlights =
      lines.length >= 3
        ? lines.slice(0, 6)
        : [
            'No AI digest available (OPENAI_API_KEY not set).',
            'Recommendation + quick notes are included below.',
            'Full comparison content is included (with truncation guard).',
          ];
    return { title, highlights, caveats: [] as string[] };
  }

  const system = `You write concise, technical release digests for developer tooling.
Return a quick digest that is easy to scan in an email.
Keep each bullet short and information-dense. Avoid marketing fluff.`;

  const prompt = `Tools compared: ${toolNames.join(', ')}

Comparison notes:
${comparisonContent}

Create:
- a short title
- 3-8 highlights capturing what's new/changed and key differences
- (optional) caveats (e.g. tradeoffs, constraints, notable risks)
Avoid repeating the recommendation verbatim; focus on actionable deltas.`;

  const result = await generateObject({
    model: openai('gpt-4-turbo'),
    system,
    prompt,
    schema: DigestSchema,
  });

  return result.object;
}

function renderToolPills(toolNames: string[]): string {
  const pills = toolNames
    .map(t => `<span class="pill">${escapeHtml(t)}</span>`)
    .join('');
  return `<div class="pills">${pills}</div>`;
}

function renderRecommendation(rec: ComparisonRecommendation): string {
  const whenOther =
    rec.whenToPickOthers && Object.keys(rec.whenToPickOthers).length > 0
      ? `<div class="muted" style="margin-top:12px">
          <div class="label">When to pick something else</div>
          <ul class="list">
            ${Object.entries(rec.whenToPickOthers)
              .map(([tool, reason]) => `<li><b>${escapeHtml(tool)}</b>: ${escapeHtml(reason)}</li>`)
              .join('')}
          </ul>
        </div>`
      : '';

  return `<div class="rec">
    <div class="label">Recommendation</div>
    <div class="rec-main">
      <div class="rec-tool">Use <span class="mono">${escapeHtml(rec.recommendedTool)}</span></div>
      <div class="rec-conf">Confidence: <b>${escapeHtml(rec.confidence)}</b></div>
    </div>
    <div class="rec-why">${escapeHtml(rec.rationale)}</div>
    ${whenOther}
  </div>`;
}

function renderFullComparison(content: string): string {
  const escaped = escapeHtml(content.trim());
  // Avoid <pre> because some clients reflow oddly; use a mono div with preserved whitespace.
  return `<div style="margin-top:12px">
    <div class="label">Full comparison</div>
    <div class="mono full">
${escaped}
    </div>
  </div>`;
}

function clampMaxChars(n: number): number {
  if (!Number.isFinite(n)) return 12000;
  return Math.max(1000, Math.min(50000, Math.floor(n)));
}

function truncateForEmail(content: string, maxChars: number): { content: string; truncated: boolean } {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return { content: trimmed, truncated: false };
  return { content: trimmed.slice(0, maxChars).trimEnd(), truncated: true };
}

function renderFullComparisonWithGuard(content: string, maxChars: number): string {
  const { content: safe, truncated } = truncateForEmail(content, maxChars);
  const escaped = escapeHtml(safe);

  const label = truncated ? 'Full comparison (truncated)' : 'Full comparison';
  const note = truncated
    ? `<div class="muted" style="margin-top:8px">Truncated to ${maxChars} characters to keep the email readable.</div>`
    : '';

  return `<div style="margin-top:12px">
    <div class="label">${label}</div>
    <div class="mono full">
${escaped}
    </div>
    ${note}
  </div>`;
}

function baseStyles(theme: NewsletterTheme): string {
  const isDark = theme !== 'light';
  const bg = isDark ? '#0b0f17' : '#f7f8fb';
  const panel = isDark ? '#101827' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
  const text = isDark ? '#e5e7eb' : '#0f172a';
  const muted = isDark ? 'rgba(229,231,235,0.70)' : 'rgba(15,23,42,0.70)';
  const accent = '#7c3aed';
  const accent2 = '#22c55e';

  // Email-safe inline CSS (kept minimal; avoid external fonts).
  return `
    body { margin:0; padding:0; background:${bg}; color:${text}; }
    .wrap { width:100%; background:${bg}; padding:24px 0; }
    .container { width:100%; max-width:720px; margin:0 auto; padding:0 16px; }
    .header { padding:20px 18px; border:1px solid ${border}; background:linear-gradient(135deg, ${panel}, rgba(124,58,237,0.10)); border-radius:16px; }
    .brand { font-weight:800; letter-spacing:0.2px; font-size:18px; }
    .month { margin-top:6px; color:${muted}; font-size:13px; }
    .h1 { margin:14px 0 0 0; font-size:22px; line-height:1.25; }
    .sub { margin-top:8px; color:${muted}; font-size:14px; line-height:1.5; }
    .grid { margin-top:16px; display:block; }
    .card { margin-top:14px; border:1px solid ${border}; background:${panel}; border-radius:16px; overflow:hidden; }
    .card-h { padding:16px 18px; border-bottom:1px solid ${border}; }
    .card-b { padding:16px 18px; }
    .title { font-size:16px; font-weight:750; margin:0; }
    .pills { margin-top:10px; }
    .pill { display:inline-block; margin:0 8px 8px 0; padding:6px 10px; border-radius:999px; border:1px solid ${border}; color:${muted}; font-size:12px; }
    .label { color:${muted}; font-size:12px; letter-spacing:0.3px; text-transform:uppercase; }
    .list { margin:10px 0 0 18px; padding:0; }
    .list li { margin:6px 0; color:${text}; font-size:14px; line-height:1.45; }
    .muted { color:${muted}; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .rec { padding:12px 12px; border-radius:14px; border:1px solid ${border}; background:linear-gradient(135deg, rgba(124,58,237,0.14), rgba(34,197,94,0.08)); }
    .rec-main { display:flex; justify-content:space-between; gap:12px; margin-top:8px; flex-wrap:wrap; }
    .rec-tool { font-size:15px; font-weight:800; }
    .rec-conf { font-size:13px; color:${muted}; }
    .rec-why { margin-top:10px; color:${text}; font-size:14px; line-height:1.5; }
    a { color:${accent}; text-decoration:none; }
    .btn { display:inline-block; margin-top:12px; padding:10px 12px; border-radius:12px; border:1px solid ${border}; background:rgba(124,58,237,0.12); color:${text}; font-weight:650; font-size:13px; }
    .footer { margin-top:18px; color:${muted}; font-size:12px; line-height:1.5; }
    .hr { height:1px; background:${border}; margin:14px 0; }
    .tag { display:inline-block; margin-left:8px; padding:3px 8px; border-radius:999px; font-size:11px; border:1px solid ${border}; color:${muted}; }
    .dot { color:${accent2}; font-weight:900; }
    .full { white-space:pre-wrap; word-break:break-word; font-size:12px; line-height:1.5; color:${muted}; padding:12px; border:1px solid ${border}; border-radius:14px; background:rgba(0,0,0,0.06); }
  `;
}

export async function monthlyNewsletterAgent(input: MonthlyNewsletterInput): Promise<MonthlyNewsletterOutput> {
  const monthLabel = (input.monthLabel?.trim() || monthLabelNow()).slice(0, 40);
  const theme: NewsletterTheme = input.theme ?? 'dark';
  const noChangesThisMonth = input.noChangesThisMonth ?? false;
  const includeFullComparison = input.includeFullComparison ?? true;
  const maxFullComparisonChars = clampMaxChars(input.maxFullComparisonChars ?? 12000);

  if (!input.comparisons || input.comparisons.length === 0) {
    throw new Error('At least one comparison is required to generate the newsletter');
  }

  // SECURITY: validate tool names up-front (prevents unsafe path-like usage downstream if callers
  // source tool names from external input).
  const comparisons = input.comparisons.map(c => ({
    ...c,
    toolNames: z.array(ToolNameSchema).min(2).parse(c.toolNames),
  }));

  const subjectTools = Array.from(new Set(comparisons.flatMap(c => c.toolNames))).slice(0, 4);
  const subjectBase =
    subjectTools.length > 0 ? `Dev Pulse — ${monthLabel}: ${subjectTools.join(' vs ')}` : `Dev Pulse — ${monthLabel}`;
  const subject = noChangesThisMonth ? `${subjectBase} (No changes)` : subjectBase;

  const digests = await Promise.all(
    comparisons.map(async c => ({
      toolNames: c.toolNames,
      recommendation: c.recommendation,
      full: c.comparisonContent,
      digest: await buildDigest(c.comparisonContent, c.toolNames),
    }))
  );

  const htmlCards = digests
    .map(d => {
      return `
        <div class="card">
          <div class="card-h">
            <div class="label">Comparison</div>
            <p class="title">${escapeHtml(d.digest.title)} <span class="tag"><span class="dot">●</span> updated</span></p>
            ${renderToolPills(d.toolNames)}
          </div>
          <div class="card-b">
            ${renderRecommendation(d.recommendation)}
            <div class="hr"></div>
            <div class="label">Quick notes</div>
            <ul class="list">
              ${d.digest.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
            </ul>
            ${
              d.digest.caveats && d.digest.caveats.length > 0
                ? `<div style="margin-top:12px">
                    <div class="label">Caveats</div>
                    <ul class="list">
                      ${d.digest.caveats.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                    </ul>
                  </div>`
                : ''
            }
            ${includeFullComparison ? renderFullComparisonWithGuard(d.full, maxFullComparisonChars) : ''}
          </div>
        </div>
      `;
    })
    .join('\n');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${baseStyles(theme)}</style>
    <title>Dev Pulse — ${escapeHtml(monthLabel)}</title>
  </head>
  <body>
    <div class="wrap">
      <div class="container">
        <div class="header">
          <div class="brand">Dev Pulse <span class="tag mono">monthly</span></div>
          <div class="month">${escapeHtml(monthLabel)}</div>
          <div class="h1">Tool updates you can scan in 2 minutes</div>
          <div class="sub">${
            noChangesThisMonth
              ? 'No new comparisons were generated since the last send — re-sharing the latest issue for continuity.'
              : 'What changed, what matters, and which tool to use—based on the latest comparison notes.'
          }</div>
        </div>
        <div class="grid">
          ${htmlCards}
        </div>
        <div class="footer">
          You’re receiving this because you subscribed to Dev Pulse. If you didn’t request this, you can ignore it.
        </div>
      </div>
    </div>
  </body>
</html>`;

  const textBlocks = digests
    .map(d => {
      const lines: string[] = [];
      lines.push(`== ${d.digest.title}`);
      lines.push(`Tools: ${d.toolNames.join(' vs ')}`);
      lines.push(`Recommendation: Use ${d.recommendation.recommendedTool} (confidence: ${d.recommendation.confidence})`);
      lines.push(d.recommendation.rationale);
      if (d.recommendation.whenToPickOthers && Object.keys(d.recommendation.whenToPickOthers).length > 0) {
        lines.push('When to pick something else:');
        for (const [tool, reason] of Object.entries(d.recommendation.whenToPickOthers)) {
          lines.push(`- ${tool}: ${reason}`);
        }
      }
      lines.push('Quick notes:');
      for (const h of d.digest.highlights) lines.push(`- ${h}`);
      if (d.digest.caveats && d.digest.caveats.length > 0) {
        lines.push('Caveats:');
        for (const c of d.digest.caveats) lines.push(`- ${c}`);
      }
      if (includeFullComparison) {
        const { content: safe, truncated } = truncateForEmail(d.full, maxFullComparisonChars);
        lines.push('Full comparison:');
        lines.push(safe);
        if (truncated) {
          lines.push(`(Truncated to ${maxFullComparisonChars} characters to keep the email readable.)`);
        }
      }
      return lines.join('\n');
    })
    .join('\n\n');

  const textPrefix = noChangesThisMonth
    ? `Dev Pulse — ${monthLabel}\n(No changes this month — re-sending the latest issue)\n`
    : `Dev Pulse — ${monthLabel}\n`;

  const text = `${textPrefix}\n${textBlocks}\n`;

  return { subject, html, text, monthLabel };
}


