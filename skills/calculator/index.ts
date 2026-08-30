import { Skill, SkillExecutionResult, SkillMatchResult } from '../types';
import { safeEvaluateMath } from '../../src/tools/calculator';
import { logger } from '../../src/utils/logger';

/**
 * Apollo Calculator Skill (Phase 3)
 * Provides high-precision arithmetic, trigonometric, and scientific evaluation without eval().
 */
export const CalculatorSkill: Skill = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Evaluates mathematical operations, arithmetic, algebraic formulas, trigonometry, percentages, and scientific calculations with exact precision.',
  version: '1.0.0',
  enabled: true,
  permission: 'SAFE',
  category: 'CALCULATION',
  capabilities: [
    'arithmetic',
    'scientific_math',
    'trigonometry',
    'powers_and_roots',
    'percentages',
    'safe_evaluation',
  ],
  supportedActions: ['evaluate', 'percentage'],
  activityLabel: 'Using Calculator...',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g., "125 * 48", "sqrt(256) + 40", "(500 - 35) * 1.08").',
      },
    },
    required: ['expression'],
  },

  matchesQuery(rawQuery: string): SkillMatchResult {
    const text = rawQuery.trim().toLowerCase();

    // 1. Direct arithmetic phrases (e.g., "what is 125 multiplied by 48", "calculate 500 / 25", "125 times 48")
    const mathPattern = /(?:what\s+is|calculate|compute|solve|how\s+much\s+is)?\s*([0-9\s.,+\-*/()^%x]|times|multiplied\s+by|divided\s+by|plus|minus|sqrt|sin|cos|tan|pi|pow)+\??$/i;
    
    // Check if query is explicitly asking a calculation
    const hasMathKeywords = /\b(multiplied\s+by|divided\s+by|times|plus|minus|square\s+root\s+of|sqrt|calculate|compute|percent)\b/i.test(text) || text.includes('%');
    const hasDigitsAndOperators = /[0-9]+\s*[+\-*/^x%]\s*[0-9]+/.test(text);

    if (hasMathKeywords || hasDigitsAndOperators) {
      // Extract the mathematical part of the string
      let cleanExpr = text
        .replace(/^(?:hey\s+apollo,\s*|apollo,\s*|please\s*)?(?:what\s+is|calculate|compute|solve|how\s+much\s+is|tell\s+me)\s+/i, '')
        .replace(/\?+$/, '')
        .trim();

      if (cleanExpr.length > 0) {
        return {
          matched: true,
          confidence: hasDigitsAndOperators || text.includes('%') ? 0.95 : 0.85,
          suggestedAction: 'evaluate',
          extractedParams: { expression: cleanExpr },
          reason: 'Identified mathematical evaluation intent',
        };
      }
    }

    return { matched: false, confidence: 0 };
  },

  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const rawExpression = String(params.expression || '').trim();

    if (!rawExpression) {
      return { result: null, error: 'Empty expression provided to Calculator skill.' };
    }

    logger.info('CalculatorSkill', `Evaluating expression: "${rawExpression}"`);

    try {
      const numResult = safeEvaluateMath(rawExpression);
      const formatted = Number.isInteger(numResult)
        ? numResult.toLocaleString('en-US')
        : Number(numResult.toFixed(8)).toString();

      return {
        result: {
          expression: rawExpression,
          value: numResult,
          formatted,
          summary: `The result is ${formatted}.`,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Calculation failed';
      logger.warn('CalculatorSkill', `Calculation error: ${errorMsg}`);
      return {
        result: null,
        error: `I couldn't complete that calculation: ${errorMsg}`,
      };
    }
  },
};
