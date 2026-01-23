import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Multi-agent workflow system is running' 
  });
}
