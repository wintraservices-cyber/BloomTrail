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
  const docType = (body?.docType || 'Result').trim();
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
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content:
              'You are explaining a medical document to a patient in plain, warm, non-alarming language. Explain what the following result or document generally means, in 3-5 short sentences. Do not give medical advice, do not tell the person what to do, do not diagnose. If terms are unclear, define them simply. Document type: ' +
              docType +
              '. Content:\n\n' +
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
    const explanation = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return NextResponse.json({ explanation: explanation || 'Could not generate an explanation.' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Something went wrong contacting the AI service.' }, { status: 500 });
  }
}
