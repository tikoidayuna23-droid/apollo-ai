import { MemoryStore } from './store';
import { MemoryRetrieval } from './retrieval';
import { MemoryItem, MemoryCategory, MemorySource, MemorySearchResult } from './types';
import { UserManager } from './user';
import { ProjectMemoryManager } from './projects';
import { logger } from '../utils/logger';

/**
 * Apollo Memory Facade - Phase 2 Advanced Memory System
 */
export class ApolloMemory {
  /**
   * Saves a persistent piece of information to long-term memory.
   */
  static saveMemory(
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
    logger.info('ApolloMemory', `Saving memory [${options?.category || 'FACT'}]: ${content}`);
    return MemoryStore.save(content, options);
  }

  /**
   * Updates an existing memory item.
   */
  static updateMemory(id: string, partial: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): MemoryItem | null {
    return MemoryStore.update(id, partial);
  }

  /**
   * Retrieves a memory item by ID.
   */
  static getMemory(id: string): MemoryItem | null {
    return MemoryStore.get(id);
  }

  /**
   * Retrieves a memory item by exact or case-insensitive key.
   */
  static getMemoryByKey(key: string): MemoryItem | null {
    return MemoryStore.getByKey(key);
  }

  /**
   * Retrieves all stored memories.
   */
  static getAllMemories(): MemoryItem[] {
    return MemoryStore.getAll();
  }

  /**
   * Searches memories relevant to a query with optional category filter.
   */
  static searchMemory(query: string, categoryFilter?: MemoryCategory | 'ALL'): MemoryItem[] {
    return MemoryStore.search(query, categoryFilter);
  }

  /**
   * Retrieves top scored relevant memories for a user query.
   */
  static getRelevantMemories(query: string, limit = 5): MemorySearchResult[] {
    return MemoryRetrieval.getRelevantMemories(query, limit);
  }

  /**
   * Builds a concise context string containing only the top relevant memories for Gemini.
   */
  static buildMemoryContext(query: string, limit = 5): { contextText: string; count: number; memories: MemoryItem[] } {
    return MemoryRetrieval.buildMemoryContext(query, limit);
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
    ProjectMemoryManager.clearAllProjects();
  }

  /**
   * Exports all memories and project structures as JSON.
   */
  static exportMemories(): string {
    return MemoryStore.exportJSON();
  }

  /**
   * Imports memory JSON with validation and duplicate merging.
   */
  static importMemories(jsonString: string): { importedCount: number; updatedCount: number; errors: string[] } {
    return MemoryStore.importJSON(jsonString);
  }

  /**
   * Formats long-term memories for display or fallback context snippets.
   */
  static getContextSnippet(): string {
    const memories = MemoryStore.getAll();
    if (memories.length === 0) return 'No prior memories stored.';
    return memories
      .slice(0, 8)
      .map((m, idx) => `${idx + 1}. [${m.category}] ${m.key ? `[${m.key}] ` : ''}${m.content}`)
      .join('\n');
  }

  /**
   * Fast Natural Language Memory Command Interceptor (Phase 2).
   * Handles direct memory voice/text commands instantly:
   * - "Remember that..."
   * - "Don't forget that..."
   * - "Forget that..."
   * - "What do you remember about..."
   */
  static handleNaturalLanguageCommand(rawInput: string): { handled: boolean; responseText?: string; memoryAction?: string } {
    const text = rawInput.trim();
    const lower = text.toLowerCase();

    // 1. Security Check: Sensitive Secrets
    if (MemoryStore.containsSensitiveSecret(text)) {
      return {
        handled: true,
        responseText: 'Security Warning: Apollo will not store sensitive API keys, passwords, or authentication tokens in long-term memory for your security.',
        memoryAction: 'security_blocked',
      };
    }

    // 2. Remember Commands ("Remember that...", "Remember my...", "Don't forget that...")
    const rememberMatch = text.match(/^(?:hey apollo,\s*|apollo,\s*|please\s*)?(?:remember\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?|keep\s+in\s+mind\s+(?:that\s+)?)(.+)/i);
    if (rememberMatch) {
      const memoryContent = rememberMatch[1].trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
      if (memoryContent.length > 2) {
        // Classify category automatically based on language
        let category: MemoryCategory = 'FACT';
        let importance = 4;
        const lowerContent = memoryContent.toLowerCase();

        if (lowerContent.includes('prefer') || lowerContent.includes('like') || lowerContent.includes('want')) {
          category = 'PREFERENCE';
          UserManager.addPreference(memoryContent);
        } else if (lowerContent.includes('project') || lowerContent.includes('app') || lowerContent.includes('building') || lowerContent.includes('apollo')) {
          category = 'PROJECT';
          importance = 5;
        } else if (lowerContent.includes('goal') || lowerContent.includes('aim') || lowerContent.includes('target') || lowerContent.includes('deadline')) {
          category = 'GOAL';
          UserManager.addGoal(memoryContent);
        } else if (lowerContent.includes('should') || lowerContent.includes('always') || lowerContent.includes('never') || lowerContent.includes('ask before')) {
          category = 'INSTRUCTION';
          importance = 5;
        } else if (lowerContent.includes('my name is') || lowerContent.includes('i am') || lowerContent.includes('call me')) {
          category = 'USER';
          const nameMatch = memoryContent.match(/(?:my name is|i am|call me)\s+([A-Za-z0-9_-]+)/i);
          if (nameMatch) {
            UserManager.updateProfile({ name: nameMatch[1], preferredName: nameMatch[1] });
          }
        }

        const saveResult = this.saveMemory(memoryContent, {
          category,
          importance,
          source: 'user',
          tags: [category.toLowerCase()],
        });

        if (saveResult.securityWarning) {
          return {
            handled: true,
            responseText: saveResult.securityWarning,
            memoryAction: 'security_blocked',
          };
        }

        const confirmPhrase = saveResult.isUpdated
          ? "Understood. I've updated that in my memory."
          : "Understood. I've saved that.";

        return {
          handled: true,
          responseText: confirmPhrase,
          memoryAction: 'saved',
        };
      }
    }

    // 3. Forget Commands ("Forget that...", "Forget my...")
    const forgetMatch = text.match(/^(?:hey apollo,\s*|apollo,\s*|please\s*)?(?:forget\s+(?:that\s+)?|delete\s+memory\s+(?:about\s+)?|remove\s+(?:memory\s+about\s+)?)(.+)/i);
    if (forgetMatch) {
      const forgetTarget = forgetMatch[1].trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
      const matches = this.searchMemory(forgetTarget);

      if (matches.length === 1) {
        this.deleteMemory(matches[0].id);
        return {
          handled: true,
          responseText: "Done. I've forgotten that.",
          memoryAction: 'deleted',
        };
      } else if (matches.length > 1) {
        // If exact target matches one item closely, delete that one
        const exact = matches.find((m) => m.content.toLowerCase().includes(forgetTarget.toLowerCase()));
        if (exact) {
          this.deleteMemory(exact.id);
          return {
            handled: true,
            responseText: "Done. I've forgotten that.",
            memoryAction: 'deleted',
          };
        }
        return {
          handled: true,
          responseText: `Multiple matching memories found (${matches.length}). Please specify which one in the Memory panel.`,
          memoryAction: 'ambiguous_delete',
        };
      } else {
        return {
          handled: true,
          responseText: `I could not find any memory matching "${forgetTarget}".`,
          memoryAction: 'not_found',
        };
      }
    }

    // 4. Show Memory Commands ("What do you remember about me?", "What do you know about...")
    if (/^(?:what do you (?:remember|know) about (?:me|my preferences|my projects?|apollo)|do you remember (?:me|anything))\??$/i.test(text)) {
      const memories = this.getAllMemories();
      if (memories.length === 0) {
        return {
          handled: true,
          responseText: "I don't have any saved memories about you yet. You can tell me anything to remember at any time.",
          memoryAction: 'recalled',
        };
      }

      // Group into concise tactical summary
      const projects = memories.filter((m) => m.category === 'PROJECT');
      const prefs = memories.filter((m) => m.category === 'PREFERENCE');
      const instructions = memories.filter((m) => m.category === 'INSTRUCTION');
      const goals = memories.filter((m) => m.category === 'GOAL');

      const parts: string[] = [];
      if (projects.length > 0) {
        parts.push(`your project is ${projects[0].content.replace(/^my project is /i, '')}`);
      }
      if (prefs.length > 0) {
        parts.push(`you prefer ${prefs[0].content.replace(/^i prefer /i, '')}`);
      }
      if (goals.length > 0) {
        parts.push(`your goal is ${goals[0].content.replace(/^my goal is /i, '')}`);
      }
      if (instructions.length > 0) {
        parts.push(`instruction: ${instructions[0].content}`);
      }

      const summary = parts.length > 0
        ? `I remember that ${parts.join(', and ')}.`
        : `I have ${memories.length} memories logged in your neural archive.`;

      return {
        handled: true,
        responseText: summary,
        memoryAction: 'recalled',
      };
    }

    return { handled: false };
  }
}
