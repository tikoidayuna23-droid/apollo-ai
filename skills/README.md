# Apollo Skills Architecture (Phase 3)

Apollo's Skills Architecture provides a modular, safe, and extensible framework that enables Apollo to determine intents, route specialized tasks to dedicated skill handlers, enforce permission safeguards, and seamlessly feed execution results back into active conversation context.

---

## 1. Architectural Overview

```
                          User (Voice or Text)
                                   │
                                   ▼
                             Apollo Agent
                                   │
                                   ▼
                             Skill Router
                                   │
                         (Intent & Capability Match)
                                   │
                                   ▼
                            Skill Registry 
                     (Verification & Permission Check)
                                   │
                                   ▼
                             Selected Skill
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
             Calculator      Neural Memory    Time & Chrono
                  │                │                │
                  └────────────────┼────────────────┘
                                   │
                                   ▼
                         Safe Execution Output
                                   │
                                   ▼
                             Apollo Agent
                                   │
                                   ▼
                         Final Voice & Text Turn
```

---

## 2. Core Skill Interface

Every Apollo skill conforms to the standard `Skill` interface in `skills/types.ts`:

```typescript
export type SkillPermission = 'SAFE' | 'READ' | 'WRITE' | 'DESTRUCTIVE' | 'SYSTEM';

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  permission: SkillPermission;
  capabilities: string[];
  parameters: SkillParameterSchema;
  activityLabel?: string;
  execute: (params: Record<string, unknown>, context?: unknown) => Promise<SkillExecutionResult>;
  matchesQuery?: (query: string) => SkillMatchResult;
}
```

---

## 3. Skill Registry (`skills/registry.ts`)

The central **Skill Registry** manages skill lifecycle, state persistence, and safe execution:

- **`registerSkill(skill: Skill)`**: Enrolls a skill and binds saved enable/disable preferences.
- **`unregisterSkill(skillId: string)`**: Safely removes a skill.
- **`getSkill(skillId: string)`**: Looks up a skill by identifier.
- **`getSkills()` / `getEnabledSkills()`**: Lists registered / active skills.
- **`enableSkill(skillId: string)` / `disableSkill(skillId: string)`**: Toggles activation with persistence in Apollo local storage.
- **`executeSkill(skillId: string, params: Record<string, unknown>, context?: unknown)`**:
  1. Validates existence in registry.
  2. Enforces enabled state.
  3. Verifies permission tier (blocks unauthenticated elevated permissions).
  4. Validates required parameter schema.
  5. Catches and formats runtime exceptions gracefully.

---

## 4. Skill Router (`skills/router.ts`)

The **Skill Router** determines which registered skill is appropriate for an incoming voice or text query:

- Evaluates high-confidence intent matches via `skill.matchesQuery(query)`.
- Scans skill capability tags as fallback.
- Does not execute skills directly; it returns the selected candidate to the Apollo Agent.

---

## 5. Permission Tiers

Apollo enforces strict permission levels for safety and control:

| Level | Description | Phase 3 Assignment |
| :--- | :--- | :--- |
| **`SAFE`** | Pure computations, readouts, formatters with no persistent side-effects | `Calculator`, `Time & Chrono` |
| **`READ`** | Queries and searches private user state, memories, or profile data | `Memory (search, get_profile)` |
| **`WRITE`** | Stores, modifies, or deletes persistent memory records | `Memory (save, delete, update)` |
| **`DESTRUCTIVE`**| Irreversible data mutations (reserved for future phases) | None (Blocked in Phase 3) |
| **`SYSTEM`** | Native OS or host device manipulation (reserved for future phases) | None (Blocked in Phase 3) |

---

## 6. Built-in Phase 3 Skills

### 1. Calculator Skill (`skills/calculator/index.ts`)
- **ID**: `calculator`
- **Permission**: `SAFE`
- **Capabilities**: Arithmetic, algebra, square roots, trigonometry, percentages, exponents.
- **Safety**: Safe custom mathematical parser without unrestricted `eval()` or `Function()`.

### 2. Neural Memory Skill (`skills/memory/index.ts`)
- **ID**: `memory`
- **Permission**: `WRITE` / `READ`
- **Capabilities**: Store facts, user preferences, projects, goals, identity profile, natural voice memory commands (`"Remember that..."`, `"What do you remember about..."`, `"Forget that..."`).
- **Engine**: Bridges directly into the Phase 2 Local Memory Engine.

### 3. Time & Chrono Skill (`skills/time/index.ts`)
- **ID**: `time`
- **Permission**: `SAFE`
- **Capabilities**: Device local clock time, calendar dates, day of week, timezone, ISO timestamps.
- **Safety**: Zero external API dependencies; reads user environment safely.

---

## 7. How to Add a New Skill (Developer Guide)

Adding a new skill to Apollo takes just 3 steps:

### Step 1: Create the Skill Definition
Create a directory `skills/weather/index.ts` (example):

```typescript
import { Skill, SkillExecutionResult } from '../types';

export const WeatherSkill: Skill = {
  id: 'weather',
  name: 'Weather Forecast',
  description: 'Provides meteorological and temperature forecasts for cities.',
  version: '1.0.0',
  enabled: true,
  permission: 'SAFE',
  capabilities: ['weather_forecast', 'temperature', 'humidity'],
  activityLabel: 'Checking Weather...',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City or location to check weather for.',
      },
    },
    required: ['location'],
  },
  matchesQuery(query: string) {
    const isWeather = /\b(weather|temperature|forecast|rain|snow)\b/i.test(query);
    return {
      matched: isWeather,
      confidence: isWeather ? 0.92 : 0,
      extractedParams: { location: 'Local' },
    };
  },
  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const location = String(params.location || 'Current');
    return {
      result: {
        location,
        condition: 'Clear, 22°C',
        summary: `The weather in ${location} is 22°C and clear.`,
      },
    };
  },
};
```

### Step 2: Register in `skills/registry.ts`
```typescript
import { WeatherSkill } from './weather';

// In SkillRegistry.init():
this.registerSkill(WeatherSkill);
```

### Step 3: Use via Voice or Text
Say *"Apollo, what's the weather in Tokyo?"* — the Skill Router immediately identifies the skill, Apollo Agent executes it, and delivers the voice and UI response.

---

## 8. Future Skills Roadmap

The Phase 3 Skills Architecture is architected to support future modular extensions:

- **Web Research & Grounding**: Live query search and citations
- **Document & PDF Analysis**: Local document ingestion and summarization
- **Spreadsheets & Data**: CSV and tabular data calculations
- **Code Execution Sandbox**: Secure browser-isolated code playground
- **Personal Calendar & Email**: Local organizer hooks
- **Multi-Skill Orchestration**: Chaining multiple skills for composite tasks (e.g. Memory Query -> Calculator -> Summary).
