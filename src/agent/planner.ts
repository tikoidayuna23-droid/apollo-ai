import { ModelMessage } from '../ai/types';
import { SessionStorage, ChatMessage } from '../storage/sessions';
import { ToolRegistry } from '../tools/registry';
import { buildApolloSystemPrompt } from './prompt';

export class AgentPlanner {
  /**
   * Constructs the model message history including system prompt and tool declarations.
   */
  static prepareContext(sessionId: string, currentQuery: string): {
    messages: ModelMessage[];
    systemInstruction: string;
    tools: ReturnType<typeof ToolRegistry.getToolDeclarations>;
  } {
    const session = SessionStorage.getSession(sessionId);
    const history = session ? session.messages : [];
    
    // Take the last 12 messages for conversation context to keep prompt compact and fast
    const recentMessages = history.slice(-12);

    const modelMessages: ModelMessage[] = recentMessages.map((m: ChatMessage) => {
      return {
        role: m.role,
        content: m.content || '',
      };
    });

    // Ensure the current query is the last user message if not already added
    if (modelMessages.length === 0 || modelMessages[modelMessages.length - 1].content !== currentQuery) {
      modelMessages.push({
        role: 'user',
        content: currentQuery,
      });
    }

    const systemInstruction = buildApolloSystemPrompt();
    const tools = ToolRegistry.getToolDeclarations();

    return {
      messages: modelMessages,
      systemInstruction,
      tools,
    };
  }
}
