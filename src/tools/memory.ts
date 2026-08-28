import { ToolDefinition } from './calculator';
import { ApolloMemory } from '../memory/memory';
import { logger } from '../utils/logger';

export const saveMemoryTool: ToolDefinition = {
  name: 'save_memory',
  description: 'Saves important facts, user preferences, names, project names, or details to permanent memory for future recall.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The core fact, note, or preference to remember (e.g., "My project is called Apollo").',
      },
      key: {
        type: 'string',
        description: 'An optional short identifier key (e.g., "project_name", "user_city").',
      },
      category: {
        type: 'string',
        description: 'Category of memory: "fact", "preference", "project", or "general".',
        enum: ['fact', 'preference', 'project', 'general'],
      },
    },
    required: ['content'],
  },
  execute: async (args: Record<string, unknown>) => {
    const content = String(args.content || '').trim();
    const key = args.key ? String(args.key).trim() : undefined;
    const category = (args.category as 'fact' | 'preference' | 'project' | 'general') || 'general';

    if (!content) {
      return { result: null, error: 'Cannot save empty memory content.' };
    }

    try {
      const saved = ApolloMemory.saveMemory(content, { key, category });
      logger.info('MemoryTool', `Saved memory id=${saved.id}`);
      return {
        result: {
          status: 'saved',
          id: saved.id,
          content: saved.content,
          key: saved.key,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save memory';
      return { result: null, error: errorMsg };
    }
  },
};

export const searchMemoryTool: ToolDefinition = {
  name: 'search_memory',
  description: 'Searches previously stored memories, notes, and facts.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keywords or topic to search for in saved memories.',
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>) => {
    const query = String(args.query || '').trim();
    try {
      const results = ApolloMemory.searchMemory(query);
      return {
        result: {
          query,
          matchCount: results.length,
          memories: results.map((r) => ({
            id: r.id,
            key: r.key,
            content: r.content,
            category: r.category,
          })),
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Memory search error';
      return { result: null, error: errorMsg };
    }
  },
};
