import { NextResponse } from 'next/server';
import { vapidPublicKey } from '@/lib/push';

export async function GET(request) {
  if (!request.headers.get('x-bloom-user-id')) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const publicKey = vapidPublicKey();
  if (!publicKey) return NextResponse.json({ error: 'Notifications are not set up on the server yet.' }, { status: 503 });
  return NextResponse.json({ publicKey });
}
