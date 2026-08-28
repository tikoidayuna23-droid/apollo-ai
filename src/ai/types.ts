export interface FunctionCallRequest {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: FunctionCallRequest[];
  rawParts?: unknown[];
  toolResult?: {
    name: string;
    result: unknown;
    error?: string;
  };
}

export interface ModelGenerateOptions {
  systemInstruction?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  }>;
  temperature?: number;
}

export interface ModelGenerateResponse {
  text?: string;
  toolCalls?: FunctionCallRequest[];
  rawParts?: unknown[];
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface ModelProvider {
  name: string;
  isAvailable(): Promise<{ available: boolean; error?: string }>;
  generate(messages: ModelMessage[], options?: ModelGenerateOptions): Promise<ModelGenerateResponse>;
}
