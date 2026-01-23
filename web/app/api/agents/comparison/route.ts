import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { compareTools } from '@/lib/agents/comparisonAgent';

export const runtime = 'nodejs';

const ToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Invalid tool name');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toolNames, items } = body;
    
    // Support both toolNames (new) and items (legacy) for backward compatibility
    const tools = toolNames || items;
    if (!tools || !Array.isArray(tools) || tools.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 tool names are required for comparison' },
        { status: 400 }
      );
    }
    
    // SECURITY (workspace rule: validate/sanitize all external input)
    const parsedTools = z.array(ToolNameSchema).min(2).safeParse(tools);
    if (!parsedTools.success) {
      return NextResponse.json(
        { error: 'Invalid tool names' },
        { status: 400 }
      );
    }

    const result = await compareTools(parsedTools.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Comparison agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform comparison';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
