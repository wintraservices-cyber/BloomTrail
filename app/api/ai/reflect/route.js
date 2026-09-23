import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const text = (body?.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              "A patient wrote the following note about how an appointment went. In 2-3 warm, validating sentences, reflect back the overall mood/sentiment you notice (e.g. relieved, anxious, hopeful, frustrated, mixed) and briefly note what seemed to matter most to them. Do not give advice, do not diagnose, do not suggest actions. Just reflect what's there.\n\nNote: " +
              text,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Anthropic API error:', errText);
      return NextResponse.json({ error: 'The AI service returned an error.' }, { status: 502 });
    }

    const data = await resp.json();
    const reflection = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return NextResponse.json({ reflection: reflection || 'Could not generate a reflection.' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Something went wrong contacting the AI service.' }, { status: 500 });
  }
}
