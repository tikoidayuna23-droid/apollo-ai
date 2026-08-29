import { Skill, SkillExecutionResult, SkillMatchResult } from '../types';
import { logger } from '../../src/utils/logger';

/**
 * Apollo Time & Chrono Skill (Phase 3)
 * Safe local time, date, timezone, and calendar metadata query provider.
 * Does not require external network APIs.
 */
export const TimeSkill: Skill = {
  id: 'time',
  name: 'Time & Chrono',
  description: 'Provides real-time local clock time, calendar date, day of the week, timezone information, and timestamps.',
  version: '1.0.0',
  enabled: true,
  permission: 'SAFE',
  capabilities: [
    'current_time',
    'current_date',
    'day_of_week',
    'timezone',
    'iso_timestamp',
    'formatted_chrono',
  ],
  activityLabel: 'Checking local time...',
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Specific time component requested: "all", "time_only", "date_only", "day_of_week", "timezone".',
        enum: ['all', 'time_only', 'date_only', 'day_of_week', 'timezone'],
      },
    },
  },

  matchesQuery(rawQuery: string): SkillMatchResult {
    const text = rawQuery.trim().toLowerCase();

    // Explicit time and date queries
    const timeMatch = /\b(?:what\s+time\s+is\s+it|what(?:'s|\s+is)\s+the\s+(?:current\s+)?time|tell\s+me\s+the\s+time|current\s+time)\b/i.test(text);
    const dateMatch = /\b(?:what(?:'s|\s+is)\s+today(?:'s|\s+)?date|what\s+is\s+the\s+date|today(?:'s|\s+)?date|tell\s+me\s+the\s+date|what\s+day\s+is\s+(?:it|today))\b/i.test(text);
    const dateTimeMatch = /\b(?:current\s+date\s+and\s+time|date\s+and\s+time|time\s+and\s+date)\b/i.test(text);
    const timezoneMatch = /\b(?:what\s+(?:is\s+my\s+)?timezone|current\s+timezone)\b/i.test(text);

    if (dateTimeMatch || (timeMatch && dateMatch)) {
      return {
        matched: true,
        confidence: 0.98,
        suggestedAction: 'all',
        extractedParams: { format: 'all' },
        reason: 'Detected full date and time request',
      };
    }

    if (timeMatch) {
      return {
        matched: true,
        confidence: 0.96,
        suggestedAction: 'time_only',
        extractedParams: { format: 'time_only' },
        reason: 'Detected clock time request',
      };
    }

    if (dateMatch) {
      return {
        matched: true,
        confidence: 0.96,
        suggestedAction: 'date_only',
        extractedParams: { format: 'date_only' },
        reason: 'Detected calendar date request',
      };
    }

    if (timezoneMatch) {
      return {
        matched: true,
        confidence: 0.95,
        suggestedAction: 'timezone',
        extractedParams: { format: 'timezone' },
        reason: 'Detected timezone request',
      };
    }

    return { matched: false, confidence: 0 };
  },

  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const format = String(params.format || 'all').toLowerCase();
    logger.info('TimeSkill', `Fetching local chrono data (format: ${format})`);

    try {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const timeFormatted = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const dateFormatted = now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const dayOfWeek = now.toLocaleDateString([], { weekday: 'long' });
      const iso = now.toISOString();

      let summary = '';
      if (format === 'time_only') {
        summary = `The current time is ${timeFormatted}.`;
      } else if (format === 'date_only' || format === 'day_of_week') {
        summary = `Today is ${dateFormatted}.`;
      } else if (format === 'timezone') {
        summary = `Your local timezone is ${timezone}.`;
      } else {
        summary = `The current time is ${timeFormatted} on ${dateFormatted} (${timezone}).`;
      }

      return {
        result: {
          time: timeFormatted,
          date: dateFormatted,
          dayOfWeek,
          timezone,
          iso,
          timestampMs: now.getTime(),
          summary,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve local time';
      logger.error('TimeSkill', 'Error:', err);
      return { result: null, error: errorMsg };
    }
  },
};
