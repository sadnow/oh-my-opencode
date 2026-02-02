import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { log } from "../../shared"

/**
 * Storage format for tracked sessions
 */
interface TrackedSessionsStorage {
  trackedSessions: string[]
  updatedAt: number
}

/**
 * Storage path for tracked sessions
 */
const STORAGE_DIR = join(homedir(), ".config", "opencode")
const STORAGE_FILE = join(STORAGE_DIR, "oib-tracked-sessions.json")

/**
 * In-memory cache of tracked sessions
 */
let cachedSessions: Set<string> | null = null

/**
 * Load tracked sessions from disk
 */
export function loadTrackedSessions(): Set<string> {
  // Return cached if available
  if (cachedSessions !== null) {
    return cachedSessions
  }

  // Initialize cache
  cachedSessions = new Set<string>()

  // Check if file exists
  if (!existsSync(STORAGE_FILE)) {
    log("[oib-autoselect-storage] Storage file does not exist, starting with empty set")
    return cachedSessions
  }

  try {
    const content = readFileSync(STORAGE_FILE, "utf-8")
    const data: TrackedSessionsStorage = JSON.parse(content)

    if (Array.isArray(data.trackedSessions)) {
      cachedSessions = new Set(data.trackedSessions)
      log("[oib-autoselect-storage] Loaded tracked sessions", {
        count: cachedSessions.size,
        updatedAt: new Date(data.updatedAt).toISOString(),
      })
    } else {
      log("[oib-autoselect-storage] Invalid storage format, starting with empty set")
    }
  } catch (error) {
    log("[oib-autoselect-storage] Failed to load tracked sessions", {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return cachedSessions
}

/**
 * Save tracked sessions to disk (atomic write)
 */
export function saveTrackedSessions(sessions: Set<string>): void {
  try {
    // Ensure directory exists
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true })
    }

    // Prepare data
    const data: TrackedSessionsStorage = {
      trackedSessions: Array.from(sessions),
      updatedAt: Date.now(),
    }

    // Write to temp file first, then rename (atomic operation)
    const tempPath = `${STORAGE_FILE}.tmp`
    writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8")
    renameSync(tempPath, STORAGE_FILE)

    // Update cache
    cachedSessions = new Set(sessions)

    log("[oib-autoselect-storage] Saved tracked sessions", {
      count: sessions.size,
    })
  } catch (error) {
    log("[oib-autoselect-storage] Failed to save tracked sessions", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Add a session to tracked sessions
 */
export function addTrackedSession(sessionID: string): void {
  const sessions = loadTrackedSessions()
  sessions.add(sessionID)
  saveTrackedSessions(sessions)
}

/**
 * Remove a session from tracked sessions
 */
export function removeTrackedSession(sessionID: string): void {
  const sessions = loadTrackedSessions()
  sessions.delete(sessionID)
  saveTrackedSessions(sessions)
}

/**
 * Check if a session is tracked
 */
export function isSessionTracked(sessionID: string): boolean {
  const sessions = loadTrackedSessions()
  return sessions.has(sessionID)
}

/**
 * Clear all tracked sessions
 */
export function clearAllTrackedSessions(): void {
  cachedSessions = new Set<string>()
  saveTrackedSessions(cachedSessions)
}

/**
 * Reset storage for testing - clears both cache and file
 * @internal
 */
export function _resetStorageForTesting(): void {
  cachedSessions = new Set<string>()
  // Also clear the storage file for clean test state
  try {
    if (existsSync(STORAGE_FILE)) {
      writeFileSync(STORAGE_FILE, JSON.stringify({ trackedSessions: [], updatedAt: Date.now() }, null, 2), "utf-8")
    }
  } catch {
    // Ignore errors during test cleanup
  }
}
