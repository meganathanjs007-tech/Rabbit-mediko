import {
  extractGeminiErrorMessage,
  generateHealthInsights,
  type HealthInsightsPayload,
} from '../../lib/geminiServer.ts';

interface ApiRequest {
  method?: string;
  body?: HealthInsightsPayload;
}

interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
  end(): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await generateHealthInsights(req.body ?? {});
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = extractGeminiErrorMessage(err, 'Failed to generate health insights');
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: message });
  }
}
