import { runAiFeature } from '@/lib/ai';

export async function POST(request) {
  return runAiFeature(request, {
    feature: 'explain',
    field: 'explanation',
    maxOutputTokens: 1024,
    system:
      'You are explaining a medical document to a patient in plain, warm, non-alarming language. Explain what the result or document generally means, in 3-5 short sentences. Do not give medical advice, do not tell the person what to do, do not diagnose. If terms are unclear, define them simply.',
    buildPrompt: (body, text) => `Document type: ${(body?.docType || 'Result').toString().slice(0, 100)}.\n\nContent:\n\n${text}`,
  });
}
