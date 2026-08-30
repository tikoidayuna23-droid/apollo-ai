import { TaskPlan, TaskStep } from './types';
import { SkillRouter } from '../../../skills/router';
import { SkillRegistry } from '../../../skills/registry';
import { SessionStorage, ChatMessage } from '../../storage/sessions';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

export class TaskPlanner {
  /**
   * Analyzes the user's inquiry, historical context, and registered skills
   * to construct a safe, structured, executable TaskPlan.
   */
  static plan(userQuery: string, sessionId?: string): TaskPlan {
    const raw = userQuery.trim();
    const query = raw.toLowerCase();

    // 1. Direct Conversational Greetings & Identity (No skill required)
    if (/^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening))\s*(apollo)?\??$/i.test(query)) {
      return {
        goal: 'Greet the user in Apollo tactical cadence',
        steps: [],
        isDirectAnswer: true,
        directAnswerText: 'Welcome. Protocol accepted. Systems online and standing by.',
      };
    }

    if (/^(who\s+are\s+you|what\s+is\s+your\s+name|identify\s+yourself)\??$/i.test(query)) {
      return {
        goal: 'State Apollo identity',
        steps: [],
        isDirectAnswer: true,
        directAnswerText: 'I am Apollo, an advanced central tactical AI computer system.',
      };
    }

    // 2. Dynamic Tool Discovery (What tools do you have?)
    if (
      /\b(what\s+tools\s+(?:do\s+you\s+have|are\s+available)|list\s+(?:all\s+)?(?:your\s+)?tools|what\s+are\s+your\s+tools|show\s+(?:me\s+)?(?:all\s+)?tools|what\s+skills\s+(?:do\s+you\s+have|are\s+available)|what\s+can\s+you\s+do|what\s+are\s+your\s+capabilities)\b/i.test(
        query
      )
    ) {
      const skills = SkillRegistry.getSkills();
      const categoryLabels: Record<string, string> = {
        CALCULATION: 'Calculation & Math',
        TEXT: 'Text Intelligence',
        DATA: 'Data Analysis',
        FILE: 'File Intelligence',
        INFORMATION: 'Information & Neural Memory',
        PRODUCTIVITY: 'Productivity',
        SYSTEM: 'System & Diagnostics',
      };

      const grouped: Record<string, string[]> = {};
      for (const s of skills) {
        const cat = s.category || 'INFORMATION';
        if (!grouped[cat]) grouped[cat] = [];
        const statusStr = s.enabled ? 'Enabled' : 'Disabled';
        grouped[cat].push(`• ${s.name} (v${s.version}, ${statusStr}): ${s.description}`);
      }

      const sections = Object.entries(grouped).map(([cat, items]) => {
        const label = categoryLabels[cat] || cat;
        return `${label}:\n${items.join('\n')}`;
      });

      const discoveryText = `I have the following registered tools and capabilities:\n\n${sections.join('\n\n')}`;

      return {
        goal: 'Dynamic tool discovery and capabilities inventory',
        steps: [],
        isDirectAnswer: true,
        directAnswerText: discoveryText,
      };
    }

    // 3. Multi-Tool Chain: Math Calculation + Text Explanation / Summary
    // e.g. "Calculate 15% of 8500 and explain the result."
    // e.g. "Calculate 15% of 8500 and summarize the result."
    const mathExplainMatch = query.match(
      /(?:calculate|compute|find|what\s+is)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:and|,)?\s*(?:then\s+)?(?:explain\s+(?:the\s+result|this|it)|summarize\s+(?:the\s+result|this|it)|give\s+(?:me\s+)?an\s+explanation)/i
    );

    if (mathExplainMatch) {
      const pct = mathExplainMatch[1];
      const baseRaw = mathExplainMatch[2].replace(/,/g, '');
      const baseNum = parseFloat(baseRaw);
      const baseFormatted = baseNum.toLocaleString('en-US');

      const step1: TaskStep = {
        id: 'step_1',
        skillId: 'calculator',
        action: 'evaluate',
        description: `Calculate ${pct}% of ${baseFormatted}`,
        input: { expression: `${pct}% of ${baseRaw}` },
        dependsOn: [],
        status: 'pending',
      };

      const step2: TaskStep = {
        id: 'step_2',
        skillId: 'text_intelligence',
        action: 'expand',
        description: 'Explain and contextualize calculation result',
        input: {
          action: 'expand',
          text: `${pct}% of ${baseFormatted} is $PREV. This calculation represents the proportional share of ${pct} parts per hundred from the base amount of ${baseFormatted}.`,
        },
        dependsOn: ['step_1'],
        status: 'pending',
      };

      return {
        goal: `Calculate ${pct}% of ${baseFormatted} and explain the result`,
        steps: [step1, step2],
        metadata: {
          aggregationType: 'calculation_and_explanation',
          pct,
          base: baseNum,
          baseFormatted,
        },
      };
    }

    // 4. Multi-Tool Chain: Data Top N + Average / Sum Calculation
    // e.g. "Find the top 3 products and calculate their average sales."
    // with CSV data in query
    const hasInlineCsv = /\b[A-Za-z0-9_-]+,[A-Za-z0-9_-]+\b[\r\n]+[A-Za-z0-9_-]+,[0-9.]+/i.test(raw);
    const dataChainMatch = query.match(
      /(?:find|get|give\s+me)?\s*(?:the\s+)?top\s+(\d+)\s+(?:items|products|rows|entries)?(?:\s+by\s+([A-Za-z0-9_]+))?\s*(?:and|,)?\s*(?:then\s+)?(?:calculate\s+(?:their|the)\s+average(?:\s+sales)?|find\s+their\s+average|average\s+them)/i
    );

    if (hasInlineCsv && dataChainMatch) {
      const n = parseInt(dataChainMatch[1], 10) || 3;
      const col = dataChainMatch[2] || 'Sales';
      const lines = raw.split(/[\r\n]+/);
      const csvLines = lines.filter((l) => l.includes(','));
      const csvData = csvLines.join('\n');

      const step1: TaskStep = {
        id: 'step_1',
        skillId: 'data_analysis',
        action: 'top_n',
        description: `Find top ${n} entries by ${col}`,
        input: { action: 'top_n', data: csvData, n, column: col },
        dependsOn: [],
        status: 'pending',
      };

      const step2: TaskStep = {
        id: 'step_2',
        skillId: 'data_analysis',
        action: 'average',
        description: `Calculate average ${col} of top ${n}`,
        input: { action: 'average', data: '$PREV_DATA', column: col },
        dependsOn: ['step_1'],
        status: 'pending',
      };

      return {
        goal: `Find top ${n} by ${col} and calculate their average`,
        steps: [step1, step2],
        metadata: {
          aggregationType: 'data_top_n_and_average',
          n,
          column: col,
        },
      };
    }

    // 5. Multi-Step Math Pattern A: Percentage calculation + subtraction / remaining amount
    // e.g. "Calculate 15% of 8500 and subtract it from 8500."
    // e.g. "Calculate 15% of 8500 and then tell me the remaining amount."
    // e.g. "Calculate 15% of 8500, then subtract that from 8500."
    const pctSubMatch = query.match(
      /(?:calculate|compute|find|what\s+is)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:and|,)?\s*(?:then\s+)?(?:tell\s+me\s+the\s+remaining\s+amount|subtract\s+(?:it|that)\s+from\s+(\d+(?:,\d+)*(?:\.\d+)?)|what\s+is\s+(?:the\s+)?remaining\s+amount|leave\s+what)/i
    );

    if (pctSubMatch) {
      const pct = pctSubMatch[1];
      const baseRaw = pctSubMatch[2].replace(/,/g, '');
      const baseNum = parseFloat(baseRaw);
      const baseFormatted = baseNum.toLocaleString('en-US');

      const step1: TaskStep = {
        id: 'step_1',
        skillId: 'calculator',
        action: 'evaluate',
        description: `Calculate ${pct}% of ${baseFormatted}`,
        input: { expression: `${pct}% of ${baseRaw}` },
        dependsOn: [],
        status: 'pending',
      };

      const step2: TaskStep = {
        id: 'step_2',
        skillId: 'calculator',
        action: 'evaluate',
        description: `Subtract calculated ${pct}% from ${baseFormatted}`,
        input: { expression: `${baseRaw} - $PREV` },
        dependsOn: ['step_1'],
        status: 'pending',
      };

      return {
        goal: `Calculate ${pct}% of ${baseFormatted} and determine the remaining balance`,
        steps: [step1, step2],
        metadata: {
          aggregationType: 'percentage_and_subtraction',
          pct,
          base: baseNum,
          baseFormatted,
        },
      };
    }

    // 3. Multi-Step Math Pattern B: Percentage followed by percentage of the result
    // e.g. "Calculate 10% of 10000, then calculate 20% of the result."
    // e.g. "Calculate 10% of 10000 and then 20% of that."
    const pctOfPctMatch = query.match(
      /(?:calculate|compute|find|what\s+is)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:,|and)?\s*(?:then\s+)?(?:calculate|compute|find|what\s+is)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+result|that|it))/i
    );

    if (pctOfPctMatch) {
      const pct1 = pctOfPctMatch[1];
      const baseRaw = pctOfPctMatch[2].replace(/,/g, '');
      const baseNum = parseFloat(baseRaw);
      const baseFormatted = baseNum.toLocaleString('en-US');
      const pct2 = pctOfPctMatch[3];

      const step1: TaskStep = {
        id: 'step_1',
        skillId: 'calculator',
        action: 'evaluate',
        description: `Calculate ${pct1}% of ${baseFormatted}`,
        input: { expression: `${pct1}% of ${baseRaw}` },
        dependsOn: [],
        status: 'pending',
      };

      const step2: TaskStep = {
        id: 'step_2',
        skillId: 'calculator',
        action: 'evaluate',
        description: `Calculate ${pct2}% of the previous result`,
        input: { expression: `${pct2}% of $PREV` },
        dependsOn: ['step_1'],
        status: 'pending',
      };

      return {
        goal: `Calculate ${pct1}% of ${baseFormatted}, then calculate ${pct2}% of that result`,
        steps: [step1, step2],
        metadata: {
          aggregationType: 'percentage_of_percentage',
          pct1,
          pct2,
          base: baseNum,
          baseFormatted,
        },
      };
    }

    // 4. Conversational Contextual Follow-up (e.g., "Now subtract that", "Subtract that from 10000", "Now subtract it")
    if (sessionId && /^(now\s+)?(subtract|minus)\s+(that|it)(\s+from\s+(\d+(?:,\d+)*(?:\.\d+)?))?/i.test(query)) {
      const session = SessionStorage.getSession(sessionId);
      const history = session?.messages || [];

      // Look back for the most recent calculation context
      let foundBase: number | null = null;
      let foundPrevResult: number | null = null;

      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        
        // Check toolCalls in message
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            if (tc.name === 'calculator' && tc.result && typeof tc.result === 'object') {
              const resObj = tc.result as { value?: number };
              if (typeof resObj.value === 'number') {
                foundPrevResult = resObj.value;
                break;
              }
            }
          }
        }

        // Check if message text or user message has base number (e.g., "Calculate 20% of 10000")
        const baseMatch = msg.content.match(/(?:of|\*)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
        if (baseMatch && !foundBase) {
          foundBase = parseFloat(baseMatch[1].replace(/,/g, ''));
        }

        // Or if user provided "subtract that from 10000" directly in query
        const explicitBaseMatch = query.match(/from\s+(\d+(?:,\d+)*(?:\.\d+)?)/i);
        if (explicitBaseMatch) {
          foundBase = parseFloat(explicitBaseMatch[1].replace(/,/g, ''));
        }

        if (foundBase !== null && foundPrevResult !== null) {
          break;
        }
      }

      if (foundBase !== null && foundPrevResult !== null) {
        const step1: TaskStep = {
          id: 'step_1',
          skillId: 'calculator',
          action: 'evaluate',
          description: `Subtract ${foundPrevResult} from ${foundBase}`,
          input: { expression: `${foundBase} - ${foundPrevResult}` },
          dependsOn: [],
          status: 'pending',
        };

        return {
          goal: `Contextual calculation: Subtract ${foundPrevResult} from ${foundBase}`,
          steps: [step1],
          metadata: {
            aggregationType: 'contextual_followup_subtraction',
            baseValue: foundBase,
            baseValueFormatted: foundBase.toLocaleString('en-US'),
            prevValue: foundPrevResult,
            prevValueFormatted: foundPrevResult.toLocaleString('en-US'),
          },
        };
      }
    }

    // 5. Explicit Skill Request Handling (e.g. "Execute skill unknown_drone" or "Run skill format_disk")
    const explicitSkillMatch = query.match(/(?:execute|run|invoke|use)\s+skill\s+([a-z0-9_-]+)/i);
    if (explicitSkillMatch) {
      const requestedSkillId = explicitSkillMatch[1].toLowerCase();
      const step1: TaskStep = {
        id: 'step_1',
        skillId: requestedSkillId,
        action: 'execute',
        description: `Execute requested skill ${requestedSkillId}`,
        input: {},
        dependsOn: [],
        status: 'pending',
      };

      return {
        goal: `Execute requested skill ${requestedSkillId}`,
        steps: [step1],
      };
    }

    // 6. Skill Router Direct Matching
    const routeDecision = SkillRouter.route(raw);
    if (routeDecision && routeDecision.isDirectMatch) {
      const { skill, extractedParams = {}, action, reason } = routeDecision;

      // Extract metadata for percentage query if applicable
      let isPercentageQuery = false;
      let pct: string | undefined;
      let baseFormatted: string | undefined;

      const singlePctMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
      if (singlePctMatch) {
        isPercentageQuery = true;
        pct = singlePctMatch[1];
        const baseNum = parseFloat(singlePctMatch[2].replace(/,/g, ''));
        baseFormatted = baseNum.toLocaleString('en-US');
      }

      const step1: TaskStep = {
        id: 'step_1',
        skillId: skill.id,
        action: action || 'execute',
        description: reason || `Execute ${skill.name}`,
        input: extractedParams,
        dependsOn: [],
        status: 'pending',
      };

      return {
        goal: `Execute single skill: ${skill.name}`,
        steps: [step1],
        metadata: {
          isPercentageQuery,
          pct,
          baseFormatted,
        },
      };
    }

    // 7. General complex queries: Delegate to Agent Loop
    return {
      goal: 'Execute through Gemini Agent Loop with tool declarations and contextual memory',
      steps: [],
      requiresAgentLoop: true,
    };
  }

  /**
   * Validates a TaskPlan for safety, cycle detection, and step limit protection.
   */
  static validatePlan(plan: TaskPlan): { valid: boolean; error?: string } {
    if (!plan || !Array.isArray(plan.steps)) {
      return { valid: false, error: 'Invalid plan structure: steps array is required.' };
    }

    const MAX_STEPS = 5;
    if (plan.steps.length > MAX_STEPS) {
      return {
        valid: false,
        error: `Task plan exceeds the safe limit of ${MAX_STEPS} sequential steps.`,
      };
    }

    // Validate step dependency order and circular dependencies
    const seenIds = new Set<string>();
    for (const step of plan.steps) {
      if (!step.id || !step.skillId) {
        return { valid: false, error: 'Each step must contain a valid id and skillId.' };
      }

      if (seenIds.has(step.id)) {
        return { valid: false, error: `Duplicate step ID detected: ${step.id}` };
      }
      seenIds.add(step.id);

      if (step.dependsOn && Array.isArray(step.dependsOn)) {
        for (const depId of step.dependsOn) {
          if (!seenIds.has(depId)) {
            return {
              valid: false,
              error: `Invalid dependency: Step "${step.id}" depends on unknown or subsequent step "${depId}".`,
            };
          }
        }
      }
    }

    return { valid: true };
  }
}
