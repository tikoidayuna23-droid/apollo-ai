import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Status check endpoint
  app.get('/api/gemini/status', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    res.json({
      available: hasKey,
      model: 'gemini-3.7-flash (with auto-fallback)',
      error: hasKey ? undefined : 'Gemini is not configured.',
    });
  });

  // Candidate models to try in sequence if a model hits rate limit or quota
  const CANDIDATE_MODELS = [
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];

  // In-memory cooldown tracker: model name -> timestamp until which it is in cooldown
  const modelCooldowns = new Map<string, number>();

  // Helper to extract clean error message
  function formatGeminiError(err: any): string {
    if (!err) return 'Gemini model request failed.';
    const rawMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));

    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota') || rawMsg.includes('Quota')) {
      const match = rawMsg.match(/retry in\s+([\d.]+s?)/i) || rawMsg.match(/retryDelay":"([^"]+)"/i);
      const retryTime = match ? ` Please retry in ${match[1]}.` : ' Please wait a few seconds before trying again.';
      return `Gemini rate limit / quota temporarily reached.${retryTime}`;
    }

    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // not JSON
    }

    return rawMsg.length > 200 ? `${rawMsg.slice(0, 200)}...` : rawMsg;
  }

  // Server-side Gemini proxy endpoint
  app.post('/api/gemini/generate', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error: 'Gemini is not configured. Please provide a GEMINI_API_KEY in the environment or secrets panel.',
      });
    }

    try {
      const { messages, options } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages array provided.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Prepare Gemini contents
      const contents: any[] = [];

      for (const msg of messages) {
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content || '' }],
          });
        } else if (msg.role === 'assistant') {
          if (msg.rawParts && Array.isArray(msg.rawParts) && msg.rawParts.length > 0) {
            contents.push({
              role: 'model',
              parts: msg.rawParts,
            });
          } else {
            const parts: any[] = [];
            if (msg.content) {
              parts.push({ text: msg.content });
            }
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              for (const tc of msg.toolCalls) {
                parts.push({
                  functionCall: {
                    name: tc.name,
                    args: tc.args || {},
                  },
                });
              }
            }
            if (parts.length > 0) {
              contents.push({
                role: 'model',
                parts,
              });
            }
          }
        } else if (msg.role === 'tool') {
          // Tool response from client/local tools
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: msg.toolResult?.name || 'tool_response',
                  response: {
                    output: msg.toolResult?.result !== undefined ? msg.toolResult.result : msg.content,
                  },
                },
              },
            ],
          });
        }
      }

      // Configure tools if passed
      const config: any = {};
      if (options?.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options?.temperature !== undefined) {
        config.temperature = options.temperature;
      }

      if (options?.tools && options.tools.length > 0) {
        config.tools = [
          {
            functionDeclarations: options.tools.map((t: any) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];
      }

      // Model cascade loop with cooldown sorting
      let lastError: any = null;
      let response: any = null;
      let usedModel = '';

      const now = Date.now();
      // Sort candidates so models not in cooldown are tried first
      const orderedCandidates = [...CANDIDATE_MODELS].sort((a, b) => {
        const cdA = modelCooldowns.get(a) || 0;
        const cdB = modelCooldowns.get(b) || 0;
        const readyA = cdA <= now ? 0 : cdA;
        const readyB = cdB <= now ? 0 : cdB;
        return readyA - readyB;
      });

      for (const modelCandidate of orderedCandidates) {
        try {
          response = await ai.models.generateContent({
            model: modelCandidate,
            contents,
            config,
          });
          usedModel = modelCandidate;
          modelCooldowns.delete(modelCandidate); // Mark as healthy
          break;
        } catch (modelErr: any) {
          lastError = modelErr;
          const errStr = String(modelErr?.message || modelErr);

          // If rate limit or quota reached on this model candidate
          if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota') || errStr.includes('Quota')) {
            const match = errStr.match(/retry in\s+([\d.]+)s/i) || errStr.match(/retryDelay":"([\d]+)s"/i);
            const retrySec = match ? Math.ceil(parseFloat(match[1])) : 30;
            // Mark model in cooldown so subsequent requests don't waste time on it
            modelCooldowns.set(modelCandidate, Date.now() + Math.max(retrySec * 1000, 15000));
            // Immediately fail over to the next candidate model
            continue;
          }

          // For other errors, also try next candidate
          continue;
        }
      }

      if (!response) {
        const formattedErr = formatGeminiError(lastError);
        console.error('[Gemini API All Candidates Exhausted]:', formattedErr);
        return res.status(500).json({ error: formattedErr });
      }

      const text = response.text || '';
      const functionCalls = response.functionCalls || [];
      const rawParts = response.candidates?.[0]?.content?.parts || [];

      const toolCalls = functionCalls.map((fc: any, index: number) => ({
        id: `call_${Date.now()}_${index}`,
        name: fc.name,
        args: fc.args || {},
      }));

      res.json({
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        rawParts: rawParts.length > 0 ? rawParts : undefined,
        usedModel,
      });
    } catch (err: any) {
      console.error('[Gemini API Proxy Error]:', err);
      const message = formatGeminiError(err);
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apollo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Apollo server:', err);
  process.exit(1);
});
