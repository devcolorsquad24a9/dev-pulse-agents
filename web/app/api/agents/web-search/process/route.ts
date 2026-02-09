import { NextRequest, NextResponse } from 'next/server';
import { processChangelogs } from '@/lib/agents/webSearchAgent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tools } = body;
    
    if (!tools || !Array.isArray(tools)) {
      return NextResponse.json(
        { error: 'Tools array is required' },
        { status: 400 }
      );
    }
    
    const result = await processChangelogs(tools);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Changelog processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process changelogs' },
      { status: 500 }
    );
  }
}
