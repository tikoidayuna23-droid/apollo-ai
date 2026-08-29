import { ToolDefinition } from './calculator';
import { TimeSkill } from '../../skills/time';
import { logger } from '../utils/logger';

export const timeTool: ToolDefinition = {
  name: 'time',
  description: 'Provides real-time local clock time, calendar date, day of week, and timezone.',
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
  execute: async (args: Record<string, unknown>) => {
    logger.info('TimeTool', 'Executing time query with args:', args);
    return TimeSkill.execute(args);
  },
};
