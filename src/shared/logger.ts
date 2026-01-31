// Shared logging utility for the plugin

export interface LogEntry {

  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

export class Logger {
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error'  // Changed from 'info' to suppress verbose logs in TUI

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return
    
    const output = JSON.stringify(entry)
    
    switch (entry.level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }

  debug(message: string, context?: unknown): void {
    this.log({ level: 'debug', message, timestamp: new Date().toISOString(), context: this.ensureContext(context) })
  }

  info(message: string, context?: unknown): void {
    this.log({ level: 'info', message, timestamp: new Date().toISOString(), context: this.ensureContext(context) })
  }

  warn(message: string, context?: unknown): void {
    this.log({ level: 'warn', message, timestamp: new Date().toISOString(), context: this.ensureContext(context) })
  }

  error(message: string, context?: unknown): void {
    this.log({ level: 'error', message, timestamp: new Date().toISOString(), context: this.ensureContext(context) })
  }

  private ensureContext(context: unknown): Record<string, unknown> | undefined {
    if (context === null || context === undefined) return undefined
    if (typeof context === 'object' && !Array.isArray(context)) return context as Record<string, unknown>
    return { data: context }
  }
}

export const logger = new Logger()

/**
 * Legacy log function for backward compatibility.
 * @deprecated Use logger.info or other level-specific methods instead.
 */
export function log(message: string, context?: unknown): void {
  logger.info(message, context)
}

