import { NextRequest, NextResponse } from 'next/server';
import { webSearchAgent } from '@/lib/agents/webSearchAgent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const result = await webSearchAgent(query);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Web search agent error:', error);
    return NextResponse.json(
      { error: 'Failed to perform web search' },
      { status: 500 }
    );
  }
}
