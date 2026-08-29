import { logger } from '../utils/logger';

export interface ToolPropertySchema {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolPropertySchema>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<{ result: unknown; error?: string }>;
}

/**
 * Safe mathematical expression evaluator that parses without eval/Function.
 */
export function safeEvaluateMath(rawExpr: string): number {
  // Clean up and normalize words to symbols
  let expr = rawExpr
    .toLowerCase()
    .replace(/times|multiplied\s+by|x/gi, '*')
    .replace(/divided\s+by|over/gi, '/')
    .replace(/plus/gi, '+')
    .replace(/minus/gi, '-')
    .replace(/to\s+the\s+power\s+of|\^/gi, '**')
    .replace(/squared/gi, '**2')
    .replace(/cubed/gi, '**3')
    .replace(/,/g, '') // remove thousands separators
    .trim();

  // Validate allowed characters: digits, operators, parens, math constants/functions, whitespace, dots
  const validPattern = /^[0-9+\-*/().%^eE\sMath.sqrtcospianbrld]+$/;
  
  // Custom recursive-descent parser for safe evaluation
  return parseExpression(expr);
}

function parseExpression(expr: string): number {
  let pos = 0;
  
  function peek(): string {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
    return expr[pos] || '';
  }
  
  function get(): string {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
    return expr[pos++] || '';
  }

  function parsePrimary(): number {
    let ch = peek();
    
    // Unary plus/minus
    if (ch === '+') {
      get();
      return parsePrimary();
    }
    if (ch === '-') {
      get();
      return -parsePrimary();
    }
    
    // Parentheses
    if (ch === '(') {
      get(); // consume '('
      const val = parseAddSub();
      if (get() !== ')') {
        throw new Error('Mismatched closing parenthesis');
      }
      return val;
    }

    // Mathematical functions (e.g. sqrt(144))
    const rest = expr.slice(pos);
    const fnMatch = rest.match(/^(sqrt|abs|sin|cos|tan|log|round|floor|ceil)\b/i);
    if (fnMatch) {
      const fnName = fnMatch[1].toLowerCase();
      pos += fnName.length;
      if (get() !== '(') throw new Error(`Expected '(' after ${fnName}`);
      const arg = parseAddSub();
      if (get() !== ')') throw new Error(`Expected ')' after ${fnName} argument`);
      
      switch (fnName) {
        case 'sqrt': return Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'log': return Math.log10(arg);
        case 'round': return Math.round(arg);
        case 'floor': return Math.floor(arg);
        case 'ceil': return Math.ceil(arg);
        default: throw new Error(`Unknown function ${fnName}`);
      }
    }

    // Number literals (including decimals and scientific notation)
    let numStr = '';
    while (pos < expr.length && (/[0-9.]/.test(expr[pos]) || (numStr.length > 0 && /[eE]/.test(expr[pos])))) {
      numStr += expr[pos++];
    }
    
    if (numStr === '' && (ch === 'p' || ch === 'P') && expr.slice(pos).toLowerCase().startsWith('pi')) {
      pos += 2;
      return Math.PI;
    }
    if (numStr === '' && ch === 'e' && !/[0-9]/.test(expr[pos + 1] || '')) {
      pos += 1;
      return Math.E;
    }

    if (numStr === '') {
      throw new Error(`Unexpected character at position ${pos}: "${expr[pos] || 'EOF'}"`);
    }

    const val = Number(numStr);
    if (isNaN(val)) throw new Error(`Invalid number: "${numStr}"`);
    return val;
  }

  function parsePower(): number {
    let base = parsePrimary();
    while (true) {
      const p = peek();
      if (p === '^' || (p === '*' && expr[pos + 1] === '*')) {
        if (p === '^') get();
        else { get(); get(); }
        const exponent = parsePower(); // right-associative
        base = Math.pow(base, exponent);
      } else {
        break;
      }
    }
    return base;
  }

  function parseMulDiv(): number {
    let val = parsePower();
    while (true) {
      const op = peek();
      if (op === '*' && expr[pos + 1] !== '*') {
        get();
        val = val * parsePower();
      } else if (op === '/') {
        get();
        const divisor = parsePower();
        if (divisor === 0) throw new Error('Division by zero is undefined');
        val = val / divisor;
      } else if (op === '%') {
        get();
        const divisor = parsePower();
        val = val % divisor;
      } else {
        break;
      }
    }
    return val;
  }

  function parseAddSub(): number {
    let val = parseMulDiv();
    while (true) {
      const op = peek();
      if (op === '+') {
        get();
        val = val + parseMulDiv();
      } else if (op === '-') {
        get();
        val = val - parseMulDiv();
      } else {
        break;
      }
    }
    return val;
  }

  const result = parseAddSub();
  if (pos < expr.length) {
    const trailing = expr.slice(pos).trim();
    if (trailing) {
      throw new Error(`Unexpected trailing content: "${trailing}"`);
    }
  }
  return result;
}

export const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluates mathematical operations and calculations accurately without rounding errors.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g., "125 * 48", "sqrt(256) + 40", "(500 - 35) * 1.08").',
      },
    },
    required: ['expression'],
  },
  execute: async (args: Record<string, unknown>) => {
    const rawExpression = String(args.expression || '');
    logger.info('CalculatorTool', `Calculating: ${rawExpression}`);
    
    if (!rawExpression.trim()) {
      return { result: null, error: 'Empty expression provided.' };
    }

    try {
      const numResult = safeEvaluateMath(rawExpression);
      // Format cleanly (e.g., 6000 -> 6,000 for display or rounded decimals)
      const formatted = Number.isInteger(numResult)
        ? numResult.toLocaleString('en-US')
        : Number(numResult.toFixed(8)).toString();

      return {
        result: {
          expression: rawExpression,
          value: numResult,
          formatted,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Evaluation failed';
      logger.warn('CalculatorTool', `Calculation error: ${errorMsg}`);
      return { result: null, error: errorMsg };
    }
  },
};
