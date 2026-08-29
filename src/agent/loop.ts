import { ProviderManager } from '../ai/provider';
import { ModelMessage } from '../ai/types';
import { ToolRegistry } from '../tools/registry';
import { ToolCallRecord } from '../storage/sessions';
import { AgentContext, AgentResponse } from './types';
import { AgentPlanner } from './planner';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const MAX_TOOL_ITERATIONS = 5;

export class AgentLoop {
  static async run(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const recordedToolCalls: ToolCallRecord[] = [];
    const provider = ProviderManager.getProvider();

    // Check provider availability
    const avail = await provider.isAvailable();
    if (!avail.available) {
      context.onStateChange?.('ERROR', avail.error || 'Gemini is not configured.');
      return {
        text: 'Gemini is not configured.',
        toolCalls: [],
        executionTimeMs: Date.now() - startTime,
        error: avail.error || 'Gemini is not configured.',
      };
    }

    context.onStateChange?.('THINKING');

    const {
      messages: initialMessages,
      systemInstruction,
      tools,
      usedMemories,
      usedMemoriesCount,
    } = AgentPlanner.prepareContext(
      context.sessionId,
      context.userQuery
    );

    const workingMessages: ModelMessage[] = [...initialMessages];
    let iteration = 0;
    let finalText = '';

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;
        logger.info('AgentLoop', `Starting iteration ${iteration}`);

        const response = await provider.generate(workingMessages, {
          systemInstruction,
          tools,
          temperature: 0.2, // low temperature for precise, predictable assistant responses
        });

        // Check if model requested any tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Push single assistant message representing this model turn, with raw candidate parts preserved
          workingMessages.push({
            role: 'assistant',
            content: response.text || '',
            toolCalls: response.toolCalls,
            rawParts: response.rawParts,
          });

          for (const call of response.toolCalls) {
            const toolRecord: ToolCallRecord = {
              id: call.id || generateId(),
              name: call.name,
              args: call.args,
              status: 'pending',
            };

            const toolLabel = ToolRegistry.getActivityLabel(call.name);
            context.onStateChange?.('USING_TOOL', toolLabel);
            context.onToolActivity?.(toolRecord);

            // Execute the tool
            const executionResult = await ToolRegistry.executeTool(call.name, call.args);
            
            toolRecord.result = executionResult.result;
            toolRecord.status = executionResult.error ? 'error' : 'completed';
            recordedToolCalls.push(toolRecord);

            // Push corresponding tool result message
            workingMessages.push({
              role: 'tool',
              content: JSON.stringify(executionResult.error ? { error: executionResult.error } : executionResult.result),
              toolResult: {
                name: call.name,
                result: executionResult.result,
                error: executionResult.error,
              },
            });
          }
          // Continue loop to allow the model to interpret tool results and formulate answer
          context.onStateChange?.('THINKING');
          continue;
        }

        // No more tool calls; we have the final answer
        finalText = response.text || '';
        break;
      }

      if (!finalText && recordedToolCalls.length > 0) {
        finalText = 'Operation completed.';
      }

      return {
        text: finalText.trim(),
        toolCalls: recordedToolCalls,
        executionTimeMs: Date.now() - startTime,
        usedMemoriesCount,
        usedMemories: usedMemories.map((m) => ({ id: m.id, content: m.content, category: m.category })),
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred during processing.';
      logger.error('AgentLoop', 'Agent execution failed:', err);
      context.onStateChange?.('ERROR', errMsg);
      return {
        text: `Error: ${errMsg}`,
        toolCalls: recordedToolCalls,
        executionTimeMs: Date.now() - startTime,
        error: errMsg,
      };
    }
  }
}
