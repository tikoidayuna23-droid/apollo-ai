/**
 * Apollo Skills Architecture - Type Definitions (Phase 3)
 */

export type SkillPermission = 'SAFE' | 'READ' | 'WRITE' | 'DESTRUCTIVE' | 'SYSTEM';

export interface SkillPropertySchema {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface SkillParameterSchema {
  type: string;
  properties: Record<string, SkillPropertySchema>;
  required?: string[];
}

export interface SkillExecutionResult {
  result: unknown;
  error?: string;
}

export interface SkillMatchResult {
  matched: boolean;
  confidence: number; // 0.0 to 1.0
  suggestedAction?: string;
  extractedParams?: Record<string, unknown>;
  reason?: string;
}

export interface Skill {
  /** Unique skill identifier (e.g., 'calculator', 'memory', 'time') */
  id: string;

  /** Human-readable skill name */
  name: string;

  /** Comprehensive functional description for router and agent */
  description: string;

  /** Semantic version string */
  version: string;

  /** Whether the skill is active and usable */
  enabled: boolean;

  /** Security and safety permission tier */
  permission: SkillPermission;

  /** List of functional capability tags */
  capabilities: string[];

  /** Parameter definition schema */
  parameters: SkillParameterSchema;

  /** Safe execution handler */
  execute: (params: Record<string, unknown>, context?: unknown) => Promise<SkillExecutionResult>;

  /** Optional natural-language intent matcher for the Skill Router */
  matchesQuery?: (query: string) => SkillMatchResult;

  /** Status message to display in UI during execution (e.g., 'Using Calculator...') */
  activityLabel?: string;
}
