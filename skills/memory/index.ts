import { Skill, SkillExecutionResult, SkillMatchResult } from '../types';
import { ApolloMemory } from '../../src/memory/memory';
import { MemoryCategory } from '../../src/memory/types';
import { UserManager } from '../../src/memory/user';
import { ProjectMemoryManager } from '../../src/memory/projects';
import { logger } from '../../src/utils/logger';

/**
 * Apollo Memory Skill (Phase 3)
 * Integrates the Phase 2 local-first neural memory archive and user profile into the skills engine.
 */
export const MemorySkill: Skill = {
  id: 'memory',
  name: 'Neural Memory',
  description: 'Stores, searches, updates, and removes long-term memories, user preferences, projects, goals, instructions, and identity profile.',
  version: '1.0.0',
  enabled: true,
  permission: 'WRITE',
  capabilities: [
    'store_memory',
    'search_memory',
    'delete_memory',
    'user_profile',
    'project_tracking',
    'natural_memory_commands',
  ],
  activityLabel: 'Accessing Memory...',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "save", "search", "delete", "get_profile", "update_profile", "get_projects".',
        enum: ['save', 'search', 'delete', 'get_profile', 'update_profile', 'get_projects'],
      },
      content: {
        type: 'string',
        description: 'Memory content to store or update (e.g., "Apollo is my main AI project").',
      },
      query: {
        type: 'string',
        description: 'Keywords or question to search across stored memories.',
      },
      category: {
        type: 'string',
        description: 'Category: "USER", "PREFERENCE", "PROJECT", "GOAL", "FACT", "INSTRUCTION", "CONTEXT".',
        enum: ['USER', 'PREFERENCE', 'PROJECT', 'GOAL', 'FACT', 'INSTRUCTION', 'CONTEXT'],
      },
      importance: {
        type: 'number',
        description: 'Importance rating from 1 to 5.',
      },
      key: {
        type: 'string',
        description: 'Optional unique identifier key.',
      },
      id: {
        type: 'string',
        description: 'Target memory ID or topic to delete or inspect.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for fast categorization.',
      },
    },
    required: ['action'],
  },

  matchesQuery(rawQuery: string): SkillMatchResult {
    const text = rawQuery.trim();
    const lower = text.toLowerCase();

    // 1. Remember command
    if (/^(?:hey\s+apollo,\s*|apollo,\s*|please\s*)?(?:remember\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?|keep\s+in\s+mind\s+(?:that\s+)?)/i.test(text)) {
      const match = text.match(/^(?:hey\s+apollo,\s*|apollo,\s*|please\s*)?(?:remember\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?|keep\s+in\s+mind\s+(?:that\s+)?)(.+)/i);
      const content = match ? match[1].trim() : text;
      return {
        matched: true,
        confidence: 0.98,
        suggestedAction: 'save',
        extractedParams: { action: 'save', content },
        reason: 'Detected explicit remember command',
      };
    }

    // 2. Forget command
    if (/^(?:hey\s+apollo,\s*|apollo,\s*|please\s*)?(?:forget\s+(?:that\s+)?|delete\s+memory\s+(?:about\s+)?|remove\s+(?:memory\s+about\s+)?)/i.test(text)) {
      const match = text.match(/^(?:hey\s+apollo,\s*|apollo,\s*|please\s*)?(?:forget\s+(?:that\s+)?|delete\s+memory\s+(?:about\s+)?|remove\s+(?:memory\s+about\s+)?)(.+)/i);
      const target = match ? match[1].trim() : text;
      return {
        matched: true,
        confidence: 0.98,
        suggestedAction: 'delete',
        extractedParams: { action: 'delete', id: target },
        reason: 'Detected explicit forget command',
      };
    }

    // 3. Memory recall queries ("what do you remember about...", "what is my main AI project", "do you know my project")
    if (
      /^(?:what\s+do\s+you\s+(?:remember|know)\s+about|do\s+you\s+remember\s+|what\s+is\s+my\s+(?:main\s+)?(?:ai\s+)?project|what\s+are\s+my\s+preferences|what\s+is\s+my\s+goal)/i.test(text)
    ) {
      return {
        matched: true,
        confidence: 0.92,
        suggestedAction: 'search',
        extractedParams: { action: 'search', query: text },
        reason: 'Detected memory retrieval inquiry',
      };
    }

    return { matched: false, confidence: 0 };
  },

  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const action = String(params.action || 'search').toLowerCase();
    logger.info('MemorySkill', `Executing action: "${action}"`);

    try {
      switch (action) {
        case 'save': {
          const content = String(params.content || '').trim();
          if (!content) {
            return { result: null, error: 'Cannot save empty memory content.' };
          }

          const category = params.category ? (String(params.category).toUpperCase() as MemoryCategory) : undefined;
          const importance = typeof params.importance === 'number' ? params.importance : undefined;
          const key = params.key ? String(params.key) : undefined;
          const tags = Array.isArray(params.tags) ? params.tags.map(String) : undefined;

          const saved = ApolloMemory.saveMemory(content, {
            category,
            importance,
            key,
            tags,
            source: 'agent',
          });

          if (saved.securityWarning) {
            return {
              result: {
                status: 'blocked',
                warning: saved.securityWarning,
                summary: saved.securityWarning,
              },
            };
          }

          const summary = saved.isUpdated
            ? "Understood. I've updated that in my memory."
            : "Understood. I've saved that.";

          return {
            result: {
              status: saved.isUpdated ? 'updated' : 'saved',
              id: saved.memory.id,
              content: saved.memory.content,
              category: saved.memory.category,
              summary,
            },
          };
        }

        case 'search': {
          const query = String(params.query || params.content || '').trim();
          const category = params.category ? (String(params.category).toUpperCase() as MemoryCategory | 'ALL') : 'ALL';
          
          const results = ApolloMemory.searchMemory(query, category);
          const topResults = results.slice(0, 5);

          let summary = '';
          if (topResults.length === 0) {
            summary = query
              ? `No memories matched "${query}".`
              : 'No memories currently in storage.';
          } else {
            const lines = topResults.map((r) => r.content);
            summary = `Found ${topResults.length} matching memory entries: ${lines.join('; ')}`;
          }

          return {
            result: {
              query,
              matchCount: results.length,
              memories: topResults.map((r) => ({
                id: r.id,
                content: r.content,
                category: r.category,
                importance: r.importance,
                key: r.key,
              })),
              summary,
            },
          };
        }

        case 'delete': {
          const idOrTopic = String(params.id || params.content || params.query || '').trim();
          if (!idOrTopic) {
            return { result: null, error: 'No memory identifier or topic specified for deletion.' };
          }

          // Try direct deletion
          const direct = ApolloMemory.deleteMemory(idOrTopic);
          if (direct) {
            return {
              result: {
                status: 'deleted',
                id: idOrTopic,
                summary: "Done. I've forgotten that.",
              },
            };
          }

          // Search matches
          const matches = ApolloMemory.searchMemory(idOrTopic);
          if (matches.length === 1) {
            ApolloMemory.deleteMemory(matches[0].id);
            return {
              result: {
                status: 'deleted',
                id: matches[0].id,
                content: matches[0].content,
                summary: "Done. I've forgotten that.",
              },
            };
          } else if (matches.length > 1) {
            return {
              result: {
                status: 'multiple_matches',
                matchCount: matches.length,
                matches: matches.map((m) => ({ id: m.id, content: m.content })),
                summary: `Found ${matches.length} matching memories. Please specify which to delete.`,
              },
            };
          }

          return {
            result: {
              status: 'not_found',
              summary: `I could not find any memory matching "${idOrTopic}".`,
            },
          };
        }

        case 'get_profile': {
          const profile = UserManager.getProfile();
          return {
            result: {
              profile,
              summary: `User is ${profile.name} (callsign: ${profile.assistantCallsign}).`,
            },
          };
        }

        case 'update_profile': {
          const updates: Record<string, string> = {};
          if (params.name) updates.name = String(params.name);
          if (params.preferredName) updates.preferredName = String(params.preferredName);
          if (params.assistantCallsign) updates.assistantCallsign = String(params.assistantCallsign);
          const updated = UserManager.updateProfile(updates);
          return {
            result: {
              profile: updated,
              summary: 'User profile updated.',
            },
          };
        }

        case 'get_projects': {
          const projects = ProjectMemoryManager.getAllProjects();
          return {
            result: {
              projects,
              summary: `Found ${projects.length} tracked projects.`,
            },
          };
        }

        default:
          return { result: null, error: `Unsupported Memory skill action: "${action}"` };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Memory skill execution failed';
      logger.error('MemorySkill', 'Error:', err);
      return { result: null, error: errorMsg };
    }
  },
};
