import { MemoryStore } from './store';
import { MemoryItem, MemorySearchResult } from './types';

// Stop words to filter out during tokenization
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'i', 'me', 'my', 'myself', 'you', 'your', 'he', 'she', 'it', 'we',
  'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'do',
  'does', 'did', 'have', 'has', 'had', 'can', 'could', 'should', 'would',
  'will', 'just', 'that', 'this', 'there', 'be', 'been', 'being', 'so'
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export class MemoryRetrieval {
  /**
   * Scores and returns the most relevant memories for a user query.
   * Relevance formula: Keyword Match + Tag Match + Category Match + (Importance * 1.5) + Recency Decay
   */
  static getRelevantMemories(query: string, limit = 5): MemorySearchResult[] {
    const memories = MemoryStore.getAll();
    if (memories.length === 0) return [];

    if (!query || !query.trim()) {
      // If query is empty, return highest importance & recency items
      return memories.slice(0, limit).map((item) => ({
        item,
        score: item.importance * 2,
      }));
    }

    const queryLower = query.toLowerCase();
    const queryTokens = extractKeywords(query);
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const scoredResults: MemorySearchResult[] = [];

    for (const item of memories) {
      let score = 0;
      const matchedTerms: string[] = [];

      const contentLower = item.content.toLowerCase();
      const keyLower = (item.key || '').toLowerCase();
      const tagsLower = item.tags.map((t) => t.toLowerCase());

      // 1. Exact query match in content or key
      if (contentLower.includes(queryLower) || (keyLower && keyLower.includes(queryLower))) {
        score += 10.0;
        matchedTerms.push(queryLower);
      }

      // 2. Keyword token matching
      for (const token of queryTokens) {
        if (contentLower.includes(token)) {
          score += 3.0;
          matchedTerms.push(token);
        }
        if (keyLower.includes(token)) {
          score += 4.0;
          matchedTerms.push(token);
        }
        if (tagsLower.includes(token)) {
          score += 3.5;
          matchedTerms.push(`tag:${token}`);
        }
      }

      // 3. Category relevance boost
      if (queryLower.includes('project') && item.category === 'PROJECT') score += 4.0;
      if ((queryLower.includes('preference') || queryLower.includes('prefer') || queryLower.includes('like')) && item.category === 'PREFERENCE') score += 4.0;
      if ((queryLower.includes('goal') || queryLower.includes('aim') || queryLower.includes('target')) && item.category === 'GOAL') score += 4.0;
      if ((queryLower.includes('user') || queryLower.includes('name') || queryLower.includes('who am i')) && item.category === 'USER') score += 4.0;
      if (item.category === 'INSTRUCTION') score += 2.0; // General instructions always have baseline relevance

      // 4. Importance score weighting (1-5 scale)
      score += (item.importance || 3) * 1.5;

      // 5. Recency boost (items updated within last 7 days get up to 2.0 points)
      const ageDays = (now - item.updatedAt) / ONE_DAY_MS;
      const recencyBoost = Math.max(0, 2.0 - ageDays * 0.1);
      score += recencyBoost;

      // Only include items that have keyword/category relevance or high priority instructions
      const hasDirectRelevance = matchedTerms.length > 0;
      const isCriticalInstruction = item.category === 'INSTRUCTION' && item.importance >= 4;

      if (hasDirectRelevance || isCriticalInstruction) {
        scoredResults.push({
          item,
          score,
          matchedTerms: Array.from(new Set(matchedTerms)),
        });
      }
    }

    // Sort by descending score
    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.slice(0, limit);
  }

  /**
   * Builds a concise context string containing only the top relevant memories for Gemini.
   */
  static buildMemoryContext(query: string, limit = 5): { contextText: string; count: number; memories: MemoryItem[] } {
    const results = this.getRelevantMemories(query, limit);

    if (results.length === 0) {
      return { contextText: '', count: 0, memories: [] };
    }

    const memoryLines = results.map((r) => {
      const cat = r.item.category;
      const keyPrefix = r.item.key ? `[${r.item.key}] ` : '';
      return `- [${cat}] ${keyPrefix}${r.item.content}`;
    });

    const contextText = `Relevant user memory:\n${memoryLines.join('\n')}`;

    return {
      contextText,
      count: results.length,
      memories: results.map((r) => r.item),
    };
  }
}
