import { db } from '../storage/database';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';
import { MemoryItem, MemoryCategory, MemorySource } from './types';
import { ProjectMemoryManager } from './projects';

const MEMORY_STORE_KEY = 'apollo_memories';

// Security patterns for sensitive credentials (API keys, passwords, bearer tokens)
const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/i,                           // Google API key
  /sk-[a-zA-Z0-9]{20,}/i,                             // OpenAI / Anthropic key
  /bearer\s+[a-zA-Z0-9-._~+/]+=*/i,                   // Bearer token
  /(?:api[_-]?key|password|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9-_!@#$%^&*()]{8,}['"]?/i,
  /ghp_[a-zA-Z0-9]{36}/i,                             // GitHub personal token
];

/**
 * Calculates Jaccard word-token similarity between two text strings for duplicate detection.
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const tokensA = new Set(normalize(textA));
  const tokensB = new Set(normalize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersectionCount++;
  });

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export class MemoryStore {
  /**
   * Scans content to prevent storing sensitive authentication secrets or API keys.
   */
  static containsSensitiveSecret(text: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
  }

  static getAll(): MemoryItem[] {
    const raw = db.getItem<MemoryItem[]>(MEMORY_STORE_KEY, []);
    return raw.map((item) => ({
      ...item,
      category: item.category ? (item.category.toUpperCase() as MemoryCategory) : 'FACT',
      importance: typeof item.importance === 'number' ? Math.min(5, Math.max(1, item.importance)) : 3,
      tags: Array.isArray(item.tags) ? item.tags : [],
      source: item.source || 'user',
    })).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static get(id: string): MemoryItem | null {
    const memories = this.getAll();
    return memories.find((m) => m.id === id) || null;
  }

  static getByKey(key: string): MemoryItem | null {
    const memories = this.getAll();
    const lower = key.toLowerCase().trim();
    return memories.find((m) => m.key && m.key.toLowerCase().trim() === lower) || null;
  }

  static getByCategory(category: MemoryCategory): MemoryItem[] {
    const memories = this.getAll();
    return memories.filter((m) => m.category === category);
  }

  /**
   * Saves a new memory item or updates an existing duplicate.
   */
  static save(
    content: string,
    options?: {
      key?: string;
      category?: MemoryCategory;
      importance?: number;
      source?: MemorySource;
      tags?: string[];
      projectId?: string;
      skipDuplicateCheck?: boolean;
    }
  ): { memory: MemoryItem; isUpdated: boolean; securityWarning?: string } {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('Memory content cannot be empty.');
    }

    // Security Check: Guard against storing API keys or secrets
    if (this.containsSensitiveSecret(trimmedContent)) {
      logger.warn('MemoryStore', 'Attempted to save sensitive credentials to memory. Blocked for security.');
      const sanitized = trimmedContent.replace(/([a-zA-Z0-9-_]{8,})/g, '[REDACTED]');
      return {
        memory: {
          id: generateId(),
          content: sanitized,
          category: 'INSTRUCTION',
          importance: 1,
          source: 'system',
          tags: ['security-alert'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        isUpdated: false,
        securityWarning: 'Security Alert: Sensitive API keys or authentication credentials cannot be stored in long-term memory.',
      };
    }

    const memories = this.getAll();
    const now = Date.now();
    const category = options?.category ? (options.category.toUpperCase() as MemoryCategory) : 'FACT';
    const importance = options?.importance
      ? Math.min(5, Math.max(1, options.importance))
      : category === 'INSTRUCTION'
      ? 5
      : category === 'PROJECT' || category === 'PREFERENCE'
      ? 4
      : 3;
    const source = options?.source || 'user';
    const tags = options?.tags || [];
    const projectId = options?.projectId;

    // 1. Explicit key match check
    if (options?.key) {
      const existingKeyIdx = memories.findIndex(
        (m) => m.key && m.key.toLowerCase().trim() === options.key!.toLowerCase().trim()
      );
      if (existingKeyIdx >= 0) {
        const existing = memories[existingKeyIdx];
        const updated: MemoryItem = {
          ...existing,
          content: trimmedContent,
          category,
          importance: options?.importance !== undefined ? importance : existing.importance,
          tags: Array.from(new Set([...existing.tags, ...tags])),
          projectId: projectId || existing.projectId,
          updatedAt: now,
        };
        memories[existingKeyIdx] = updated;
        db.setItem(MEMORY_STORE_KEY, memories);
        logger.info('MemoryStore', `Updated memory by key: "${options.key}"`);
        return { memory: updated, isUpdated: true };
      }
    }

    // 2. Duplicate Detection: Check similarity with existing memories in same/related category
    if (!options?.skipDuplicateCheck) {
      for (let i = 0; i < memories.length; i++) {
        const existing = memories[i];
        const similarity = calculateTextSimilarity(existing.content, trimmedContent);

        // High similarity (> 0.65) or substring containment
        if (similarity > 0.65 || (existing.content.length > 10 && existing.content.toLowerCase().includes(trimmedContent.toLowerCase()))) {
          const updated: MemoryItem = {
            ...existing,
            content: trimmedContent.length >= existing.content.length ? trimmedContent : existing.content,
            category: options?.category ? category : existing.category,
            importance: Math.max(existing.importance, importance),
            tags: Array.from(new Set([...existing.tags, ...tags])),
            projectId: projectId || existing.projectId,
            updatedAt: now,
          };
          memories[i] = updated;
          db.setItem(MEMORY_STORE_KEY, memories);
          logger.info('MemoryStore', `Merged/updated duplicate memory (similarity: ${(similarity * 100).toFixed(0)}%)`);
          return { memory: updated, isUpdated: true };
        }
      }
    }

    // 3. Create new memory item
    const newMemory: MemoryItem = {
      id: generateId(),
      key: options?.key?.trim() || undefined,
      content: trimmedContent,
      category,
      importance,
      source,
      tags: tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      projectId,
      createdAt: now,
      updatedAt: now,
    };

    // Auto-link with project if category is PROJECT
    if (category === 'PROJECT') {
      const match = trimmedContent.match(/project (?:is|called|named)?\s*([A-Za-z0-9_-]+)/i);
      const projName = match ? match[1] : (newMemory.key || 'Apollo');
      ProjectMemoryManager.saveProject({
        name: projName,
        description: trimmedContent,
        memories: [newMemory.id],
      });
    }

    memories.unshift(newMemory);
    db.setItem(MEMORY_STORE_KEY, memories);
    logger.info('MemoryStore', `Saved new memory [${category}]: ${trimmedContent.slice(0, 40)}...`);
    return { memory: newMemory, isUpdated: false };
  }

  static update(id: string, partial: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): MemoryItem | null {
    const memories = this.getAll();
    const index = memories.findIndex((m) => m.id === id);
    if (index === -1) return null;

    if (partial.content && this.containsSensitiveSecret(partial.content)) {
      throw new Error('Cannot store sensitive API keys or credentials in memory.');
    }

    const updated: MemoryItem = {
      ...memories[index],
      ...partial,
      category: partial.category ? (partial.category.toUpperCase() as MemoryCategory) : memories[index].category,
      importance: partial.importance !== undefined ? Math.min(5, Math.max(1, partial.importance)) : memories[index].importance,
      updatedAt: Date.now(),
    };

    memories[index] = updated;
    db.setItem(MEMORY_STORE_KEY, memories);
    logger.info('MemoryStore', `Updated memory ${id}`);
    return updated;
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

  static search(query: string, categoryFilter?: MemoryCategory | 'ALL'): MemoryItem[] {
    const memories = this.getAll();
    let pool = memories;

    if (categoryFilter && categoryFilter !== 'ALL') {
      pool = pool.filter((m) => m.category === categoryFilter);
    }

    if (!query || !query.trim()) return pool;

    const lowerQuery = query.toLowerCase().trim();
    const tokens = lowerQuery.split(/\s+/).filter((t) => t.length > 1);

    return pool.filter((item) => {
      const content = item.content.toLowerCase();
      const key = (item.key || '').toLowerCase();
      const tags = item.tags.map((t) => t.toLowerCase()).join(' ');
      const category = item.category.toLowerCase();
      const combined = `${key} ${content} ${tags} ${category}`;

      // Check full substring first
      if (combined.includes(lowerQuery)) return true;

      // Check token match
      return tokens.some((token) => combined.includes(token));
    });
  }

  static exportJSON(): string {
    const memories = this.getAll();
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: memories.length,
      memories,
    };
    return JSON.stringify(exportData, null, 2);
  }

  static importJSON(jsonString: string): { importedCount: number; updatedCount: number; errors: string[] } {
    const errors: string[] = [];
    let importedCount = 0;
    let updatedCount = 0;

    try {
      const parsed = JSON.parse(jsonString);
      const items: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.memories) ? parsed.memories : [];

      if (items.length === 0) {
        errors.push('No memory items found in the imported JSON.');
        return { importedCount, updatedCount, errors };
      }

      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const content = typeof item.content === 'string' ? item.content : '';

        if (!content.trim()) continue;

        try {
          const category = (typeof item.category === 'string' ? item.category.toUpperCase() : 'FACT') as MemoryCategory;
          const importance = typeof item.importance === 'number' ? item.importance : 3;
          const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
          const key = typeof item.key === 'string' ? item.key : undefined;

          const result = this.save(content, {
            category,
            importance,
            tags,
            key,
            source: 'import',
            skipDuplicateCheck: false,
          });

          if (result.isUpdated) {
            updatedCount++;
          } else {
            importedCount++;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Item failed to import';
          errors.push(msg);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON file';
      errors.push(msg);
    }

    return { importedCount, updatedCount, errors };
  }
}
