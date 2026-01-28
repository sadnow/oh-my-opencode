/**
 * Budget Override Manager
 * Allows manual control over tier selection - force tier, lock tier, etc.
 */

import { log } from "../../shared"
import type { ModelTier } from "../../config/schema"
import { join } from "path"
import { homedir } from "os"
import { getRoutingLogger } from "./routing-logger"

// ============================================================================
// Types
// ============================================================================

export interface BudgetOverrideState {
  /** Forced tier (overrides adaptive recommendations) */
  forcedTier: ModelTier | null
  /** Whether tier is locked (prevents auto-changes) */
  tierLocked: boolean
  /** When the lock/force expires (Unix ms, null = never) */
  lockExpiry: number | null
  /** Who/what set the override */
  modifiedBy: "cli" | "webui" | "api" | null
  /** When override was last modified */
  modifiedAt: number | null
  /** Learning reset timestamp (for tracking) */
  lastLearningReset: number | null
}

export interface OverrideOptions {
  /** Duration in milliseconds before override expires */
  durationMs?: number
  /** Source of the override */
  source?: "cli" | "webui" | "api"
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_OVERRIDE_STATE: BudgetOverrideState = {
  forcedTier: null,
  tierLocked: false,
  lockExpiry: null,
  modifiedBy: null,
  modifiedAt: null,
  lastLearningReset: null,
}

// ============================================================================
// Budget Override Manager
// ============================================================================

export class BudgetOverrideManager {
  private state: BudgetOverrideState
  private persistPath: string

  constructor(persistPath?: string) {
    this.persistPath = persistPath ?? join(
      homedir(),
      ".config",
      "opencode",
      "oh-im-broke-budget-override.json"
    )

    this.state = this.loadState() ?? { ...DEFAULT_OVERRIDE_STATE }

    // Check for expired overrides on load
    this.checkExpiry()

    log("[budget-override] Initialized:", {
      forcedTier: this.state.forcedTier,
      tierLocked: this.state.tierLocked,
      lockExpiry: this.state.lockExpiry,
    })
  }

  // --------------------------------------------------------------------------
  // Override Operations
  // --------------------------------------------------------------------------

  /**
   * Force a specific tier, overriding adaptive recommendations.
   * @param tier The tier to force
   * @param options Optional duration and source
   */
  forceTier(tier: ModelTier, options: OverrideOptions = {}): void {
    const { durationMs, source = "cli" } = options

    this.state.forcedTier = tier
    this.state.modifiedBy = source
    this.state.modifiedAt = Date.now()
    this.state.lockExpiry = durationMs ? Date.now() + durationMs : null

    log("[budget-override] Tier forced:", {
      tier,
      expiry: this.state.lockExpiry,
      source,
    })

    // Log override action
    const logger = getRoutingLogger()
    logger.logOverride("force", tier, source)

    this.saveState()
  }

  /**
   * Lock the current tier, preventing automatic tier changes.
   * @param options Optional duration and source
   */
  lockTier(options: OverrideOptions = {}): void {
    const { durationMs, source = "cli" } = options

    this.state.tierLocked = true
    this.state.modifiedBy = source
    this.state.modifiedAt = Date.now()
    this.state.lockExpiry = durationMs ? Date.now() + durationMs : null

    log("[budget-override] Tier locked:", {
      expiry: this.state.lockExpiry,
      source,
    })

    // Log override action
    const logger = getRoutingLogger()
    logger.logOverride("lock", undefined, source)

    this.saveState()
  }

  /**
   * Unlock the tier, allowing automatic tier changes again.
   */
  unlockTier(): void {
    this.state.tierLocked = false
    this.state.lockExpiry = null
    this.state.modifiedBy = null
    this.state.modifiedAt = Date.now()

    log("[budget-override] Tier unlocked")

    // Log override action
    const logger = getRoutingLogger()
    logger.logOverride("unlock")

    this.saveState()
  }

  /**
   * Clear all overrides, returning to default state.
   */
  clearOverrides(): void {
    this.state = {
      ...DEFAULT_OVERRIDE_STATE,
      lastLearningReset: this.state.lastLearningReset,
    }

    log("[budget-override] Overrides cleared")

    // Log override action
    const logger = getRoutingLogger()
    logger.logOverride("clear")

    this.saveState()
  }

  /**
   * Record that adaptive learning was reset.
   */
  recordLearningReset(): void {
    this.state.lastLearningReset = Date.now()
    this.saveState()
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  /**
   * Get the forced tier, if any (checks expiry).
   */
  getForcedTier(): ModelTier | null {
    this.checkExpiry()
    return this.state.forcedTier
  }

  /**
   * Check if tier changes should be blocked (tier is locked).
   */
  shouldBlockTierChange(): boolean {
    this.checkExpiry()
    return this.state.tierLocked
  }

  /**
   * Check if any override is active.
   */
  hasActiveOverride(): boolean {
    this.checkExpiry()
    return this.state.forcedTier !== null || this.state.tierLocked
  }

  /**
   * Get time remaining until override expires (ms), or null if no expiry.
   */
  getTimeUntilExpiry(): number | null {
    if (!this.state.lockExpiry) return null

    const remaining = this.state.lockExpiry - Date.now()
    return remaining > 0 ? remaining : 0
  }

  /**
   * Get the full override state (read-only).
   */
  getState(): Readonly<BudgetOverrideState> {
    this.checkExpiry()
    return { ...this.state }
  }

  /**
   * Get a summary suitable for display.
   */
  getSummary(): {
    forcedTier: ModelTier | null
    tierLocked: boolean
    expiresIn: string | null
    modifiedBy: string | null
  } {
    this.checkExpiry()

    let expiresIn: string | null = null
    if (this.state.lockExpiry) {
      const remaining = this.state.lockExpiry - Date.now()
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60))
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        expiresIn = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      }
    }

    return {
      forcedTier: this.state.forcedTier,
      tierLocked: this.state.tierLocked,
      expiresIn,
      modifiedBy: this.state.modifiedBy,
    }
  }

  // --------------------------------------------------------------------------
  // Internal Methods
  // --------------------------------------------------------------------------

  /**
   * Check if overrides have expired and clear them if so.
   */
  private checkExpiry(): void {
    if (this.state.lockExpiry && Date.now() > this.state.lockExpiry) {
      log("[budget-override] Override expired, clearing")

      this.state.forcedTier = null
      this.state.tierLocked = false
      this.state.lockExpiry = null
      this.state.modifiedBy = null

      this.saveState()
    }
  }

  /**
   * Load state from disk.
   */
  private loadState(): BudgetOverrideState | null {
    try {
      const fs = require("fs")
      if (fs.existsSync(this.persistPath)) {
        const content = fs.readFileSync(this.persistPath, "utf-8")
        const data = JSON.parse(content)

        // Validate required fields
        if (typeof data === "object" && data !== null) {
          return {
            forcedTier: data.forcedTier ?? null,
            tierLocked: data.tierLocked ?? false,
            lockExpiry: data.lockExpiry ?? null,
            modifiedBy: data.modifiedBy ?? null,
            modifiedAt: data.modifiedAt ?? null,
            lastLearningReset: data.lastLearningReset ?? null,
          }
        }
      }
    } catch (error) {
      log("[budget-override] Failed to load state:", error)
    }
    return null
  }

  /**
   * Save state to disk.
   */
  private saveState(): void {
    try {
      const fs = require("fs")
      const path = require("path")
      const dir = path.dirname(this.persistPath)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write atomically via temp file
      const tempPath = `${this.persistPath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2))
      fs.renameSync(tempPath, this.persistPath)
    } catch (error) {
      log("[budget-override] Failed to save state:", error)
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let overrideManagerInstance: BudgetOverrideManager | null = null

/**
 * Get the global override manager instance.
 */
export function getOverrideManager(): BudgetOverrideManager {
  if (!overrideManagerInstance) {
    overrideManagerInstance = new BudgetOverrideManager()
  }
  return overrideManagerInstance
}

/**
 * Reset the global override manager (for testing).
 */
export function resetOverrideManager(): void {
  overrideManagerInstance = null
}
