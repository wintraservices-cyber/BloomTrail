// Shared wrapper for the AI routes: auth check, optional monthly cap,
// Gemini call, usage logging.
import { NextResponse } from 'next/server';
import { callGemini, AiError } from '@/lib/gemini';
import { logAiUsage, getUsageSummary } from '@/lib/db';

export async function runAiFeature(request, { feature, system, buildPrompt, maxOutputTokens, field }) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const text = (body?.text || '').toString().trim();
  if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  if (text.length > 20000) return NextResponse.json({ error: 'That text is too long. Please shorten it.' }, { status: 413 });

  try {
    const limit = parseInt(process.env.AI_MONTHLY_TOKEN_LIMIT_PER_USER || '', 10);
    if (limit > 0) {
      const s = await getUsageSummary(userId);
      if (s.totalTokens >= limit) {
        return NextResponse.json({ error: 'You have reached this month’s AI usage limit.' }, { status: 429 });
      }
    }
    const result = await callGemini({ system, prompt: buildPrompt(body, text), maxOutputTokens });
    try {
      await logAiUsage({ userId, feature, model: result.model, ...result.usage });
    } catch (e) {
      console.error('Failed to log AI usage:', e?.message); // don't fail the user's request
    }
    return NextResponse.json({ [field]: result.text, usage: result.usage });
  } catch (err) {
    if (err instanceof AiError) return NextResponse.json({ error: err.publicMessage }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: 'Something went wrong contacting the AI service.' }, { status: 500 });
  }
}
