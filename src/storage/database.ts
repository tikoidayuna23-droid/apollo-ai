import { logger } from '../utils/logger';

/**
 * Key-Value local storage abstraction layer for Apollo.
 * Safely handles quota, serialization, SSR/Node, and browser environments.
 */
class LocalDatabase {
  private prefix = 'apollo_db_';
  private memoryStore: Map<string, string> = new Map();

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  getItem<T>(key: string, defaultValue: T): T {
    try {
      const fullKey = this.prefix + key;
      const storage = this.getStorage();
      const raw = storage ? storage.getItem(fullKey) : this.memoryStore.get(fullKey) ?? null;
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error('Database', `Error reading key "${key}":`, err);
      return defaultValue;
    }
  }

  setItem<T>(key: string, value: T): boolean {
    try {
      const fullKey = this.prefix + key;
      const json = JSON.stringify(value);
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(fullKey, json);
      } else {
        this.memoryStore.set(fullKey, json);
      }
      return true;
    } catch (err) {
      logger.error('Database', `Error setting key "${key}":`, err);
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      const fullKey = this.prefix + key;
      const storage = this.getStorage();
      if (storage) {
        storage.removeItem(fullKey);
      } else {
        this.memoryStore.delete(fullKey);
      }
      return true;
    } catch (err) {
      logger.error('Database', `Error removing key "${key}":`, err);
      return false;
    }
  }

  clearAllApolloData(): boolean {
    try {
      const storage = this.getStorage();
      if (storage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(this.prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      }
      this.memoryStore.clear();
      logger.info('Database', 'Cleared all Apollo storage keys.');
      return true;
    } catch (err) {
      logger.error('Database', 'Error clearing Apollo data:', err);
      return false;
    }
  }
}

export const db = new LocalDatabase();

