/**
 * Minimal Resend email sender (no extra deps).
 *
 * SECURITY (workspace rules):
 * - Uses HTTPS.
 * - API key comes from environment variables (no hardcoded secrets).
 * - Never logs recipient emails.
 */

import 'dotenv/config';

export interface ResendSendEmailInput {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendWithResend(input: ResendSendEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    // SECURITY: don't echo full provider error details to callers in production paths.
    throw new Error(`Resend send failed with status ${res.status}`);
  }

  const data: any = await res.json();
  if (!data?.id) {
    throw new Error('Resend send succeeded but no email id was returned');
  }

  return { id: data.id };
}


