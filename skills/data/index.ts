import { Skill, SkillExecutionResult, SkillMatchResult } from '../types';
import { logger } from '../../src/utils/logger';

export type DataAction =
  | 'row_count'
  | 'column_detection'
  | 'summary'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'sort'
  | 'filter'
  | 'group_by'
  | 'top_n'
  | 'bottom_n';

export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface ParsedDataset {
  headers: string[];
  rows: DataRow[];
  types: Record<string, 'number' | 'string' | 'boolean' | 'date'>;
}

const MAX_ROWS = 10000;
const MAX_RAW_SIZE = 2000000;

/**
 * Apollo Data Analysis Skill (Phase 5 Foundation)
 * Provides safe, robust analysis for structured data including CSV, JSON arrays, and table data.
 */
export const DataAnalysisSkill: Skill = {
  id: 'data_analysis',
  name: 'Data Analysis',
  description: 'Parses and analyzes structured CSV, JSON, and tabular datasets: row counts, column metrics, sums, averages, min/max, sorting, filtering, and top/bottom N rankings.',
  version: '1.0.0',
  enabled: true,
  permission: 'SAFE',
  category: 'DATA',
  capabilities: [
    'csv_parsing',
    'json_tables',
    'row_count',
    'column_detection',
    'numeric_summaries',
    'sum',
    'average',
    'min',
    'max',
    'sorting',
    'filtering',
    'grouping',
    'top_n',
    'bottom_n',
  ],
  supportedActions: [
    'row_count',
    'column_detection',
    'summary',
    'sum',
    'average',
    'min',
    'max',
    'sort',
    'filter',
    'group_by',
    'top_n',
    'bottom_n',
  ],
  activityLabel: 'Analyzing data...',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Data action to execute: "summary", "row_count", "column_detection", "top_n", "bottom_n", "sum", "average", "min", "max", "sort", "filter", "group_by".',
        enum: [
          'summary',
          'row_count',
          'column_detection',
          'top_n',
          'bottom_n',
          'sum',
          'average',
          'min',
          'max',
          'sort',
          'filter',
          'group_by',
        ],
      },
      data: {
        type: 'string',
        description: 'The dataset in CSV string, JSON string, or array of objects format.',
      },
      column: {
        type: 'string',
        description: 'Target column name for calculations, top/bottom rankings, or sorting (e.g., "Sales", "Price", "Revenue", "Score").',
      },
      n: {
        type: 'number',
        description: 'Number of rows to return for "top_n" or "bottom_n" actions (e.g., 3, 5, 10).',
      },
      direction: {
        type: 'string',
        description: 'Sort direction: "asc" or "desc".',
        enum: ['asc', 'desc'],
      },
    },
    required: ['action', 'data'],
  },

  matchesQuery(rawQuery: string): SkillMatchResult {
    const text = rawQuery.trim();

    // Check if query contains inline CSV data (has newlines with commas)
    const hasInlineCsv = /\b[A-Za-z0-9_-]+,[A-Za-z0-9_-]+\b[\r\n]+[A-Za-z0-9_-]+,[0-9.]+/i.test(text);

    if (hasInlineCsv) {
      // 1. Top N query (e.g. "Give me the top 3 products by sales", "Find the top 3 products")
      const topNMatch = text.match(/(?:give\s+me\s+(?:the\s+)?|find\s+(?:the\s+)?|what\s+are\s+(?:the\s+)?)?top\s+(\d+)(?:\s+items|\s+products|\s+rows|\s+entries)?(?:\s+by\s+([A-Za-z0-9_]+))?/i);
      if (topNMatch) {
        const n = parseInt(topNMatch[1], 10);
        const col = topNMatch[2];

        // Extract the CSV block from the text
        const lines = text.split(/[\r\n]+/);
        const csvLines = lines.filter((l) => l.includes(','));
        const csvData = csvLines.join('\n');

        return {
          matched: true,
          confidence: 0.96,
          suggestedAction: 'top_n',
          extractedParams: {
            action: 'top_n',
            data: csvData,
            n,
            column: col || undefined,
          },
          reason: `Detected dataset with Top ${n} ranking intent`,
        };
      }

      // 2. Average / Sum query on CSV
      const avgMatch = text.match(/(?:average|mean|avg)(?:\s+(?:of|for))?(?:\s+([A-Za-z0-9_]+))?/i);
      if (avgMatch) {
        const lines = text.split(/[\r\n]+/);
        const csvLines = lines.filter((l) => l.includes(','));
        const csvData = csvLines.join('\n');

        return {
          matched: true,
          confidence: 0.95,
          suggestedAction: 'average',
          extractedParams: {
            action: 'average',
            data: csvData,
            column: avgMatch[1] || undefined,
          },
          reason: 'Detected dataset with average calculation intent',
        };
      }

      // 3. Generic Data Summary
      const lines = text.split(/[\r\n]+/);
      const csvLines = lines.filter((l) => l.includes(','));
      return {
        matched: true,
        confidence: 0.92,
        suggestedAction: 'summary',
        extractedParams: {
          action: 'summary',
          data: csvLines.join('\n'),
        },
        reason: 'Detected tabular dataset intent',
      };
    }

    return { matched: false, confidence: 0 };
  },

  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const rawAction = String(params.action || 'summary').trim().toLowerCase() as DataAction;
    const rawData = params.data;
    const specifiedColumn = params.column ? String(params.column).trim() : undefined;
    const n = typeof params.n === 'number' ? params.n : parseInt(String(params.n || '5'), 10) || 5;
    const direction = String(params.direction || (rawAction === 'bottom_n' ? 'asc' : 'desc')).toLowerCase();

    // 1. Validate data input existence
    if (rawData === undefined || rawData === null || rawData === '') {
      return {
        result: null,
        error: 'No dataset provided to Data Analysis skill. Please provide CSV or JSON data.',
      };
    }

    // 2. Parse data into structured dataset
    let dataset: ParsedDataset;
    try {
      dataset = parseInputDataset(rawData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid dataset format';
      return {
        result: null,
        error: `Data parsing failed: ${msg}`,
      };
    }

    // 3. Validate rows count limits
    if (dataset.rows.length === 0) {
      return {
        result: null,
        error: 'Dataset is empty. No data rows found to analyze.',
      };
    }

    if (dataset.rows.length > MAX_ROWS) {
      return {
        result: null,
        error: `Dataset exceeds the maximum limit of ${MAX_ROWS} rows (received ${dataset.rows.length}).`,
      };
    }

    // 4. Resolve target numeric column if needed
    const targetColumn = resolveTargetColumn(dataset, specifiedColumn);

    logger.info('DataAnalysisSkill', `Executing action "${rawAction}" on ${dataset.rows.length} rows (target column: ${targetColumn || 'none'})`);

    // 5. Execute action
    try {
      switch (rawAction) {
        case 'row_count': {
          const count = dataset.rows.length;
          return {
            result: {
              action: 'row_count',
              rowCount: count,
              columns: dataset.headers,
              formatted: count.toLocaleString('en-US'),
              summary: `Dataset contains ${count.toLocaleString('en-US')} rows and ${dataset.headers.length} columns.`,
            },
          };
        }

        case 'column_detection': {
          return {
            result: {
              action: 'column_detection',
              rowCount: dataset.rows.length,
              columns: dataset.headers,
              columnTypes: dataset.types,
              summary: `Detected ${dataset.headers.length} columns: ${dataset.headers.map((h) => `${h} (${dataset.types[h]})`).join(', ')}.`,
            },
          };
        }

        case 'sum': {
          if (!targetColumn) {
            return {
              result: null,
              error: `Action "sum" requires a numeric column. Available columns: ${dataset.headers.join(', ')}.`,
            };
          }
          const sumVal = dataset.rows.reduce((acc, row) => acc + (typeof row[targetColumn] === 'number' ? (row[targetColumn] as number) : 0), 0);
          const formatted = formatNumber(sumVal);
          return {
            result: {
              action: 'sum',
              column: targetColumn,
              value: sumVal,
              formatted,
              summary: `The total sum of ${targetColumn} is ${formatted}.`,
            },
          };
        }

        case 'average': {
          if (!targetColumn) {
            return {
              result: null,
              error: `Action "average" requires a numeric column. Available columns: ${dataset.headers.join(', ')}.`,
            };
          }
          const nums = dataset.rows
            .map((r) => r[targetColumn])
            .filter((v): v is number => typeof v === 'number' && !isNaN(v));

          if (nums.length === 0) {
            return { result: null, error: `No numeric values found in column "${targetColumn}".` };
          }

          const avgVal = nums.reduce((a, b) => a + b, 0) / nums.length;
          const formatted = formatNumber(avgVal);
          return {
            result: {
              action: 'average',
              column: targetColumn,
              value: avgVal,
              formatted,
              summary: `The average ${targetColumn} is ${formatted}.`,
            },
          };
        }

        case 'min': {
          if (!targetColumn) {
            return { result: null, error: `Action "min" requires a numeric column.` };
          }
          const nums = dataset.rows
            .map((r) => r[targetColumn])
            .filter((v): v is number => typeof v === 'number');
          const minVal = Math.min(...nums);
          const formatted = formatNumber(minVal);
          return {
            result: {
              action: 'min',
              column: targetColumn,
              value: minVal,
              formatted,
              summary: `The minimum ${targetColumn} is ${formatted}.`,
            },
          };
        }

        case 'max': {
          if (!targetColumn) {
            return { result: null, error: `Action "max" requires a numeric column.` };
          }
          const nums = dataset.rows
            .map((r) => r[targetColumn])
            .filter((v): v is number => typeof v === 'number');
          const maxVal = Math.max(...nums);
          const formatted = formatNumber(maxVal);
          return {
            result: {
              action: 'max',
              column: targetColumn,
              value: maxVal,
              formatted,
              summary: `The maximum ${targetColumn} is ${formatted}.`,
            },
          };
        }

        case 'top_n':
        case 'bottom_n': {
          if (!targetColumn) {
            return {
              result: null,
              error: `Ranking action requires a numeric column. Available columns: ${dataset.headers.join(', ')}.`,
            };
          }

          const isTop = rawAction === 'top_n';
          const sorted = [...dataset.rows].sort((a, b) => {
            const valA = typeof a[targetColumn] === 'number' ? (a[targetColumn] as number) : -Infinity;
            const valB = typeof b[targetColumn] === 'number' ? (b[targetColumn] as number) : -Infinity;
            return isTop ? valB - valA : valA - valB;
          });

          const sliced = sorted.slice(0, Math.max(1, n));
          const labelCol = dataset.headers.find((h) => h.toLowerCase() !== targetColumn.toLowerCase()) || dataset.headers[0];

          const lines = sliced.map((r, idx) => {
            const lbl = String(r[labelCol] || `Item ${idx + 1}`);
            const val = formatNumber(r[targetColumn] as number);
            return `${lbl}: ${val}`;
          });

          const summary = `${isTop ? 'Top' : 'Bottom'} ${sliced.length} by ${targetColumn}:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;

          return {
            result: {
              action: rawAction,
              column: targetColumn,
              n: sliced.length,
              data: sliced,
              summary,
            },
          };
        }

        case 'sort': {
          const col = specifiedColumn || targetColumn || dataset.headers[0];
          const isAsc = direction === 'asc';
          const sorted = [...dataset.rows].sort((a, b) => {
            const valA = a[col];
            const valB = b[col];
            if (typeof valA === 'number' && typeof valB === 'number') {
              return isAsc ? valA - valB : valB - valA;
            }
            return isAsc
              ? String(valA || '').localeCompare(String(valB || ''))
              : String(valB || '').localeCompare(String(valA || ''));
          });

          return {
            result: {
              action: 'sort',
              sortedColumn: col,
              direction,
              data: sorted,
              summary: `Sorted ${sorted.length} rows by ${col} (${direction.toUpperCase()}).`,
            },
          };
        }

        case 'summary':
        default: {
          // Comprehensive dataset summary
          const numericCols = Object.keys(dataset.types).filter((c) => dataset.types[c] === 'number');
          const stats: Record<string, { sum: number; avg: number; min: number; max: number }> = {};

          for (const col of numericCols) {
            const vals = dataset.rows.map((r) => r[col]).filter((v): v is number => typeof v === 'number');
            if (vals.length > 0) {
              const sum = vals.reduce((a, b) => a + b, 0);
              stats[col] = {
                sum,
                avg: sum / vals.length,
                min: Math.min(...vals),
                max: Math.max(...vals),
              };
            }
          }

          const statsSummary = Object.entries(stats)
            .map(([col, s]) => `${col} (Avg: ${formatNumber(s.avg)}, Sum: ${formatNumber(s.sum)})`)
            .join('; ');

          const summary = `Dataset contains ${dataset.rows.length} rows across ${dataset.headers.length} columns (${dataset.headers.join(', ')}). ${statsSummary ? `Metrics: ${statsSummary}.` : ''}`;

          return {
            result: {
              action: 'summary',
              rowCount: dataset.rows.length,
              headers: dataset.headers,
              columnTypes: dataset.types,
              numericStats: stats,
              summary,
            },
          };
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Data processing error';
      logger.error('DataAnalysisSkill', 'Execution error:', err);
      return { result: null, error: errorMsg };
    }
  },
};

/**
 * Parses CSV, JSON string, or array of objects into structured ParsedDataset.
 */
function parseInputDataset(input: unknown): ParsedDataset {
  if (Array.isArray(input)) {
    if (input.length === 0) return { headers: [], rows: [], types: {} };
    const headers = Array.from(new Set(input.flatMap((item) => Object.keys(item || {}))));
    const rows: DataRow[] = input.map((item) => {
      const row: DataRow = {};
      for (const h of headers) {
        const v = item[h];
        if (typeof v === 'number') row[h] = v;
        else if (typeof v === 'boolean') row[h] = v;
        else if (v === null || v === undefined) row[h] = null;
        else {
          const parsedNum = parseFloat(String(v).replace(/,/g, ''));
          row[h] = !isNaN(parsedNum) && String(v).trim() === String(parsedNum) ? parsedNum : String(v);
        }
      }
      return row;
    });

    return { headers, rows, types: inferColumnTypes(headers, rows) };
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return parseInputDataset(obj.data);
    }
    if (Array.isArray(obj.rows) && Array.isArray(obj.headers)) {
      const headers = obj.headers.map(String);
      const rows: DataRow[] = (obj.rows as unknown[][]).map((rArr) => {
        const row: DataRow = {};
        headers.forEach((h, idx) => {
          const val = rArr[idx];
          row[h] = typeof val === 'number' ? val : String(val ?? '');
        });
        return row;
      });
      return { headers, rows, types: inferColumnTypes(headers, rows) };
    }
  }

  const str = String(input).trim();
  if (!str) throw new Error('Empty dataset string');

  if (str.length > MAX_RAW_SIZE) {
    throw new Error(`Data size exceeds ${MAX_RAW_SIZE / 1000000}MB limit.`);
  }

  // Check if JSON
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(str);
      return parseInputDataset(parsedJson);
    } catch {
      // Fall through to CSV parsing
    }
  }

  // Parse CSV
  return parseCsv(str);
}

function parseCsv(csvText: string): ParsedDataset {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) throw new Error('No CSV lines found');

  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine).map((h) => h.trim());

  const rows: DataRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const row: DataRow = {};
    headers.forEach((h, colIdx) => {
      const rawVal = (vals[colIdx] ?? '').trim();
      const numVal = parseFloat(rawVal.replace(/,/g, ''));
      if (!isNaN(numVal) && String(numVal) === rawVal.replace(/,/g, '')) {
        row[h] = numVal;
      } else {
        row[h] = rawVal;
      }
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    types: inferColumnTypes(headers, rows),
  };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function inferColumnTypes(headers: string[], rows: DataRow[]): Record<string, 'number' | 'string' | 'boolean' | 'date'> {
  const types: Record<string, 'number' | 'string' | 'boolean' | 'date'> = {};

  for (const h of headers) {
    let numericCount = 0;
    let totalNonEmpty = 0;

    for (const r of rows) {
      const v = r[h];
      if (v !== null && v !== undefined && v !== '') {
        totalNonEmpty++;
        if (typeof v === 'number' || (!isNaN(Number(v)) && typeof v === 'string')) {
          numericCount++;
        }
      }
    }

    if (totalNonEmpty > 0 && numericCount / totalNonEmpty >= 0.8) {
      types[h] = 'number';
    } else {
      types[h] = 'string';
    }
  }

  return types;
}

function resolveTargetColumn(dataset: ParsedDataset, requested?: string): string | undefined {
  if (requested) {
    const match = dataset.headers.find((h) => h.toLowerCase() === requested.toLowerCase());
    if (match) return match;
  }

  // Auto-find first numeric column
  return dataset.headers.find((h) => dataset.types[h] === 'number');
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toLocaleString('en-US');
  }
  return Number(n.toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
