import { ToolDefinition, calculatorTool } from './calculator';
import {
  saveMemoryTool,
  searchMemoryTool,
  deleteMemoryTool,
  getUserProfileTool,
  updateUserProfileTool,
} from './memory';
import { timeTool } from './time';
import { SkillRegistry } from '../../skills/registry';
import { logger } from '../utils/logger';

// Map tools to their corresponding Skill ID
const TOOL_TO_SKILL_MAP: Record<string, string> = {
  calculator: 'calculator',
  time: 'time',
  save_memory: 'memory',
  search_memory: 'memory',
  delete_memory: 'memory',
  get_user_profile: 'memory',
  update_user_profile: 'memory',
};

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static {
    // Register Phase 1, 2, and 3 tools
    this.registerTool(calculatorTool);
    this.registerTool(timeTool);
    this.registerTool(saveMemoryTool);
    this.registerTool(searchMemoryTool);
    this.registerTool(deleteMemoryTool);
    this.registerTool(getUserProfileTool);
    this.registerTool(updateUserProfileTool);
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

  /**
   * Returns only tool declarations whose parent Skill is currently enabled in SkillRegistry.
   */
  static getToolDeclarations(): Array<{
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  }> {
    return this.getAllTools()
      .filter((t) => {
        const skillId = TOOL_TO_SKILL_MAP[t.name];
        if (skillId) {
          return SkillRegistry.isSkillEnabled(skillId);
        }
        return true;
      })
      .map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
  }

  /**
   * Get dynamic UI activity label for a tool (e.g., "Using Calculator...")
   */
  static getActivityLabel(toolName: string): string {
    const skillId = TOOL_TO_SKILL_MAP[toolName];
    if (skillId) {
      const skill = SkillRegistry.getSkill(skillId);
      if (skill?.activityLabel) {
        return skill.activityLabel;
      }
    }
    const clean = toolName.replace(/_/g, ' ');
    return `Using ${clean.charAt(0).toUpperCase() + clean.slice(1)}...`;
  }

  static async executeTool(name: string, args: Record<string, unknown>): Promise<{ result: unknown; error?: string }> {
    const tool = this.getTool(name);
    if (!tool) {
      logger.warn('ToolRegistry', `Tool "${name}" not found.`);
      return { result: null, error: `Tool "${name}" is not registered.` };
    }

    // Check if the tool's skill is enabled
    const skillId = TOOL_TO_SKILL_MAP[name];
    if (skillId && !SkillRegistry.isSkillEnabled(skillId)) {
      const skill = SkillRegistry.getSkill(skillId);
      const skillName = skill?.name || skillId;
      logger.warn('ToolRegistry', `Skill "${skillName}" is disabled.`);
      return {
        result: null,
        error: `The ${skillName} skill is currently disabled in system settings.`,
      };
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

