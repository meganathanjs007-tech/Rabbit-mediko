import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ override: true });
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractGeminiErrorMessage,
  generateGroundedHealthSearch,
  generateHealthInsights,
  generateMealSuggestions,
} from './lib/geminiServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'bluetooth=(self)');
    next();
  });

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Rabbit Mediko' });
  });

  app.post('/api/gemini/suggest-meals', async (req, res) => {
    try {
      const result = await generateMealSuggestions(req.body ?? {});
      res.json(result);
    } catch (err: unknown) {
      const message = extractGeminiErrorMessage(err, 'Failed to generate meal suggestions');
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/health-insights', async (req, res) => {
    try {
      const result = await generateHealthInsights(req.body ?? {});
      res.json(result);
    } catch (err: unknown) {
      const message = extractGeminiErrorMessage(err, 'Failed to generate health insights');
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/health-search', async (req, res) => {
    try {
      const result = await generateGroundedHealthSearch(req.body ?? {});
      res.json(result);
    } catch (err: unknown) {
      const message = extractGeminiErrorMessage(err, 'Failed to search grounded health information');
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Rabbit Mediko server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
