import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getUseCase } from '@/lib/usecases';
import { buildPrompt } from '@/lib/promptBuilder';

export async function POST(req: NextRequest) {
  const client = new Anthropic();
  const { text, x, y, usecaseId } = await req.json() as {
    text: string;
    x: number;
    y: number;
    usecaseId: string;
  };

  const useCase = getUseCase(usecaseId);
  const prompt = buildPrompt(text, useCase, x, y);

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const message = await stream.finalMessage();
    const block = message.content[0];

    if (block.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type' }, { status: 500 });
    }

    const raw = block.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No JSON in response', raw }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[rewrite] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
