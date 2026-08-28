import { logger } from '../utils/logger';

/**
 * Key-Value local storage abstraction layer for Apollo Phase 1.
 * Safely handles quota, serialization, and browser environments.
 */
class LocalDatabase {
  private prefix = 'apollo_db_';

  getItem<T>(key: string, defaultValue: T): T {
    try {
      const fullKey = this.prefix + key;
      const raw = localStorage.getItem(fullKey);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error('Database', `Error reading key "${key}":`, err);
      return defaultValue;
    }
  }

  setItem<T>(key: string, value: T): boolean {
    try {
      const fullKey = this.prefix + key;
      localStorage.setItem(fullKey, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Database', `Error setting key "${key}":`, err);
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      const fullKey = this.prefix + key;
      localStorage.removeItem(fullKey);
      return true;
    } catch (err) {
      logger.error('Database', `Error removing key "${key}":`, err);
      return false;
    }
  }

  clearAllApolloData(): boolean {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      logger.info('Database', 'Cleared all Apollo storage keys.');
      return true;
    } catch (err) {
      logger.error('Database', 'Error clearing Apollo data:', err);
      return false;
    }
  }
}

export const db = new LocalDatabase();
