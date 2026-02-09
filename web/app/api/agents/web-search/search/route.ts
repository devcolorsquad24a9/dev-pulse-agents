import { NextRequest, NextResponse } from 'next/server';
import { searchChangelogs } from '@/lib/agents/webSearchAgent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, toolName, limit } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const result = await searchChangelogs(query, toolName, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Changelog search error:', error);
    return NextResponse.json(
      { error: 'Failed to search changelogs' },
      { status: 500 }
    );
  }
}
