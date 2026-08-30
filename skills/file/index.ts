import { Skill, SkillExecutionResult, SkillMatchResult } from '../types';
import { logger } from '../../src/utils/logger';

export type FileAction = 'inspect' | 'extract_text' | 'extract_data' | 'validate_format';

const SUPPORTED_TEXT_EXTENSIONS = ['.txt', '.csv', '.json', '.md', '.log', '.tsv', '.js', '.ts', '.html', '.css', '.xml'];
const STRUCTURED_EXTENSIONS = ['.csv', '.tsv', '.json'];
const UNSUPPORTED_BINARY_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.zip', '.tar', '.gz', '.exe', '.bin', '.png', '.jpg', '.jpeg'];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Apollo File Intelligence Skill (Phase 5 Foundation)
 * Provides safe in-memory file inspection, validation, text extraction, and structured data extraction.
 * Operates strictly on user-provided file content without granting unrestricted filesystem access.
 */
export const FileIntelligenceSkill: Skill = {
  id: 'file_intelligence',
  name: 'File Intelligence',
  description: 'Safely inspects file metadata and extracts text or structured data from TXT, CSV, JSON, MD, and log files in memory.',
  version: '1.0.0',
  enabled: true,
  permission: 'READ',
  category: 'FILE',
  capabilities: [
    'file_inspection',
    'text_extraction',
    'csv_extraction',
    'json_extraction',
    'metadata_analysis',
    'safe_sandboxing',
  ],
  supportedActions: ['inspect', 'extract_text', 'extract_data', 'validate_format'],
  activityLabel: 'Inspecting file...',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'File action: "inspect", "extract_text", "extract_data", "validate_format".',
        enum: ['inspect', 'extract_text', 'extract_data', 'validate_format'],
      },
      filename: {
        type: 'string',
        description: 'Name of the target file (e.g., "sales.csv", "report.txt", "data.json").',
      },
      content: {
        type: 'string',
        description: 'Raw text or base64 content of the file.',
      },
      mimeType: {
        type: 'string',
        description: 'MIME type of the file (e.g., "text/csv", "text/plain", "application/json").',
      },
      size: {
        type: 'number',
        description: 'File size in bytes.',
      },
    },
    required: ['action', 'filename'],
  },

  matchesQuery(rawQuery: string): SkillMatchResult {
    const text = rawQuery.trim();

    // 1. File inspect query (e.g., "inspect file sales.csv", "check file report.txt")
    const inspectMatch = text.match(/(?:inspect|check|validate|analyze)\s+(?:file\s+)?([A-Za-z0-9_.\-]+\.[a-zA-Z0-9]+)/i);
    if (inspectMatch) {
      return {
        matched: true,
        confidence: 0.94,
        suggestedAction: 'inspect',
        extractedParams: {
          action: 'inspect',
          filename: inspectMatch[1].trim(),
        },
        reason: 'Detected file inspection intent',
      };
    }

    // 2. Extract text / read file query
    const extractMatch = text.match(/(?:extract\s+text\s+from|read\s+file|open\s+file)\s+([A-Za-z0-9_.\-]+\.[a-zA-Z0-9]+)/i);
    if (extractMatch) {
      return {
        matched: true,
        confidence: 0.94,
        suggestedAction: 'extract_text',
        extractedParams: {
          action: 'extract_text',
          filename: extractMatch[1].trim(),
        },
        reason: 'Detected text extraction intent',
      };
    }

    return { matched: false, confidence: 0 };
  },

  async execute(params: Record<string, unknown>): Promise<SkillExecutionResult> {
    const action = String(params.action || 'inspect').trim().toLowerCase() as FileAction;
    const filename = String(params.filename || 'unknown.txt').trim();
    const rawContent = params.content !== undefined ? String(params.content) : '';
    const mimeType = params.mimeType ? String(params.mimeType).trim() : undefined;
    const providedSize = typeof params.size === 'number' ? params.size : rawContent.length;

    if (!filename) {
      return { result: null, error: 'Filename is required for File Intelligence.' };
    }

    // Extract file extension
    const dotIdx = filename.lastIndexOf('.');
    const ext = dotIdx !== -1 ? filename.slice(dotIdx).toLowerCase() : '';

    const isTextSupported = SUPPORTED_TEXT_EXTENSIONS.includes(ext);
    const isStructured = STRUCTURED_EXTENSIONS.includes(ext);
    const isBinaryUnsupported = UNSUPPORTED_BINARY_EXTENSIONS.includes(ext);

    logger.info('FileIntelligenceSkill', `Executing action "${action}" on "${filename}" (ext: ${ext}, size: ${providedSize} bytes)`);

    // Check size limit
    if (providedSize > MAX_FILE_SIZE_BYTES) {
      return {
        result: null,
        error: `File "${filename}" exceeds the maximum supported size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      };
    }

    try {
      switch (action) {
        case 'inspect':
        case 'validate_format': {
          let textStatus = 'ready';
          if (isBinaryUnsupported) {
            textStatus = `Unsupported binary format (${ext}). Currently text extraction supports TXT, CSV, JSON, and MD.`;
          } else if (!isTextSupported) {
            textStatus = `Unknown format (${ext}). Treated as generic text if readable.`;
          }

          const formattedSize = formatBytes(providedSize);
          const summary = `File "${filename}" (${formattedSize}): ${isStructured ? 'Structured tabular data' : isTextSupported ? 'Plain text document' : 'Binary or unsupported format'}. Status: ${textStatus}`;

          return {
            result: {
              action: 'inspect',
              filename,
              extension: ext,
              mimeType: mimeType || inferMimeType(ext),
              sizeBytes: providedSize,
              sizeFormatted: formattedSize,
              isSupported: isTextSupported,
              isStructured,
              isBinaryUnsupported,
              textExtractionStatus: textStatus,
              summary,
            },
          };
        }

        case 'extract_text': {
          if (isBinaryUnsupported) {
            return {
              result: null,
              error: `Cannot extract plain text from ${ext.toUpperCase()} file "${filename}". Direct text extraction currently supports TXT, CSV, JSON, MD, and LOG formats.`,
            };
          }

          if (!rawContent) {
            return {
              result: {
                action: 'extract_text',
                filename,
                text: '',
                characterCount: 0,
                lineCount: 0,
                summary: `File "${filename}" is empty (0 characters).`,
              },
            };
          }

          const lines = rawContent.split(/\r?\n/);
          const words = rawContent.trim().split(/\s+/).filter(Boolean);

          return {
            result: {
              action: 'extract_text',
              filename,
              text: rawContent,
              characterCount: rawContent.length,
              lineCount: lines.length,
              wordCount: words.length,
              summary: `Extracted ${rawContent.length} characters (${lines.length} lines, ${words.length} words) from "${filename}".`,
            },
          };
        }

        case 'extract_data': {
          if (!isStructured) {
            return {
              result: null,
              error: `File "${filename}" is not a structured data format (expected .csv, .tsv, or .json).`,
            };
          }

          if (!rawContent) {
            return {
              result: null,
              error: `File "${filename}" contains no data to extract.`,
            };
          }

          return {
            result: {
              action: 'extract_data',
              filename,
              isStructured: true,
              format: ext.replace('.', ''),
              rawData: rawContent,
              summary: `Extracted structured ${ext.toUpperCase()} data from "${filename}". Ready for Data Analysis.`,
            },
          };
        }

        default:
          return {
            result: null,
            error: `Unsupported File Intelligence action: "${action}".`,
          };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'File intelligence error';
      logger.error('FileIntelligenceSkill', 'Error:', err);
      return { result: null, error: errorMsg };
    }
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function inferMimeType(ext: string): string {
  switch (ext) {
    case '.csv':
      return 'text/csv';
    case '.tsv':
      return 'text/tab-separated-values';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.md':
      return 'text/markdown';
    case '.log':
      return 'text/plain';
    case '.pdf':
      return 'application/pdf';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}
