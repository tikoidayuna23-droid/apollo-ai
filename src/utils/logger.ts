export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(context: string, message: string, data?: unknown) {
    if (this.shouldLog('debug')) {
      console.debug(`[APOLLO:DEBUG][${context}] ${message}`, data !== undefined ? data : '');
    }
  }

  info(context: string, message: string, data?: unknown) {
    if (this.shouldLog('info')) {
      console.info(`[APOLLO:INFO][${context}] ${message}`, data !== undefined ? data : '');
    }
  }

  warn(context: string, message: string, data?: unknown) {
    if (this.shouldLog('warn')) {
      console.warn(`[APOLLO:WARN][${context}] ${message}`, data !== undefined ? data : '');
    }
  }

  error(context: string, message: string, error?: unknown) {
    if (this.shouldLog('error')) {
      console.error(`[APOLLO:ERROR][${context}] ${message}`, error !== undefined ? error : '');
    }
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(targetLevel) >= levels.indexOf(this.level);
  }
}

export const logger = new Logger();
