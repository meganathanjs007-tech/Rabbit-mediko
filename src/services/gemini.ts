import axios from 'axios';
import type { Language, MealSlot } from '../types/health';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export interface SuggestedMeal {
  name: string;
  tamilTitle: string;
  reason: string;
}

export interface GroundedSource {
  title: string;
  uri: string;
}

export async function fetchMealSuggestions(params: {
  memberName: string;
  conditions: string[];
  allergies: string[];
  mealSlot: MealSlot;
  language: Language;
}): Promise<SuggestedMeal[]> {
  try {
    const res = await axios.post<{ suggestions: SuggestedMeal[] }>(
      apiUrl('/api/gemini/suggest-meals'),
      params,
      { timeout: 35000 }
    );
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
  allergies?: string[];
  bpReadings: Array<{ date: string; value: string }>;
  sugarReadings: Array<{ date: string; value: string }>;
  watchVitals?: Array<{ date: string; type: string; value: string }>;
  doctorVisits?: Array<{ date: string; doctorName?: string; notes?: string }>;
  recentMeals: Array<{ date: string; breakfast: string[]; lunch: string[]; dinner: string[]; snacks: string[] }>;
  activeMedicines: Array<{ name: string; dosage: string; frequency: string }>;
  language: Language;
}): Promise<{ analysis: string; foodPatterns: string }> {
  try {
    const res = await axios.post<{ analysis: string; foodPatterns: string }>(
      apiUrl('/api/gemini/health-insights'),
      params,
      { timeout: 35000 }
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

export async function searchGroundedHealthInfo(params: {
  query: string;
  memberName?: string;
  age?: number;
  conditions?: string[];
  allergies?: string[];
  latestVitals?: string;
  language: Language;
}): Promise<{ answer: string; sources: GroundedSource[] }> {
  try {
    const res = await axios.post<{ answer: string; sources: GroundedSource[] }>(
      apiUrl('/api/gemini/health-search'),
      params,
      { timeout: 35000 }
    );
    return {
      answer: res.data.answer ?? '',
      sources: Array.isArray(res.data.sources) ? res.data.sources : [],
    };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as { error?: string } | undefined)?.error || err.message;
      throw new Error(msg);
    }
    throw err;
  }
}
