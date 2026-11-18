import { generateMealSuggestions, type SuggestMealsPayload } from '../../lib/geminiServer.ts';

interface ApiRequest {
  method?: string;
  body?: SuggestMealsPayload;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(payload: unknown): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await generateMealSuggestions(req.body ?? {});
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate meal suggestions';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
