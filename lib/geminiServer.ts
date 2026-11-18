import { GoogleGenAI, Type } from '@google/genai';

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

export interface SuggestMealsPayload {
  memberName?: string;
  conditions?: string[];
  allergies?: string[];
  mealSlot?: string;
  language?: string;
}

export async function generateMealSuggestions(body: SuggestMealsPayload) {
  const { memberName, conditions, allergies, mealSlot, language } = body ?? {};
  const ai = getGeminiClient();

  const conditionList = Array.isArray(conditions) && conditions.length > 0 ? conditions.join(', ') : 'None';
  const allergyList = Array.isArray(allergies) && allergies.length > 0 ? allergies.join(', ') : 'None';
  const slot = typeof mealSlot === 'string' && mealSlot ? mealSlot : 'Lunch';
  const langLabel = language === 'ta' ? 'Tamil' : 'Tamil with short English meal names';

  const prompt = `Suggest 3 healthy, home-cooked Indian (especially South/North Indian family-friendly) ${slot} meal ideas for ${memberName || 'a family member'}.
Health conditions: ${conditionList}.
Allergies to avoid: ${allergyList}.
Return the response in ${langLabel}. Keep each reason warm, practical, and under 18 words.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are a warm, practical Indian family nutrition assistant. Always prioritize diabetes-safe, low-sodium (BP-safe), and heart-friendly home foods when those conditions exist. Never suggest foods matching the allergies.',
      responseMimeType: 'application/json',
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
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
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

  const ai = getGeminiClient();

  const prompt = `You are a friendly health assistant for an Indian family.
Analyze this health data for ${memberName || 'Family Member'} (Age: ${age ?? 'N/A'}, Gender: ${gender ?? 'N/A'}, Conditions: ${(conditions || []).join(', ') || 'None'}):
- Recent BP readings (last 30 days): ${JSON.stringify(bpReadings ?? [])}
- Recent Sugar readings (last 30 days): ${JSON.stringify(sugarReadings ?? [])}
- Recent Meal Plans: ${JSON.stringify(recentMeals ?? [])}
- Active Medicines: ${JSON.stringify(activeMedicines ?? [])}

Give 3 simple insights and 2 precautions in Tamil. Be warm, not scary. Keep each point under 2 sentences. Always end the analysis with 'மருத்துவரை அணுகவும்.'
Also provide a short Food Patterns summary analyzing the recent meals and suggesting practical Indian home-cooking improvements in ${language === 'ta' ? 'Tamil' : 'Tamil + clear English cues'}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are a caring Indian family health guide. Communicate clearly in simple Tamil. Never alarm the user. Always conclude analysis with மருத்துவரை அணுகவும்.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          insights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exactly 3 simple, warm insights in Tamil (each under 2 sentences).',
          },
          precautions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exactly 2 practical precautions in Tamil (each under 2 sentences).',
          },
          closingNote: {
            type: Type.STRING,
            description: "Must end with 'மருத்துவரை அணுகவும்.'",
          },
          foodPatterns: {
            type: Type.STRING,
            description: 'Concise analysis of meal patterns and 2 healthy Indian kitchen swaps.',
          },
        },
        required: ['insights', 'precautions', 'closingNote', 'foodPatterns'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  const insightsArr: string[] = Array.isArray(parsed.insights) ? parsed.insights : [];
  const precautionsArr: string[] = Array.isArray(parsed.precautions) ? parsed.precautions : [];
  const closing =
    typeof parsed.closingNote === 'string' && parsed.closingNote.includes('மருத்துவரை அணுகவும்')
      ? parsed.closingNote
      : `${parsed.closingNote ? parsed.closingNote + ' ' : ''}மருத்துவரை அணுகவும்.`;

  const formattedAnalysis = [
    'நுண்ணறிவுகள் (Insights):',
    ...insightsArr.map((item, idx) => `${idx + 1}. ${item}`),
    '',
    'முன்னெச்சரிக்கைகள் (Precautions):',
    ...precautionsArr.map((item, idx) => `${idx + 1}. ${item}`),
    '',
    closing,
  ].join('\n');

  return {
    analysis: formattedAnalysis,
    foodPatterns: parsed.foodPatterns || '',
  };
}
