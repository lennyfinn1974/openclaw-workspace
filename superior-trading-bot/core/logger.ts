/**
 * Enhanced Logger for Superior Trading Bot
 * Provides structured logging with levels, colors, and context
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private module: string;
  private logLevel: LogLevel;
  private entries: LogEntry[] = [];
  private maxEntries = 1000;
  
  constructor(module: string, logLevel: LogLevel = LogLevel.INFO) {
    this.module = module;
    this.logLevel = logLevel;
  }
  
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  success(message: string, data?: any): void {
    this.log(LogLevel.SUCCESS, message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  error(message: string, error?: any, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error instanceof Error ? error : new Error(String(error)));
  }
  
  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (level < this.logLevel) return;
    
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      data,
      error,
    };
    
    // Add to memory (circular buffer)
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    
    // Console output with colors
    this.outputToConsole(entry);
  }
  
  private outputToConsole(entry: LogEntry): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m',   // Cyan
      [LogLevel.INFO]: '\x1b[34m',    // Blue  
      [LogLevel.SUCCESS]: '\x1b[32m', // Green
      [LogLevel.WARN]: '\x1b[33m',    // Yellow
      [LogLevel.ERROR]: '\x1b[31m',   // Red
    };
    
    const levelNames = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.SUCCESS]: 'SUCCESS',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
    };
    
    const reset = '\x1b[0m';
    const gray = '\x1b[90m';
    const color = colors[entry.level];
    const levelName = levelNames[entry.level];
    
    const time = entry.timestamp.split('T')[1].replace('Z', '').substring(0, 12);
    
    let output = `${gray}${time}${reset} ${color}[${levelName}]${reset} ${gray}${entry.module}${reset} ${entry.message}`;
    
    if (entry.data) {
      output += `${gray} ${JSON.stringify(entry.data, null, 0)}${reset}`;
    }
    
    console.log(output);
    
    if (entry.error) {
      console.error(`${color}  Stack:${reset}`, entry.error.stack);
    }
  }
  
  // Get recent log entries
  getEntries(count: number = 50): LogEntry[] {
    return this.entries.slice(-count);
  }
  
  // Get entries by level
  getEntriesByLevel(level: LogLevel, count: number = 50): LogEntry[] {
    return this.entries
      .filter(entry => entry.level === level)
      .slice(-count);
  }
  
  // Clear entries
  clear(): void {
    this.entries = [];
  }
  
  // Set log level
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}