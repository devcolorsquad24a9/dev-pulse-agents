import { NextRequest, NextResponse } from 'next/server';
import { recommendationAgent } from '@/lib/agents/recommendationAgent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context, preferences } = body;
    
    if (!context) {
      return NextResponse.json(
        { error: 'Context is required' },
        { status: 400 }
      );
    }
    
    const result = await recommendationAgent(context, preferences);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Recommendation agent error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
