import axios from 'axios';
import type { Language, MealSlot } from '../types/health';

export interface SuggestedMeal {
  name: string;
  tamilTitle: string;
  reason: string;
}

export async function fetchMealSuggestions(params: {
  memberName: string;
  conditions: string[];
  allergies: string[];
  mealSlot: MealSlot;
  language: Language;
}): Promise<SuggestedMeal[]> {
  try {
    const res = await axios.post<{ suggestions: SuggestedMeal[] }>('/api/gemini/suggest-meals', params);
    return res.data.suggestions ?? [];
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as { error?: string } | undefined)?.error || err.message;
      throw new Error(msg);
    }
    throw err;
  }
}

export async function fetchHealthInsights(params: {
  memberName: string;
  age: number;
  gender: string;
  conditions: string[];
  bpReadings: Array<{ date: string; value: string }>;
  sugarReadings: Array<{ date: string; value: string }>;
  recentMeals: Array<{ date: string; breakfast: string[]; lunch: string[]; dinner: string[]; snacks: string[] }>;
  activeMedicines: Array<{ name: string; dosage: string; frequency: string }>;
  language: Language;
}): Promise<{ analysis: string; foodPatterns: string }> {
  try {
    const res = await axios.post<{ analysis: string; foodPatterns: string }>(
      '/api/gemini/health-insights',
      params
    );
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as { error?: string } | undefined)?.error || err.message;
      throw new Error(msg);
    }
    throw err;
  }
}
