import { runAiFeature } from '@/lib/ai';

export async function POST(request) {
  return runAiFeature(request, {
    feature: 'summary',
    field: 'summary',
    maxOutputTokens: 1024,
    system:
      'You are helping a patient review their own health tracking for a week or month. Using only the counts and names provided, write a short, warm, plain-language recap in 3-5 sentences: how consistently they completed their reminders or medicines, which symptoms came up most and how severe they were, and how many check-ups they attended. Do not give medical advice, do not diagnose, do not suggest treatments or tell the person what to do, and do not invent anything that is not in the data. If there is little data, say so kindly.',
    buildPrompt: (_body, text) => text,
  });
}
