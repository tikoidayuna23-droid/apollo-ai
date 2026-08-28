import { MemoryStore } from './store';
import { MemoryItem } from './types';
import { logger } from '../utils/logger';

/**
 * High-level Memory interface for Apollo Agent.
 */
export class ApolloMemory {
  /**
   * Saves a persistent piece of information to long-term memory.
   */
  static saveMemory(content: string, options?: { key?: string; category?: MemoryItem['category']; tags?: string[] }): MemoryItem {
    logger.info('ApolloMemory', `Saving memory: ${content}`);
    return MemoryStore.save(content, options);
  }

  /**
   * Retrieves a memory item by exact or case-insensitive key.
   */
  static getMemory(key: string): MemoryItem | null {
    return MemoryStore.getByKey(key);
  }

  /**
   * Searches memories relevant to a query.
   */
  static searchMemory(query: string): MemoryItem[] {
    return MemoryStore.search(query);
  }

  /**
   * Retrieves all stored memories.
   */
  static getAllMemories(): MemoryItem[] {
    return MemoryStore.getAll();
  }

  /**
   * Deletes a memory by ID.
   */
  static deleteMemory(id: string): boolean {
    return MemoryStore.delete(id);
  }

  /**
   * Clears all long-term memory.
   */
  static clearMemory(): void {
    MemoryStore.clear();
  }

  /**
   * Formats long-term memories for injection into Apollo system prompt or context.
   */
  static getContextSnippet(): string {
    const memories = MemoryStore.getAll();
    if (memories.length === 0) return 'No prior memories stored.';
    return memories
      .map((m, idx) => `${idx + 1}. ${m.key ? `[${m.key}] ` : ''}${m.content}`)
      .join('\n');
  }
}
