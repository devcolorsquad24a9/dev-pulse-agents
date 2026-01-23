import 'dotenv/config';

import { z } from 'zod';
import { writeFile } from 'node:fs/promises';

import { monthlyNewsletterAgent } from '../web/lib/agents/monthlyNewsletterAgent.js';
import { sendWithResend } from '../web/lib/tools/email/resend.js';

const EmailSchema = z.string().email().max(254);

async function main() {
  const toEmailRaw = process.env.NEWSLETTER_TEST_TO;
  const shouldSend = process.env.NEWSLETTER_TEST_SEND === 'true';

  const sampleComparison = `## Summary
- Cursor shipped faster inline edits and multi-file refactors.
- VS Code remains strongest for extension ecosystem and stability.

## Ecosystem
VS Code has the broadest marketplace; Cursor focuses on curated AI workflows.

## Reliability
Both shipped fixes; VS Code tends to be more predictable on large workspaces.
`;

  const newsletter = await monthlyNewsletterAgent({
    monthLabel: 'Local Preview',
    theme: 'dark',
    noChangesThisMonth: false,
    includeFullComparison: true,
    maxFullComparisonChars: 12000,
    comparisons: [
      {
        toolNames: ['cursor', 'vscode'],
        comparisonContent: sampleComparison,
        recommendation: {
          recommendedTool: 'cursor',
          confidence: 'medium',
          rationale:
            'Default to Cursor if you want AI-first workflows and fast iteration. Prefer VS Code if you need the broadest extensions and enterprise stability.',
          whenToPickOthers: {
            vscode: 'Choose VS Code when extensions, remote dev integrations, or predictable stability matter most.',
          },
        },
      },
    ],
  });

  await writeFile('./newsletter-preview.html', newsletter.html, 'utf8');
  await writeFile('./newsletter-preview.txt', newsletter.text, 'utf8');

  console.log('Wrote newsletter-preview.html and newsletter-preview.txt');

  if (shouldSend) {
    const to = EmailSchema.parse(toEmailRaw);
    const from = process.env.NEWSLETTER_FROM;
    if (!from) throw new Error('NEWSLETTER_FROM environment variable is not set');

    const sent = await sendWithResend({
      from,
      to: [to],
      subject: `[Preview] ${newsletter.subject}`,
      html: newsletter.html,
      text: newsletter.text,
    });

    console.log('Sent preview email via Resend. Provider id:', sent.id);
  } else {
    console.log('Not sending (set NEWSLETTER_TEST_SEND=true and NEWSLETTER_TEST_TO=you@example.com to send).');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


