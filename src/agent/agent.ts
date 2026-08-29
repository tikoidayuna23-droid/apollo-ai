import { AgentLoop } from './loop';
import { AgentContext, AgentResponse, ApolloState } from './types';
import { SessionStorage, ChatMessage, ToolCallRecord } from '../storage/sessions';
import { SkillRouter } from '../../skills/router';
import { SkillRegistry } from '../../skills/registry';
import { generateId } from '../utils/helpers';
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
    onToolActivity?: (toolCall: unknown) => void;
  }): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage; response: AgentResponse }> {
    const { sessionId, text, isVoice = false, onToolActivity } = params;
    const startTime = Date.now();

    // 1. Record user message
    const userMessage = SessionStorage.addMessage(sessionId, {
      role: 'user',
      content: text,
      isVoiceInput: isVoice,
    });

    // 2. Skill Router Evaluation (Phase 3)
    // Determines if a specialized skill can handle the request directly
    const routeDecision = SkillRouter.route(text);

    if (routeDecision && routeDecision.isDirectMatch) {
      const { skill, extractedParams = {}, reason } = routeDecision;
      logger.info('ApolloAgent', `Fast direct route to Skill "${skill.name}" (reason: ${reason})`);

      // Check if skill is enabled in Skill Registry
      if (!SkillRegistry.isSkillEnabled(skill.id)) {
        this.setState('THINKING');
        await new Promise((resolve) => setTimeout(resolve, 80));
        this.setState('IDLE');

        const disabledResponse: AgentResponse = {
          text: `I cannot complete that request because the ${skill.name} skill is currently disabled in system settings. Please re-enable it in Settings to perform this action.`,
          toolCalls: [],
          executionTimeMs: Date.now() - startTime,
        };

        const assistantMessage = SessionStorage.addMessage(sessionId, {
          role: 'assistant',
          content: disabledResponse.text,
          toolCalls: [],
        });

        return {
          userMessage,
          assistantMessage,
          response: disabledResponse,
        };
      }

      // Display skill activity status in UI
      const activityText = skill.activityLabel || `Using ${skill.name}...`;
      this.setState('USING_TOOL', activityText);

      const toolRecord: ToolCallRecord = {
        id: generateId(),
        name: skill.id,
        args: extractedParams,
        status: 'pending',
      };
      onToolActivity?.(toolRecord);

      // Execute through Skill Registry
      const execResult = await SkillRegistry.executeSkill(skill.id, extractedParams);
      toolRecord.result = execResult.result;
      toolRecord.status = execResult.error ? 'error' : 'completed';

      this.setState('IDLE');

      let responseText = '';
      if (execResult.error) {
        responseText = `I couldn't complete that task because the ${skill.name} skill encountered an error: ${execResult.error}`;
      } else if (execResult.result && typeof execResult.result === 'object') {
        const resObj = execResult.result as Record<string, unknown>;
        if (typeof resObj.summary === 'string' && resObj.summary) {
          responseText = resObj.summary;
        } else if (skill.id === 'calculator' && resObj.formatted) {
          responseText = `The answer is ${resObj.formatted}.`;
        } else {
          responseText = 'Operation completed.';
        }
      } else {
        responseText = String(execResult.result || 'Operation completed.');
      }

      const directResponse: AgentResponse = {
        text: responseText,
        toolCalls: [toolRecord],
        executionTimeMs: Date.now() - startTime,
        usedMemoriesCount: skill.id === 'memory' ? 1 : 0,
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

    // 3. Prepare execution context for full Gemini Agent Loop
    const context: AgentContext = {
      sessionId,
      userQuery: text,
      isVoice,
      onStateChange: (st, detail) => this.setState(st, detail),
      onToolActivity: (tc) => onToolActivity?.(tc),
    };

    // 4. Run Agent Loop with Gemini, enabled Skills declarations & relevant memory injection
    const response = await AgentLoop.run(context);

    // 5. Record assistant message with memory usage and tool call indicators
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

