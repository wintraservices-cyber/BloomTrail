// Minimal Gemini REST client. Returns the text plus token usage so callers
// can record it. Never logs prompts or responses (they contain health notes).

// Two backends, same request/response shape:
//  - VERTEX_API_KEY set  -> Vertex AI (express mode, API-key auth)
//  - otherwise GEMINI_API_KEY -> Google AI Studio (Gemini Developer API)
const GEMINI_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_BASE = process.env.VERTEX_API_BASE || 'https://aiplatform.googleapis.com/v1/publishers/google';
const TIMEOUT_MS = 25000;

export function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export class AiError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export async function callGemini({ system, prompt, maxOutputTokens = 1024 }) {
  const vertexKey = process.env.VERTEX_API_KEY;
  const apiKey = vertexKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError(500, 'AI is not configured on the server (set VERTEX_API_KEY or GEMINI_API_KEY).');
  const base = vertexKey ? VERTEX_BASE : GEMINI_BASE;

  const model = getModelName();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature: 0.4 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new AiError(504, 'The AI service took too long to respond. Please try again.');
    console.error('Gemini request failed:', err?.message);
    throw new AiError(502, 'Could not reach the AI service. Please try again.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    console.error(`Gemini API error ${res.status}:`, detail);
    if (res.status === 429) throw new AiError(429, 'The AI service is busy or its quota is used up. Please try again later.');
    throw new AiError(502, 'The AI service returned an error. Please try again.');
  }

  const data = await res.json();
  if (data?.promptFeedback?.blockReason) {
    throw new AiError(422, "The AI couldn't respond to this text. Try rewording or shortening it.");
  }
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('').trim();
  if (!text) throw new AiError(502, 'The AI returned an empty answer. Please try again.');

  const meta = data.usageMetadata || {};
  const input = meta.promptTokenCount || 0;
  const output = (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0);
  const total = meta.totalTokenCount || input + output;
  return { text, model, usage: { input, output, total } };
}
