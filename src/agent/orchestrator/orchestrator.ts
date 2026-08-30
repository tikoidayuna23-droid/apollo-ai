import { TaskPlan, TaskStep, TaskExecutionResult } from './types';
import { TaskPlanner } from './task-planner';
import { ResultAggregator } from './aggregator';
import { SkillRegistry } from '../../../skills/registry';
import { ToolCallRecord } from '../../storage/sessions';
import { ApolloState } from '../types';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

export interface OrchestratorCallbacks {
  onStateChange?: (state: ApolloState, detail?: string) => void;
  onToolActivity?: (toolCall: ToolCallRecord) => void;
}

export class TaskOrchestrator {
  /**
   * Coordinates and executes a TaskPlan through the Skills Architecture.
   */
  static async execute(
    plan: TaskPlan,
    callbacks?: OrchestratorCallbacks
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const toolCalls: ToolCallRecord[] = [];
    const stepResults = new Map<string, unknown>();

    // 1. Direct answer without skills
    if (plan.isDirectAnswer && plan.directAnswerText) {
      callbacks?.onStateChange?.('THINKING');
      await new Promise((resolve) => setTimeout(resolve, 60));
      callbacks?.onStateChange?.('IDLE');

      return {
        plan,
        stepResults,
        toolCalls: [],
        finalText: plan.directAnswerText,
        success: true,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Validate plan structure and limits
    const validation = TaskPlanner.validatePlan(plan);
    if (!validation.valid) {
      callbacks?.onStateChange?.('ERROR', validation.error);
      return {
        plan,
        stepResults,
        toolCalls: [],
        finalText: `Task planning error: ${validation.error}`,
        success: false,
        error: validation.error,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 3. Sequential Step Execution
    let prevStepResult: unknown = null;
    let usedMemoriesCount = 0;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      step.status = 'running';

      // 3.1 Validate skill existence
      const skill = SkillRegistry.getSkill(step.skillId);
      if (!skill) {
        logger.warn('TaskOrchestrator', `Unknown skill requested: "${step.skillId}"`);
        callbacks?.onStateChange?.('ERROR', `Unknown skill: ${step.skillId}`);
        step.status = 'failed';
        step.error = `Skill "${step.skillId}" is not registered.`;

        return {
          plan,
          stepResults,
          toolCalls,
          finalText: `I cannot complete that request because the skill "${step.skillId}" is not registered in the system.`,
          success: false,
          error: step.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 3.2 Validate skill enabled state
      if (!SkillRegistry.isSkillEnabled(step.skillId)) {
        logger.warn('TaskOrchestrator', `Skill "${skill.name}" is disabled in settings.`);
        callbacks?.onStateChange?.('IDLE');
        step.status = 'failed';
        step.error = `Skill "${skill.name}" is disabled.`;

        return {
          plan,
          stepResults,
          toolCalls,
          finalText: `I cannot complete that request because the ${skill.name} skill is currently disabled in system settings. Please re-enable it in Settings to perform this action.`,
          success: false,
          error: step.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 3.3 Validate permissions (Phase 3 & Phase 4 safety)
      if (skill.permission === 'DESTRUCTIVE' || skill.permission === 'SYSTEM') {
        logger.warn('TaskOrchestrator', `Blocked execution for restricted permission tier: ${skill.permission}`);
        callbacks?.onStateChange?.('ERROR', 'Permission Denied');
        step.status = 'failed';
        step.error = `Execution denied: elevated security clearance required (${skill.permission}).`;

        return {
          plan,
          stepResults,
          toolCalls,
          finalText: `Execution denied: Skill "${skill.name}" requires elevated security clearance (${skill.permission}).`,
          success: false,
          error: step.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 3.4 Resolve input dependencies (passing result of earlier step to current step)
      const resolvedInput = this.resolveStepInput(step.input, prevStepResult, stepResults);

      // 3.5 Update status and tool activity
      const activityLabel = skill.activityLabel || `Running ${skill.name}...`;
      callbacks?.onStateChange?.('USING_TOOL', activityLabel);

      const toolRecord: ToolCallRecord = {
        id: generateId(),
        name: skill.id,
        args: resolvedInput,
        status: 'pending',
      };
      callbacks?.onToolActivity?.(toolRecord);

      // 3.6 Execute skill
      logger.info('TaskOrchestrator', `Executing Step ${i + 1}/${plan.steps.length}: Skill "${skill.name}"`, resolvedInput);
      const executionResult = await SkillRegistry.executeSkill(step.skillId, resolvedInput);

      toolRecord.result = executionResult.result;
      toolRecord.status = executionResult.error ? 'error' : 'completed';
      toolCalls.push(toolRecord);

      if (executionResult.error) {
        logger.warn('TaskOrchestrator', `Step ${step.id} failed:`, executionResult.error);
        step.status = 'failed';
        step.error = executionResult.error;
        callbacks?.onStateChange?.('ERROR', executionResult.error);

        return {
          plan,
          stepResults,
          toolCalls,
          finalText: `I couldn't complete that task because the ${skill.name} skill encountered an error: ${executionResult.error}`,
          success: false,
          error: executionResult.error,
          executionTimeMs: Date.now() - startTime,
        };
      }

      step.status = 'completed';
      step.result = executionResult.result;
      prevStepResult = executionResult.result;
      stepResults.set(step.id, executionResult.result);

      if (step.skillId === 'memory') {
        usedMemoriesCount++;
      }
    }

    // 4. Result Aggregation
    if (plan.steps.length > 1) {
      callbacks?.onStateChange?.('THINKING', 'Combining results...');
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    callbacks?.onStateChange?.('IDLE');

    const finalText = ResultAggregator.aggregate(plan, stepResults);

    return {
      plan,
      stepResults,
      toolCalls,
      finalText,
      success: true,
      executionTimeMs: Date.now() - startTime,
      usedMemoriesCount,
    };
  }

  /**
   * Safely replaces placeholders ($PREV, $STEP_ID.val) in input with structured results of previous steps.
   */
  private static resolveStepInput(
    rawInput: Record<string, unknown>,
    prevResult: unknown,
    allResults: Map<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    let prevValue = '';
    if (prevResult && typeof prevResult === 'object') {
      const resObj = prevResult as Record<string, unknown>;
      if (resObj.value !== undefined) {
        prevValue = String(resObj.value);
      } else if (resObj.formatted !== undefined) {
        prevValue = String(resObj.formatted).replace(/,/g, '');
      } else {
        prevValue = JSON.stringify(resObj);
      }
    } else if (prevResult !== null && prevResult !== undefined) {
      prevValue = String(prevResult);
    }

    for (const [key, value] of Object.entries(rawInput)) {
      if (typeof value === 'string') {
        let strVal = value.replace(/\$PREV_FORMATTED/g, prevValue).replace(/\$PREV/g, prevValue);

        // Replace any $step_1.value or $step_1 syntax
        allResults.forEach((res, stepId) => {
          let stepVal = '';
          if (res && typeof res === 'object') {
            const obj = res as Record<string, unknown>;
            stepVal = obj.value !== undefined ? String(obj.value) : String(obj.formatted || '');
          } else {
            stepVal = String(res || '');
          }
          strVal = strVal.replace(new RegExp(`\\$${stepId}\\.value`, 'g'), stepVal);
          strVal = strVal.replace(new RegExp(`\\$${stepId}`, 'g'), stepVal);
        });

        resolved[key] = strVal;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }
}
