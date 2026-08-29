import { ToolDefinition } from './calculator';
import { ApolloMemory } from '../memory/memory';
import { MemoryCategory } from '../memory/types';
import { UserManager } from '../memory/user';
import { logger } from '../utils/logger';

export const saveMemoryTool: ToolDefinition = {
  name: 'save_memory',
  description: 'Saves important facts, user preferences, names, project names, goals, or instructions to permanent memory for future recall.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The core fact, note, project detail, or preference to remember (e.g., "My project is called Apollo").',
      },
      category: {
        type: 'string',
        description: 'Category of memory: "USER", "PREFERENCE", "PROJECT", "GOAL", "FACT", "INSTRUCTION", or "CONTEXT".',
        enum: ['USER', 'PREFERENCE', 'PROJECT', 'GOAL', 'FACT', 'INSTRUCTION', 'CONTEXT'],
      },
      importance: {
        type: 'number',
        description: 'Importance rating from 1 (minor) to 5 (critical user directive/rule).',
      },
      key: {
        type: 'string',
        description: 'Optional short identifier key (e.g., "main_project", "response_style").',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional descriptive tags for fast indexing.',
      },
    },
    required: ['content'],
  },
  execute: async (args: Record<string, unknown>) => {
    const content = String(args.content || '').trim();
    const key = args.key ? String(args.key).trim() : undefined;
    const category = (args.category ? String(args.category).toUpperCase() : 'FACT') as MemoryCategory;
    const importance = typeof args.importance === 'number' ? args.importance : undefined;
    const tags = Array.isArray(args.tags) ? args.tags.map(String) : undefined;

    if (!content) {
      return { result: null, error: 'Cannot save empty memory content.' };
    }

    try {
      const saved = ApolloMemory.saveMemory(content, {
        key,
        category,
        importance,
        tags,
        source: 'agent',
      });

      if (saved.securityWarning) {
        return {
          result: {
            status: 'blocked',
            warning: saved.securityWarning,
          },
        };
      }

      logger.info('MemoryTool', `Saved memory id=${saved.memory.id} (updated: ${saved.isUpdated})`);
      return {
        result: {
          status: saved.isUpdated ? 'updated' : 'saved',
          id: saved.memory.id,
          content: saved.memory.content,
          category: saved.memory.category,
          importance: saved.memory.importance,
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
  description: 'Searches previously stored memories, notes, projects, and user preferences.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keywords or topic to search for in saved memories.',
      },
      category: {
        type: 'string',
        description: 'Optional category filter: "USER", "PREFERENCE", "PROJECT", "GOAL", "FACT", "INSTRUCTION", or "ALL".',
        enum: ['USER', 'PREFERENCE', 'PROJECT', 'GOAL', 'FACT', 'INSTRUCTION', 'ALL'],
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>) => {
    const query = String(args.query || '').trim();
    const category = args.category ? (String(args.category).toUpperCase() as MemoryCategory | 'ALL') : 'ALL';
    try {
      const results = ApolloMemory.searchMemory(query, category);
      return {
        result: {
          query,
          matchCount: results.length,
          memories: results.map((r) => ({
            id: r.id,
            key: r.key,
            content: r.content,
            category: r.category,
            importance: r.importance,
            tags: r.tags,
          })),
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Memory search error';
      return { result: null, error: errorMsg };
    }
  },
};

export const deleteMemoryTool: ToolDefinition = {
  name: 'delete_memory',
  description: 'Deletes a specific memory from Apollo storage when the user requests to forget or remove something.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The memory ID to delete, or topic/content to match.',
      },
    },
    required: ['id'],
  },
  execute: async (args: Record<string, unknown>) => {
    const idOrQuery = String(args.id || '').trim();
    try {
      // First try deleting directly by ID
      const directDeleted = ApolloMemory.deleteMemory(idOrQuery);
      if (directDeleted) {
        return { result: { status: 'deleted', id: idOrQuery } };
      }

      // Otherwise search for matching memory
      const matches = ApolloMemory.searchMemory(idOrQuery);
      if (matches.length === 1) {
        ApolloMemory.deleteMemory(matches[0].id);
        return { result: { status: 'deleted', deletedItem: matches[0].content } };
      } else if (matches.length > 1) {
        return {
          result: {
            status: 'multiple_matches',
            matches: matches.map((m) => ({ id: m.id, content: m.content })),
          },
        };
      }

      return { result: { status: 'not_found', query: idOrQuery } };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Memory deletion error';
      return { result: null, error: errorMsg };
    }
  },
};

export const getUserProfileTool: ToolDefinition = {
  name: 'get_user_profile',
  description: 'Retrieves the user profile, including stored preferences, goals, and notes.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    try {
      const profile = UserManager.getProfile();
      return { result: profile };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error fetching user profile';
      return { result: null, error: errorMsg };
    }
  },
};

export const updateUserProfileTool: ToolDefinition = {
  name: 'update_user_profile',
  description: 'Updates user profile attributes such as name, preferredName, preferences, or goals.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User name' },
      preferredName: { type: 'string', description: 'Preferred nickname or callsign' },
      addPreference: { type: 'string', description: 'New preference string to add' },
      addGoal: { type: 'string', description: 'New goal string to add' },
      addNote: { type: 'string', description: 'New user note string to add' },
    },
  },
  execute: async (args: Record<string, unknown>) => {
    try {
      if (args.name) UserManager.updateProfile({ name: String(args.name) });
      if (args.preferredName) UserManager.updateProfile({ preferredName: String(args.preferredName) });
      if (args.addPreference) UserManager.addPreference(String(args.addPreference));
      if (args.addGoal) UserManager.addGoal(String(args.addGoal));
      if (args.addNote) UserManager.addNote(String(args.addNote));

      const updated = UserManager.getProfile();
      return { result: { status: 'updated', profile: updated } };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error updating user profile';
      return { result: null, error: errorMsg };
    }
  },
};
