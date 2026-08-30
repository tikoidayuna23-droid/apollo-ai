import { TaskPlan, TaskStep } from './types';
import { logger } from '../../utils/logger';

export class ResultAggregator {
  /**
   * Aggregates the results of all executed task steps into a final natural-language response.
   */
  static aggregate(plan: TaskPlan, stepResults: Map<string, unknown>): string {
    const steps = plan.steps;

    if (steps.length === 0) {
      if (plan.directAnswerText) {
        return plan.directAnswerText;
      }
      return 'Operation completed.';
    }

    // Check if plan has custom aggregation metadata
    const aggType = plan.metadata?.aggregationType as string | undefined;

    // Pattern 1: Percentage followed by remaining balance / subtraction
    if (aggType === 'percentage_and_subtraction' && steps.length === 2) {
      const res1 = stepResults.get(steps[0].id) as { value?: number; formatted?: string } | undefined;
      const res2 = stepResults.get(steps[1].id) as { value?: number; formatted?: string } | undefined;
      const baseFormatted = plan.metadata?.baseFormatted || String(plan.metadata?.base || '');
      const pctFormatted = plan.metadata?.pct || '';

      if (res1 && res2 && res1.formatted && res2.formatted) {
        return `${pctFormatted}% of ${baseFormatted} is ${res1.formatted}, leaving ${res2.formatted}.`;
      }
    }

    // Pattern 2: Percentage followed by percentage of the result
    if (aggType === 'percentage_of_percentage' && steps.length === 2) {
      const res1 = stepResults.get(steps[0].id) as { value?: number; formatted?: string } | undefined;
      const res2 = stepResults.get(steps[1].id) as { value?: number; formatted?: string } | undefined;
      const baseFormatted = plan.metadata?.baseFormatted || String(plan.metadata?.base || '');
      const pct1 = plan.metadata?.pct1 || '';
      const pct2 = plan.metadata?.pct2 || '';

      if (res1 && res2 && res1.formatted && res2.formatted) {
        return `${pct1}% of ${baseFormatted} is ${res1.formatted}, and ${pct2}% of that result is ${res2.formatted}.`;
      }
    }

    // Pattern 3: Follow-up contextual calculation (e.g. "Now subtract that")
    if (aggType === 'contextual_followup_subtraction') {
      const res = stepResults.get(steps[0].id) as { value?: number; formatted?: string } | undefined;
      const prevVal = plan.metadata?.prevValueFormatted || String(plan.metadata?.prevValue || '');
      const baseVal = plan.metadata?.baseValueFormatted || String(plan.metadata?.baseValue || '');

      if (res && res.formatted) {
        return `Subtracting ${prevVal} from ${baseVal} gives ${res.formatted}.`;
      }
    }

    // Pattern 4: Calculation + Text Explanation / Summary
    if (aggType === 'calculation_and_explanation' && steps.length === 2) {
      const res1 = stepResults.get(steps[0].id) as { value?: number; formatted?: string } | undefined;
      const res2 = stepResults.get(steps[1].id) as { output?: string; summary?: string } | undefined;
      const baseFormatted = plan.metadata?.baseFormatted || String(plan.metadata?.base || '');
      const pctFormatted = plan.metadata?.pct || '';

      if (res1 && res1.formatted) {
        const explanation = res2?.output || res2?.summary || `This represents ${pctFormatted}% of the total base amount (${baseFormatted}).`;
        return `${pctFormatted}% of ${baseFormatted} is ${res1.formatted}.\n\nExplanation: ${explanation}`;
      }
    }

    // Pattern 5: Data Top N + Average calculation
    if (aggType === 'data_top_n_and_average' && steps.length === 2) {
      const res1 = stepResults.get(steps[0].id) as { summary?: string } | undefined;
      const res2 = stepResults.get(steps[1].id) as { formatted?: string; summary?: string } | undefined;
      const col = (plan.metadata?.column as string) || 'Sales';
      const n = plan.metadata?.n || 3;

      if (res1 && res2) {
        const topSummary = res1.summary || `Top ${n} items by ${col}`;
        const avgSummary = res2.summary || `The average ${col} of these top ${n} items is ${res2.formatted}.`;
        return `${topSummary}\n\nAverage: ${avgSummary}`;
      }
    }

    // Single step handling
    if (steps.length === 1) {
      const singleStep = steps[0];
      const singleRes = stepResults.get(singleStep.id);

      if (singleRes && typeof singleRes === 'object') {
        const resObj = singleRes as Record<string, unknown>;

        // Custom summary from skill (e.g. Memory, Time)
        if (typeof resObj.summary === 'string' && resObj.summary) {
          return resObj.summary;
        }

        // Calculator skill single step
        if (singleStep.skillId === 'calculator' && resObj.formatted) {
          if (plan.metadata?.isPercentageQuery && plan.metadata?.pct && plan.metadata?.baseFormatted) {
            return `${plan.metadata.pct}% of ${plan.metadata.baseFormatted} is ${resObj.formatted}.`;
          }
          return `The result is ${resObj.formatted}.`;
        }
      }

      return String(singleRes || 'Task completed successfully.');
    }

    // Generic multi-step aggregation: combine individual step summaries
    const summaries: string[] = [];
    for (const step of steps) {
      const res = stepResults.get(step.id);
      if (res && typeof res === 'object') {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.summary === 'string' && resObj.summary) {
          summaries.push(resObj.summary);
        } else if (resObj.formatted) {
          summaries.push(`${step.description || step.skillId}: ${resObj.formatted}`);
        }
      }
    }

    if (summaries.length > 0) {
      return summaries.join('\n');
    }

    return 'All sequential tasks completed successfully.';
  }
}
