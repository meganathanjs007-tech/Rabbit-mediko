import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateHealthInsights, generateMealSuggestions } from './lib/geminiServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Rabbit Mediko' });
  });

  app.post('/api/gemini/suggest-meals', async (req, res) => {
    try {
      const result = await generateMealSuggestions(req.body ?? {});
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate meal suggestions';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/health-insights', async (req, res) => {
    try {
      const result = await generateHealthInsights(req.body ?? {});
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate health insights';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rabbit Mediko server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
