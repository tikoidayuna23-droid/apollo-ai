import { Skill } from './types';
import { SkillRegistry } from './registry';
import { logger } from '../src/utils/logger';

export interface SkillRoutingDecision {
  skill: Skill;
  confidence: number;
  action?: string;
  extractedParams?: Record<string, unknown>;
  reason?: string;
  isDirectMatch?: boolean;
}

/**
 * Apollo Skill Router (Phase 3)
 * Analyzes incoming user requests (via text or voice) and identifies the most appropriate
 * registered skill without executing it directly.
 */
export class SkillRouter {
  /**
   * Determine the single best matching skill for a user query.
   */
  static route(query: string, _context?: unknown): SkillRoutingDecision | null {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return null;
    }

    const trimmedQuery = query.trim();
    const matches = this.findMatchingSkills(trimmedQuery);

    if (matches.length === 0) {
      logger.debug('SkillRouter', `No specific skill match found for "${trimmedQuery}". Routing to Agent planner.`);
      return null;
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);
    const top = matches[0];

    // High confidence threshold (>= 0.70) indicates confident routing
    if (top.confidence >= 0.70) {
      logger.info(
        'SkillRouter',
        `Routed query "${trimmedQuery.slice(0, 40)}" -> Skill "${top.skill.name}" (confidence: ${top.confidence.toFixed(2)}, reason: ${top.reason})`
      );
      return {
        skill: top.skill,
        confidence: top.confidence,
        action: top.action,
        extractedParams: top.extractedParams,
        reason: top.reason,
        isDirectMatch: top.confidence >= 0.90,
      };
    }

    return null;
  }

  /**
   * Scan all registered skills to find all potential candidates and their confidence scores.
   */
  static findMatchingSkills(
    query: string
  ): Array<{
    skill: Skill;
    confidence: number;
    action?: string;
    extractedParams?: Record<string, unknown>;
    reason?: string;
  }> {
    const allSkills = SkillRegistry.getSkills();
    const results: Array<{
      skill: Skill;
      confidence: number;
      action?: string;
      extractedParams?: Record<string, unknown>;
      reason?: string;
    }> = [];

    for (const skill of allSkills) {
      // 1. Check skill-defined matcher if provided
      if (typeof skill.matchesQuery === 'function') {
        try {
          const match = skill.matchesQuery(query);
          if (match && match.matched && match.confidence > 0) {
            results.push({
              skill,
              confidence: match.confidence,
              action: match.suggestedAction,
              extractedParams: match.extractedParams,
              reason: match.reason || `Skill matcher for ${skill.name}`,
            });
            continue;
          }
        } catch (err) {
          logger.warn('SkillRouter', `Matcher failed for skill "${skill.name}":`, err);
        }
      }

      // 2. Generic capability fallback check
      const queryLower = query.toLowerCase();
      let matchedCaps = 0;
      for (const cap of skill.capabilities) {
        const capWords = cap.toLowerCase().split('_');
        if (capWords.every((w) => queryLower.includes(w))) {
          matchedCaps++;
        }
      }

      if (matchedCaps > 0) {
        const confidence = Math.min(0.5 + matchedCaps * 0.1, 0.85);
        results.push({
          skill,
          confidence,
          reason: `Matched ${matchedCaps} capability keywords for ${skill.name}`,
        });
      }
    }

    return results;
  }
}
