/**
 * Simple logger utility for OPNSense MCP Server
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  output?: 'stdout' | 'stderr';
}

export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      prefix: '[OPNSense MCP]',
      timestamp: true,
      output: 'stderr',
      ...config
    };

    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      this.config.level = LogLevel[envLevel as keyof typeof LogLevel];
    }
  }

  private format(level: string, message: string, ...args: any[]): string {
    const parts: string[] = [];

    if (this.config.timestamp) {
      parts.push(new Date().toISOString());
    }

    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    parts.push(`[${level}]`);
    parts.push(message);

    // Format additional arguments
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    );

    return parts.join(' ') + (formattedArgs.length ? ' ' + formattedArgs.join(' ') : '');
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level > this.config.level) return;

    const formatted = this.format(levelName, message, ...args);
    const output = this.config.output === 'stdout' ? console.log : console.error;
    output(formatted);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  // Create a child logger with additional context
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} [${context}]`
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience exports
export const error = logger.error.bind(logger);
export const warn = logger.warn.bind(logger);
export const info = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);