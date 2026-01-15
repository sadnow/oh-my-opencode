// Shared logging utility for the plugin
// oh-my-autocode: All logged data is automatically sanitized to prevent credential leakage

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { sanitizeForLogging, sanitizeErrorMessage } from "./sanitize"

const logFile = path.join(os.tmpdir(), "oh-my-opencode.log")

/**
 * Log a message with optional data
 * Data is automatically sanitized to remove API keys, tokens, and other credentials
 */
export function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString()
    // Sanitize both message and data to prevent credential leakage
    const sanitizedMessage = sanitizeErrorMessage(message)
    const sanitizedData = data !== undefined ? sanitizeForLogging(data) : undefined
    const logEntry = `[${timestamp}] ${sanitizedMessage} ${sanitizedData ? JSON.stringify(sanitizedData) : ""}\n`
    fs.appendFileSync(logFile, logEntry)
  } catch {
    // Silently fail - logging should never crash the plugin
  }
}

export function getLogFilePath(): string {
  return logFile
}
