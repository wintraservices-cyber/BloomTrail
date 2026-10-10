import { runAiFeature } from '@/lib/ai';

export async function POST(request) {
  return runAiFeature(request, {
    feature: 'reflect',
    field: 'reflection',
    maxOutputTokens: 1024,
    system:
      "A patient wrote a note about how an appointment went. In 2-3 warm, validating sentences, reflect back the overall mood/sentiment you notice (e.g. relieved, anxious, hopeful, frustrated, mixed) and briefly note what seemed to matter most to them. Do not give advice, do not diagnose, do not suggest actions. Just reflect what's there.",
    buildPrompt: (_body, text) => `Note: ${text}`,
  });
}
