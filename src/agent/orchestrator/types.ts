import { ToolCallRecord } from '../../storage/sessions';

export interface TaskStep {
  id: string;
  skillId: string;
  action?: string;
  description?: string;
  input: Record<string, unknown>;
  dependsOn?: string[];
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

export interface TaskPlan {
  goal: string;
  steps: TaskStep[];
  isDirectAnswer?: boolean;
  directAnswerText?: string;
  requiresAgentLoop?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionResult {
  plan: TaskPlan;
  stepResults: Map<string, unknown>;
  toolCalls: ToolCallRecord[];
  finalText: string;
  success: boolean;
  error?: string;
  executionTimeMs: number;
  usedMemoriesCount?: number;
}
