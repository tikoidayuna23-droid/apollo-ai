import { Skill, SkillCategory, SkillExecutionResult } from './types';
import { CalculatorSkill } from './calculator';
import { TextIntelligenceSkill } from './text';
import { DataAnalysisSkill } from './data';
import { FileIntelligenceSkill } from './file';
import { MemorySkill } from './memory';
import { TimeSkill } from './time';
import { db } from '../src/storage/database';
import { logger } from '../src/utils/logger';

const SKILLS_CONFIG_KEY = 'skills_enabled_states';

export class SkillRegistry {
  private static skills: Map<string, Skill> = new Map();
  private static enabledStates: Record<string, boolean> = {};
  private static initialized = false;

  static {
    this.init();
  }

  private static init(): void {
    if (this.initialized) return;

    // Load persisted enabled/disabled preferences
    try {
      this.enabledStates = db.getItem<Record<string, boolean>>(SKILLS_CONFIG_KEY, {});
    } catch {
      this.enabledStates = {};
    }

    // Register Phase 3 - 5 Core Built-in Tools & Skills
    this.registerSkill(CalculatorSkill);
    this.registerSkill(TextIntelligenceSkill);
    this.registerSkill(DataAnalysisSkill);
    this.registerSkill(FileIntelligenceSkill);
    this.registerSkill(MemorySkill);
    this.registerSkill(TimeSkill);

    this.initialized = true;
    logger.info('SkillRegistry', `Initialized with ${this.skills.size} registered skills.`);
  }

  /**
   * Register a new Skill into the central registry.
   */
  static registerSkill(skill: Skill): void {
    // Apply saved enable/disable preference if present, otherwise default to skill's initial setting
    const savedState = this.enabledStates[skill.id];
    const isEnabled = savedState !== undefined ? savedState : (skill.enabled ?? true);

    const registeredSkill: Skill = {
      ...skill,
      enabled: isEnabled,
    };

    this.skills.set(skill.id, registeredSkill);
    logger.info('SkillRegistry', `Registered skill "${skill.name}" [${skill.id}] (v${skill.version}, category=${skill.category}, enabled=${isEnabled})`);
  }

  /**
   * Unregister an existing skill by ID.
   */
  static unregisterSkill(skillId: string): boolean {
    const exists = this.skills.has(skillId);
    if (exists) {
      this.skills.delete(skillId);
      logger.info('SkillRegistry', `Unregistered skill: ${skillId}`);
      return true;
    }
    return false;
  }

  /**
   * Get a skill by ID.
   */
  static getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Retrieve all registered skills.
   */
  static getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Retrieve skills filtered by capability category.
   */
  static getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getSkills().filter((s) => s.category === category);
  }

  /**
   * Retrieve all distinct categories currently present in registered skills.
   */
  static getCategories(): SkillCategory[] {
    const set = new Set<SkillCategory>();
    for (const skill of this.skills.values()) {
      if (skill.category) {
        set.add(skill.category);
      }
    }
    return Array.from(set);
  }

  /**
   * Check if a skill exists in the registry.
   */
  static hasSkill(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * Enable a skill by ID.
   */
  static enableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.enabled = true;
    this.enabledStates[skillId] = true;
    db.setItem(SKILLS_CONFIG_KEY, this.enabledStates);
    logger.info('SkillRegistry', `Skill "${skill.name}" enabled.`);
    return true;
  }

  /**
   * Disable a skill by ID.
   */
  static disableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.enabled = false;
    this.enabledStates[skillId] = false;
    db.setItem(SKILLS_CONFIG_KEY, this.enabledStates);
    logger.info('SkillRegistry', `Skill "${skill.name}" disabled.`);
    return true;
  }

  /**
   * Check if a specific skill is active and enabled.
   */
  static isSkillEnabled(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    return skill ? Boolean(skill.enabled) : false;
  }

  /**
   * Retrieve only active/enabled skills.
   */
  static getEnabledSkills(): Skill[] {
    return this.getSkills().filter((s) => s.enabled);
  }

  /**
   * Execute a skill safely through permission, validation, and error guards.
   */
  static async executeSkill(
    skillId: string,
    params: Record<string, unknown> = {},
    context?: unknown
  ): Promise<SkillExecutionResult> {
    const skill = this.getSkill(skillId);

    // 1. Verify existence
    if (!skill) {
      logger.warn('SkillRegistry', `Skill "${skillId}" not found.`);
      return {
        result: null,
        error: `Skill "${skillId}" is not registered in the system.`,
      };
    }

    // 2. Verify enabled state
    if (!skill.enabled) {
      logger.warn('SkillRegistry', `Skill "${skill.name}" is disabled.`);
      return {
        result: null,
        error: `The ${skill.name} skill is currently disabled in system settings.`,
      };
    }

    // 3. Verify permissions tier (Phase 3 safeguards against unpermitted actions)
    if (skill.permission === 'DESTRUCTIVE' || skill.permission === 'SYSTEM') {
      logger.warn('SkillRegistry', `Blocked execution for restricted permission tier: ${skill.permission}`);
      return {
        result: null,
        error: `Execution denied: Skill "${skill.name}" requires elevated security clearance (${skill.permission}).`,
      };
    }

    // 4. Validate required parameters
    if (skill.parameters?.required && Array.isArray(skill.parameters.required)) {
      for (const reqParam of skill.parameters.required) {
        if (params[reqParam] === undefined || params[reqParam] === null || params[reqParam] === '') {
          return {
            result: null,
            error: `Missing required parameter "${reqParam}" for skill "${skill.name}".`,
          };
        }
      }
    }

    // 5. Safe execution with complete exception interception
    try {
      logger.info('SkillRegistry', `Executing skill "${skill.name}" [${skill.id}] with parameters:`, params);
      const executionResult = await skill.execute(params, context);
      return executionResult;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected skill error occurred';
      logger.error('SkillRegistry', `Skill "${skill.name}" failed:`, err);
      return {
        result: null,
        error: `I couldn't complete that task because the ${skill.name} skill encountered an error: ${errorMsg}`,
      };
    }
  }
}
