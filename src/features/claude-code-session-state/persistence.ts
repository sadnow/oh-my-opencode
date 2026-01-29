/**
 * Session State Persistence
 * Cross-session state persistence for Claude Code session state
 */

import * as fs from "fs"
import * as path from "path"
import { log } from "../../shared/logger"

const CURRENT_VERSION = 1

export interface SessionState {
  version: number
  subagentSessions: string[]
  sessionAgentMap: Record<string, string>
}

/**
 * File-based lock for preventing concurrent access to state files.
 * Creates a .lock file with atomic operations.
 */
class FileLock {
  private lockPath: string
  private locked: boolean = false
  private readonly LOCK_TIMEOUT_MS = 5000

  constructor(filePath: string) {
    this.lockPath = `${filePath}.lock`
    this.locked = false
  }

  acquire(): boolean {
    const fs = require("fs")
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
    }

    try {
      // Check for existing lock
      if (fs.existsSync(this.lockPath)) {
        const existingLock = JSON.parse(fs.readFileSync(this.lockPath, "utf-8"))
        const lockAge = Date.now() - existingLock.timestamp

        // If lock is stale (older than timeout), remove it
        if (lockAge > this.LOCK_TIMEOUT_MS) {
          log("[file-lock] Removing stale lock:", { lockPath: this.lockPath, age: lockAge })
          fs.unlinkSync(this.lockPath)
        } else {
          // Lock is held by another process
          return false
        }
      }

      // Try to create lock file atomically
      fs.writeFileSync(this.lockPath, JSON.stringify(lockData), { flag: "wx" })
      this.locked = true
      return true
    } catch (error: unknown) {
      // EEXIST means another process created the lock first
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === "EEXIST") {
        return false
      }
      // Other errors - log but don't fail
      log("[file-lock] Lock acquisition error:", error)
      return false
    }
  }

  release(): void {
    if (!this.locked) return

    const fs = require("fs")
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath)
      }
      this.locked = false
    } catch (error) {
      log("[file-lock] Lock release error:", error)
    }
  }
}

/**
 * SessionStatePersistence - Manages loading and persisting session state
 * Follows the AdaptiveBudgetManager pattern with FileLock, atomic writes, and backup/restore
 */
export class SessionStatePersistence {
  private state: SessionState | null = null
  private statePath: string
  private fileLock: FileLock

  constructor(directory: string) {
    this.statePath = SessionStatePersistence.getStatePath(directory)
    this.fileLock = new FileLock(this.statePath)
    this.state = this.loadState()
    
    log("[session-state-persistence] Initialized:", {
      statePath: this.statePath,
      hasExistingState: this.state !== null,
    })
  }

  /**
   * Get the state file path for a given directory
   */
  static getStatePath(directory: string): string {
    return path.join(directory, ".opencode", "oh-my-opencode-session-state.json")
  }

  /**
   * Load state from disk with backup chain
   */
  private loadState(): SessionState | null {
    const backupPath = `${this.statePath}.backup`

    // Try loading from a file path with validation
    const tryLoadFile = (filePath: string): SessionState | null => {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8")
          const data = JSON.parse(content)

          // Validate required fields
          if (
            typeof data.version === "number" &&
            Array.isArray(data.subagentSessions) &&
            typeof data.sessionAgentMap === "object" &&
            data.sessionAgentMap !== null
          ) {
            log("[session-state-persistence] Loaded state from:", filePath)
            return data as SessionState
          }
          log("[session-state-persistence] State file corrupted (missing fields):", filePath)
        }
      } catch (error) {
        log("[session-state-persistence] Failed to load state from:", { filePath, error })
      }
      return null
    }

    // Try primary file first
    let state = tryLoadFile(this.statePath)
    if (state) {
      return state
    }

    // Try backup file
    state = tryLoadFile(backupPath)
    if (state) {
      log("[session-state-persistence] Loaded state from backup:", backupPath)
      // Restore backup to primary
      try {
        fs.copyFileSync(backupPath, this.statePath)
        log("[session-state-persistence] Restored backup to primary")
      } catch (e) {
        log("[session-state-persistence] Could not restore backup:", e)
      }
      return state
    }

    log("[session-state-persistence] No valid state file found")
    return null
  }

  /**
   * Persist state to disk with atomic writes and file locking
   */
  async persistState(state: SessionState): Promise<void> {
    // Try to acquire lock
    const acquired = await this.fileLock.acquire()
    if (!acquired) {
      log("[session-state-persistence] Could not acquire lock, skipping save")
      return
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.statePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write to temp file first, then rename (atomic operation)
      const tempPath = `${this.statePath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2))
      fs.renameSync(tempPath, this.statePath)

      // Create backup
      const backupPath = `${this.statePath}.backup`
      fs.copyFileSync(this.statePath, backupPath)

      log("[session-state-persistence] State persisted successfully")
      this.state = state
    } catch (error) {
      log("[session-state-persistence] Failed to persist state:", error)
    } finally {
      this.fileLock.release()
    }
  }

  /**
   * Get the current state
   */
  getState(): SessionState | null {
    return this.state
  }

  /**
   * Create initial empty state
   */
  static createInitialState(): SessionState {
    return {
      version: CURRENT_VERSION,
      subagentSessions: [],
      sessionAgentMap: {},
    }
  }
}

export { CURRENT_VERSION }
