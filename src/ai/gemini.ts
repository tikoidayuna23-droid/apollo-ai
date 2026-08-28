import { ModelProvider, ModelMessage, ModelGenerateOptions, ModelGenerateResponse } from './types';
import { logger } from '../utils/logger';

export class GeminiProvider implements ModelProvider {
  public name = 'Google Gemini (with auto-fallback)';

  async isAvailable(): Promise<{ available: boolean; error?: string }> {
    try {
      const res = await fetch('/api/gemini/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        return { available: false, error: `Server returned status ${res.status}` };
      }
      const data = await res.json();
      if (data.model) {
        this.name = data.model;
      }
      return {
        available: Boolean(data.available),
        error: data.error || (data.available ? undefined : 'Gemini is not configured.'),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network connection failed';
      return { available: false, error: msg };
    }
  }

  async generate(messages: ModelMessage[], options?: ModelGenerateOptions): Promise<ModelGenerateResponse> {
    try {
      logger.debug('GeminiProvider', 'Sending request to /api/gemini/generate', { messagesCount: messages.length });

      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          options,
        }),
      });

      if (!res.ok) {
        let errDetails = `HTTP error ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.error) {
            errDetails = errJson.error;
          }
        } catch {
          // ignore non-json response
        }
        throw new Error(errDetails);
      }

      const data: ModelGenerateResponse = await res.json();
      return data;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate response';
      logger.error('GeminiProvider', 'Generation error:', errorMsg);
      throw new Error(errorMsg);
    }
  }
}
