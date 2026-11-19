import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function extractGeminiErrorMessage(err: unknown, fallback = 'AI service temporarily unavailable'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Raw message is already plain text
  }
  return raw;
}

function stripJsonFences(rawText: string): string {
  return rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout') ||
    msg.includes('deadline') ||
    msg.includes('network')
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateJsonWithResilience(params: {
  contents: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
}): Promise<string> {
  const ai = getGeminiClient();
  const attempts: Array<{ model: string; useLowThinking: boolean; timeoutMs: number }> = [
    { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 14000 },
    { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
    { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 16000 },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      const response = await callWithTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
            ...(attempt.useLowThinking
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        attempt.timeoutMs,
        attempt.model
      );
      const text = stripJsonFences(response.text ?? '');
      if (text) return text;
      throw new Error(`Empty response from ${attempt.model}`);
    } catch (err) {
      lastError = err;
      if (i < attempts.length - 1 && isTransientError(err)) {
        await sleep(500 * (i + 1));
        continue;
      }
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }

  throw new Error(extractGeminiErrorMessage(lastError, 'AI service is temporarily busy. Please try again in a moment.'));
}

export interface SuggestMealsPayload {
  memberName?: string;
  conditions?: string[];
  allergies?: string[];
  mealSlot?: string;
  language?: string;
}

export async function generateMealSuggestions(body: SuggestMealsPayload) {
  const { memberName, conditions, allergies, mealSlot, language } = body ?? {};

  const conditionList = Array.isArray(conditions) && conditions.length > 0 ? conditions.join(', ') : 'None';
  const allergyList = Array.isArray(allergies) && allergies.length > 0 ? allergies.join(', ') : 'None';
  const slot = typeof mealSlot === 'string' && mealSlot ? mealSlot : 'Lunch';
  const langLabel = language === 'ta' ? 'Tamil' : 'Tamil with short English meal names';

  const prompt = `Suggest 3 healthy, home-cooked Indian (especially South/North Indian family-friendly) ${slot} meal ideas for ${memberName || 'a family member'}.
Health conditions: ${conditionList}.
Allergies to avoid: ${allergyList}.
Return the response in ${langLabel}. Keep each reason warm, practical, and under 18 words.`;

  const text = await generateJsonWithResilience({
    contents: prompt,
    systemInstruction:
      'You are a warm, practical Indian family nutrition assistant. Always prioritize diabetes-safe, low-sodium (BP-safe), and heart-friendly home foods when those conditions exist. Never suggest foods matching the allergies.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Short food item name in English for meal slot chip' },
              tamilTitle: { type: Type.STRING, description: 'Meal name in Tamil script' },
              reason: { type: Type.STRING, description: 'Brief 1-sentence reason in Tamil explaining why it is healthy' },
            },
            required: ['name', 'tamilTitle', 'reason'],
          },
        },
      },
      required: ['suggestions'],
    },
  });

  const parsed = JSON.parse(text || '{}') as { suggestions?: unknown[] };
  return { suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [] };
}

export interface HealthInsightsPayload {
  memberName?: string;
  age?: number | string;
  gender?: string;
  conditions?: string[];
  bpReadings?: unknown[];
  sugarReadings?: unknown[];
  recentMeals?: unknown[];
  activeMedicines?: unknown[];
  language?: string;
}

export async function generateHealthInsights(body: HealthInsightsPayload) {
  const {
    memberName,
    age,
    gender,
    conditions,
    bpReadings,
    sugarReadings,
    recentMeals,
    activeMedicines,
    language,
  } = body ?? {};

  const isTamil = language === 'ta';
  const targetLang = isTamil ? 'simple, warm Tamil' : 'simple, warm English';

  const prompt = `You are a friendly health assistant for an Indian family.
Analyze this health data for ${memberName || 'Family Member'} (Age: ${age ?? 'N/A'}, Gender: ${gender ?? 'N/A'}, Conditions: ${(conditions || []).join(', ') || 'None'}):
- Recent BP readings (last 30 days): ${JSON.stringify(bpReadings ?? [])}
- Recent Sugar readings (last 30 days): ${JSON.stringify(sugarReadings ?? [])}
- Recent Meal Plans: ${JSON.stringify(recentMeals ?? [])}
- Active Medicines: ${JSON.stringify(activeMedicines ?? [])}

Give 3 simple, encouraging health insights and 2 practical precautions in ${targetLang}. Keep each point under 2 sentences. Do not alarm the user.
${isTamil ? "Always set closingNote to end with 'மருத்துவரை அணுகவும்.'" : "Always set closingNote to 'Please consult your doctor for medical decisions.'"}
Also provide a concise Food Patterns summary analyzing the recent meals (or suggesting Indian home-cooking tips for their conditions if no meals are logged) in ${targetLang}.`;

  const text = await generateJsonWithResilience({
    contents: prompt,
    systemInstruction: isTamil
      ? 'You are a caring Indian family health guide. Communicate clearly in simple Tamil. Never alarm the user. Always conclude analysis with மருத்துவரை அணுகவும்.'
      : 'You are a caring Indian family health guide. Communicate clearly in simple, warm English tailored to Indian home cooking and daily habits. Never alarm the user.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        insights: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: `Exactly 3 simple, warm insights in ${targetLang} (each under 2 sentences).`,
        },
        precautions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: `Exactly 2 practical precautions in ${targetLang} (each under 2 sentences).`,
        },
        closingNote: {
          type: Type.STRING,
          description: isTamil
            ? "Must end with 'மருத்துவரை அணுகவும்.'"
            : "Friendly reminder to consult a doctor.",
        },
        foodPatterns: {
          type: Type.STRING,
          description: `Concise analysis of meal patterns and 2 healthy Indian kitchen swaps in ${targetLang}.`,
        },
      },
      required: ['insights', 'precautions', 'closingNote', 'foodPatterns'],
    },
  });

  const parsed = JSON.parse(text || '{}') as {
    insights?: string[];
    precautions?: string[];
    closingNote?: string;
    foodPatterns?: string;
  };
  const insightsArr = Array.isArray(parsed.insights) ? parsed.insights.filter(Boolean) : [];
  const precautionsArr = Array.isArray(parsed.precautions) ? parsed.precautions.filter(Boolean) : [];

  const closing = isTamil
    ? typeof parsed.closingNote === 'string' && parsed.closingNote.includes('மருத்துவரை அணுகவும்')
      ? parsed.closingNote
      : `${parsed.closingNote ? parsed.closingNote + ' ' : ''}மருத்துவரை அணுகவும்.`
    : parsed.closingNote || 'Please consult your doctor for medical decisions.';

  const formattedAnalysis = [
    isTamil ? 'நுண்ணறிவுகள்:' : 'Key Health Insights:',
    ...insightsArr.map((item, idx) => `${idx + 1}. ${item}`),
    '',
    isTamil ? 'முன்னெச்சரிக்கைகள்:' : 'Practical Precautions:',
    ...precautionsArr.map((item, idx) => `${idx + 1}. ${item}`),
    '',
    closing,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  return {
    analysis: formattedAnalysis.trim() || (isTamil ? 'மருத்துவரை அணுகவும்.' : 'Please consult your doctor.'),
    foodPatterns: (parsed.foodPatterns || '').trim(),
  };
}
