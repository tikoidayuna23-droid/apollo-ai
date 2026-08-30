import { AgentLoop } from './loop';
import { AgentContext, AgentResponse, ApolloState } from './types';
import { SessionStorage, ChatMessage, ToolCallRecord } from '../storage/sessions';
import { TaskPlanner } from './orchestrator/task-planner';
import { TaskOrchestrator } from './orchestrator/orchestrator';
import { logger } from '../utils/logger';

export class ApolloAgent {
  private static instance: ApolloAgent;
  private currentState: ApolloState = 'IDLE';
  private stateListeners: Set<(state: ApolloState, detail?: string) => void> = new Set();

  private constructor() {}

  static getInstance(): ApolloAgent {
    if (!this.instance) {
      this.instance = new ApolloAgent();
    }
    return this.instance;
  }

  getState(): ApolloState {
    return this.currentState;
  }

  setState(state: ApolloState, detail?: string): void {
    this.currentState = state;
    logger.debug('ApolloAgent', `State changed to: ${state}${detail ? ` (${detail})` : ''}`);
    this.stateListeners.forEach((fn) => fn(state, detail));
  }

  onStateChange(listener: (state: ApolloState, detail?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Primary entry point for executing user commands and inquiries.
   * Both text input and voice input converge here.
   */
  async processInput(params: {
    sessionId: string;
    text: string;
    isVoice?: boolean;
    onToolActivity?: (toolCall: ToolCallRecord) => void;
  }): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage; response: AgentResponse }> {
    const { sessionId, text, isVoice = false, onToolActivity } = params;
    const startTime = Date.now();

    // 1. Record user message in active session
    const userMessage = SessionStorage.addMessage(sessionId, {
      role: 'user',
      content: text,
      isVoiceInput: isVoice,
    });

    // 2. Task Planner Layer (Phase 4 Orchestration)
    // Evaluates the user query, context, and multi-skill dependencies
    this.setState('THINKING', 'Planning task...');
    const plan = TaskPlanner.plan(text, sessionId);
    logger.info('ApolloAgent', `Generated Task Plan: "${plan.goal}" (steps: ${plan.steps.length}, requiresAgentLoop: ${Boolean(plan.requiresAgentLoop)})`);

    // 3. If plan can be orchestrated directly via registered Skills or direct response
    if (!plan.requiresAgentLoop) {
      const execResult = await TaskOrchestrator.execute(plan, {
        onStateChange: (st, detail) => this.setState(st, detail),
        onToolActivity: (tc) => onToolActivity?.(tc),
      });

      this.setState('IDLE');

      const directResponse: AgentResponse = {
        text: execResult.finalText,
        toolCalls: execResult.toolCalls,
        executionTimeMs: Date.now() - startTime,
        usedMemoriesCount: execResult.usedMemoriesCount || 0,
        error: execResult.error,
      };

      const assistantMessage = SessionStorage.addMessage(sessionId, {
        role: 'assistant',
        content: directResponse.text,
        toolCalls: directResponse.toolCalls,
        usedMemoriesCount: directResponse.usedMemoriesCount,
      });

      return {
        userMessage,
        assistantMessage,
        response: directResponse,
      };
    }

    // 4. Fallback to full Gemini Agent Loop for open-ended queries or complex reasoning
    const context: AgentContext = {
      sessionId,
      userQuery: text,
      isVoice,
      onStateChange: (st, detail) => this.setState(st, detail),
      onToolActivity: (tc) => onToolActivity?.(tc),
    };

    const response = await AgentLoop.run(context);

    const assistantMessage = SessionStorage.addMessage(sessionId, {
      role: 'assistant',
      content: response.text,
      toolCalls: response.toolCalls,
      usedMemoriesCount: response.usedMemoriesCount,
      usedMemories: response.usedMemories,
    });

    return {
      userMessage,
      assistantMessage,
      response,
    };
  }
}


