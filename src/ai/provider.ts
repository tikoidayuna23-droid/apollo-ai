import { ModelProvider } from './types';
import { GeminiProvider } from './gemini';
import { logger } from '../utils/logger';

export class ProviderManager {
  private static activeProvider: ModelProvider = new GeminiProvider();
  private static registeredProviders: Map<string, ModelProvider> = new Map([
    ['gemini', new GeminiProvider()],
  ]);

  static getProvider(): ModelProvider {
    return this.activeProvider;
  }

  static setProvider(name: string): boolean {
    const provider = this.registeredProviders.get(name);
    if (provider) {
      this.activeProvider = provider;
      logger.info('ProviderManager', `Switched AI provider to ${provider.name}`);
      return true;
    }
    logger.warn('ProviderManager', `Provider "${name}" not found.`);
    return false;
  }

  static registerProvider(id: string, provider: ModelProvider): void {
    this.registeredProviders.set(id, provider);
  }

  static listProviders(): Array<{ id: string; name: string }> {
    return Array.from(this.registeredProviders.entries()).map(([id, p]) => ({
      id,
      name: p.name,
    }));
  }
}
