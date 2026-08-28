import { db } from '../storage/database';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';
import { MemoryItem } from './types';

const MEMORY_STORE_KEY = 'apollo_memories';

export class MemoryStore {
  static getAll(): MemoryItem[] {
    return db.getItem<MemoryItem[]>(MEMORY_STORE_KEY, []);
  }

  static save(content: string, options?: { key?: string; category?: MemoryItem['category']; tags?: string[] }): MemoryItem {
    const memories = this.getAll();
    const now = Date.now();

    // Check if key already exists to update
    if (options?.key) {
      const existingIdx = memories.findIndex((m) => m.key && m.key.toLowerCase() === options.key!.toLowerCase());
      if (existingIdx >= 0) {
        memories[existingIdx] = {
          ...memories[existingIdx],
          content,
          category: options.category || memories[existingIdx].category || 'general',
          tags: options.tags || memories[existingIdx].tags,
          updatedAt: now,
        };
        db.setItem(MEMORY_STORE_KEY, memories);
        logger.info('MemoryStore', `Updated memory with key: ${options.key}`);
        return memories[existingIdx];
      }
    }

    const newItem: MemoryItem = {
      id: generateId(),
      key: options?.key,
      content,
      category: options?.category || 'general',
      tags: options?.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    memories.unshift(newItem);
    db.setItem(MEMORY_STORE_KEY, memories);
    logger.info('MemoryStore', `Saved new memory: ${newItem.content.slice(0, 40)}...`);
    return newItem;
  }

  static delete(id: string): boolean {
    const memories = this.getAll();
    const filtered = memories.filter((m) => m.id !== id);
    if (filtered.length !== memories.length) {
      db.setItem(MEMORY_STORE_KEY, filtered);
      logger.info('MemoryStore', `Deleted memory ${id}`);
      return true;
    }
    return false;
  }

  static clear(): void {
    db.removeItem(MEMORY_STORE_KEY);
    logger.info('MemoryStore', 'Cleared all memories');
  }

  static search(query: string): MemoryItem[] {
    const memories = this.getAll();
    if (!query || !query.trim()) return memories;

    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/).filter(Boolean);

    return memories.filter((item) => {
      const content = item.content.toLowerCase();
      const key = (item.key || '').toLowerCase();
      const tags = (item.tags || []).map((t) => t.toLowerCase()).join(' ');
      const combined = `${key} ${content} ${tags}`;

      return queryTokens.some((token) => combined.includes(token));
    });
  }

  static getByKey(key: string): MemoryItem | null {
    const memories = this.getAll();
    return memories.find((m) => m.key && m.key.toLowerCase() === key.toLowerCase()) || null;
  }
}
