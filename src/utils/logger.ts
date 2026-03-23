/**
 * Logger utility for OPNSense MCP Server
 *
 * Supports file logging via LOG_FILE environment variable.
 * When running with stdio transport, file logging is critical since
 * stdout is reserved for JSON-RPC and stderr may not be captured.
 *
 * Environment variables:
 *   LOG_LEVEL   - ERROR, WARN, INFO, DEBUG (default: INFO)
 *   LOG_FILE    - Path to log file (default: none, stderr only)
 *   LOG_MAX_SIZE - Max log file size in bytes before rotation (default: 10MB)
 *   LOG_MAX_FILES - Number of rotated log files to keep (default: 5)
 */

import { createWriteStream, statSync, renameSync, unlinkSync, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';

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
  logFile?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

export class Logger {
  private config: LoggerConfig;
  private fileStream: WriteStream | null = null;
  private currentFileSize = 0;

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

    // Set log file from environment (constructor config takes precedence)
    if (!this.config.logFile && process.env.LOG_FILE) {
      this.config.logFile = process.env.LOG_FILE;
    }

    if (!this.config.maxFileSize && process.env.LOG_MAX_SIZE) {
      this.config.maxFileSize = parseInt(process.env.LOG_MAX_SIZE, 10);
    }

    if (!this.config.maxFiles && process.env.LOG_MAX_FILES) {
      this.config.maxFiles = parseInt(process.env.LOG_MAX_FILES, 10);
    }

    if (this.config.logFile) {
      this.initFileLogging(this.config.logFile);
    }
  }

  private initFileLogging(filePath: string): void {
    try {
      // Ensure the directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Get current file size if file exists
      if (existsSync(filePath)) {
        try {
          this.currentFileSize = statSync(filePath).size;
        } catch {
          this.currentFileSize = 0;
        }
      }

      this.fileStream = createWriteStream(filePath, { flags: 'a' });

      this.fileStream.on('error', (err) => {
        // Fall back to stderr if file logging fails
        process.stderr.write(`[Logger] File logging error: ${err.message}\n`);
        this.fileStream = null;
      });
    } catch (err: any) {
      process.stderr.write(`[Logger] Failed to initialize file logging: ${err.message}\n`);
    }
  }

  private rotateLogFile(): void {
    const filePath = this.config.logFile;
    if (!filePath) return;

    const maxFiles = this.config.maxFiles ?? DEFAULT_MAX_FILES;

    // Close current stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    try {
      // Remove oldest file
      const oldest = `${filePath}.${maxFiles}`;
      if (existsSync(oldest)) {
        unlinkSync(oldest);
      }

      // Shift existing rotated files
      for (let i = maxFiles - 1; i >= 1; i--) {
        const from = `${filePath}.${i}`;
        const to = `${filePath}.${i + 1}`;
        if (existsSync(from)) {
          renameSync(from, to);
        }
      }

      // Rotate current file
      if (existsSync(filePath)) {
        renameSync(filePath, `${filePath}.1`);
      }
    } catch (err: any) {
      process.stderr.write(`[Logger] Log rotation error: ${err.message}\n`);
    }

    // Reopen file
    this.currentFileSize = 0;
    this.initFileLogging(filePath);
  }

  private writeToFile(line: string): void {
    if (!this.fileStream) return;

    const maxSize = this.config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const bytes = Buffer.byteLength(line, 'utf8');

    if (this.currentFileSize + bytes > maxSize) {
      this.rotateLogFile();
    }

    if (this.fileStream) {
      this.fileStream.write(line);
      this.currentFileSize += bytes;
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

    // Always write to file if configured
    this.writeToFile(formatted + '\n');

    // Write to console output (stderr by default to avoid polluting stdio transport)
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

  // Create a child logger with additional context (shares file stream)
  child(context: string): Logger {
    const child = new Logger({
      ...this.config,
      prefix: `${this.config.prefix} [${context}]`,
      logFile: undefined // Don't re-init file stream
    });
    // Share the parent's file stream
    child.fileStream = this.fileStream;
    child.currentFileSize = this.currentFileSize;
    return child;
  }

  // Flush and close the file stream
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.fileStream) {
        this.fileStream.end(() => resolve());
      } else {
        resolve();
      }
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
