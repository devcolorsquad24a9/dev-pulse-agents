import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { sql } from "@/lib/db";
import { SubscribePayloadSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = SubscribePayloadSchema.safeParse(body);
  if (!parsed.success) {
    // SECURITY (workspace rule: validate/sanitize all external input):
    // We return a generic message rather than echoing user input or internal validation details.
    return NextResponse.json(
      { message: "Please enter a valid email (and optional name/job role)." },
      { status: 400 }
    );
  }

  const { email, name, jobRole } = parsed.data;
  const id = randomUUID();

  try {
    // SECURITY:
    // `@vercel/postgres` uses parameterized queries via template literals, preventing SQL injection.
    await sql`
      INSERT INTO newsletter_subscribers (id, name, email, job_role)
      VALUES (${id}, ${name ?? null}, ${email}, ${jobRole ?? null})
      ON CONFLICT (email) DO NOTHING
    `;

    return NextResponse.json({
      message: "Received — you’ll receive our newsletter soon."
    });
  } catch {
    // Avoid leaking DB details.
    return NextResponse.json(
      { message: "We couldn’t save your email right now. Please try again." },
      { status: 500 }
    );
  }
}


