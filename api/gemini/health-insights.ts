import { generateHealthInsights, type HealthInsightsPayload } from '../../lib/geminiServer.ts';

interface ApiRequest {
  method?: string;
  body?: HealthInsightsPayload;
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
    const result = await generateHealthInsights(req.body ?? {});
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate health insights';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
