import { NextRequest, NextResponse } from 'next/server';
import { newsletterAgent } from '@/lib/agents/newsletterAgent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topics, style } = body;
    
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: 'At least one topic is required' },
        { status: 400 }
      );
    }
    
    const result = await newsletterAgent(topics, style);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Newsletter agent error:', error);
    return NextResponse.json(
      { error: 'Failed to generate newsletter' },
      { status: 500 }
    );
  }
}
