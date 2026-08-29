import { ToolCallRecord } from '../storage/sessions';

export type ApolloState = 'IDLE' | 'LISTENING' | 'THINKING' | 'USING_TOOL' | 'SPEAKING' | 'ERROR';

export interface AgentContext {
  sessionId: string;
  userQuery: string;
  isVoice: boolean;
  onStateChange?: (state: ApolloState, detail?: string) => void;
  onToolActivity?: (toolCall: ToolCallRecord) => void;
}

export interface AgentResponse {
  text: string;
  toolCalls: ToolCallRecord[];
  executionTimeMs: number;
  error?: string;
  usedMemoriesCount?: number;
  usedMemories?: Array<{ id: string; content: string; category: string }>;
}
