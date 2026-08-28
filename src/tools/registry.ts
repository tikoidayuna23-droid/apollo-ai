import { ToolDefinition, calculatorTool } from './calculator';
import { saveMemoryTool, searchMemoryTool } from './memory';
import { logger } from '../utils/logger';

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static {
    // Register Phase 1 core tools
    this.registerTool(calculatorTool);
    this.registerTool(saveMemoryTool);
    this.registerTool(searchMemoryTool);
  }

  static registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.debug('ToolRegistry', `Registered tool: ${tool.name}`);
  }

  static getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  static getToolDeclarations(): Array<{
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  }> {
    return this.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  static async executeTool(name: string, args: Record<string, unknown>): Promise<{ result: unknown; error?: string }> {
    const tool = this.getTool(name);
    if (!tool) {
      logger.warn('ToolRegistry', `Tool "${name}" not found.`);
      return { result: null, error: `Tool "${name}" is not registered.` };
    }

    try {
      logger.info('ToolRegistry', `Executing tool "${name}" with args:`, args);
      const res = await tool.execute(args);
      return res;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown tool execution error';
      logger.error('ToolRegistry', `Tool "${name}" failed:`, err);
      return { result: null, error: errorMsg };
    }
  }
}
