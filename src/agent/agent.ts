import { AgentLoop } from './loop';
import { AgentContext, AgentResponse, ApolloState } from './types';
import { SessionStorage, ChatMessage } from '../storage/sessions';
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
   * Primary entry point for executing user commands/queries.
   * Both text and voice routes converge here.
   */
  async processInput(params: {
    sessionId: string;
    text: string;
    isVoice?: boolean;
    onToolActivity?: (toolCall: unknown) => void;
  }): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage; response: AgentResponse }> {
    const { sessionId, text, isVoice = false, onToolActivity } = params;

    // 1. Record user message
    const userMessage = SessionStorage.addMessage(sessionId, {
      role: 'user',
      content: text,
      isVoiceInput: isVoice,
    });

    // 2. Prepare execution context
    const context: AgentContext = {
      sessionId,
      userQuery: text,
      isVoice,
      onStateChange: (st, detail) => this.setState(st, detail),
      onToolActivity: (tc) => onToolActivity?.(tc),
    };

    // 3. Run Agent Loop
    const response = await AgentLoop.run(context);

    // 4. Record assistant message
    const assistantMessage = SessionStorage.addMessage(sessionId, {
      role: 'assistant',
      content: response.text,
      toolCalls: response.toolCalls,
    });

    return {
      userMessage,
      assistantMessage,
      response,
    };
  }
}
