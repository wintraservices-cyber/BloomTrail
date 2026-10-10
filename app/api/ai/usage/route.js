import { NextResponse } from 'next/server';
import { getUsageSummary } from '@/lib/db';

export async function GET(request) {
  const userId = request.headers.get('x-bloom-user-id');
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const summary = await getUsageSummary(userId);
    const limit = parseInt(process.env.AI_MONTHLY_TOKEN_LIMIT_PER_USER || '', 10) || null;
    return NextResponse.json({ ...summary, limit });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
