/**
 * Config Change Queue
 * Manages queued configuration changes for safe application
 */

import type { OhMyOpenCodeConfig } from "../../config/schema"
import { deepMerge } from "../../shared"

export interface ConfigChange {
  /** Unique ID for this change */
  id: string
  /** Timestamp when change was queued */
  timestamp: Date
  /** The partial config to merge */
  change: Partial<OhMyOpenCodeConfig>
  /** Source of the change (e.g., "webui", "wizard", "file-watcher") */
  source: string
  /** Whether this change has been applied */
  applied: boolean
}

export class ConfigChangeQueue {
  private changes: ConfigChange[] = []

  /**
   * Queue a configuration change.
   */
  queue(change: Partial<OhMyOpenCodeConfig>, source: string): ConfigChange {
    const configChange: ConfigChange = {
      id: `change_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date(),
      change,
      source,
      applied: false,
    }

    this.changes.push(configChange)
    return configChange
  }

  /**
   * Get all pending (unapplied) changes.
   */
  getPending(): ConfigChange[] {
    return this.changes.filter((c) => !c.applied)
  }

  /**
   * Check if there are pending changes.
   */
  hasPending(): boolean {
    return this.changes.some((c) => !c.applied)
  }

  /**
   * Merge all pending changes into a base config.
   * Returns the merged config and marks changes as applied.
   */
  applyPending(baseConfig: OhMyOpenCodeConfig): OhMyOpenCodeConfig {
    const pending = this.getPending()
    if (pending.length === 0) {
      return baseConfig
    }

    let merged = { ...baseConfig }
    for (const configChange of pending) {
      merged = mergeConfigChange(merged, configChange.change)
      configChange.applied = true
    }

    return merged
  }

  /**
   * Clear all applied changes from the queue.
   */
  clearApplied(): void {
    this.changes = this.changes.filter((c) => !c.applied)
  }

  /**
   * Clear all changes from the queue.
   */
  clearAll(): void {
    this.changes = []
  }

  /**
   * Get change by ID.
   */
  get(id: string): ConfigChange | undefined {
    return this.changes.find((c) => c.id === id)
  }

  /**
   * Remove a specific change by ID.
   */
  remove(id: string): boolean {
    const index = this.changes.findIndex((c) => c.id === id)
    if (index !== -1) {
      this.changes.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Get the count of pending changes.
   */
  pendingCount(): number {
    return this.getPending().length
  }
}

/**
 * Merge a partial config change into a base config.
 * Handles deep merging of nested objects.
 */
function mergeConfigChange(
  base: OhMyOpenCodeConfig,
  change: Partial<OhMyOpenCodeConfig>
): OhMyOpenCodeConfig {
  const result = { ...base }

  for (const [key, value] of Object.entries(change)) {
    if (value === undefined) continue

    const k = key as keyof OhMyOpenCodeConfig

    // Handle array fields that should be merged (not replaced)
    if (isArrayField(k) && Array.isArray(value) && Array.isArray(base[k])) {
      ;(result as Record<string, unknown>)[k] = [...new Set([...base[k] as unknown[], ...value])]
    }
    // Handle object fields that should be deep merged
    else if (isObjectField(k) && typeof value === "object" && value !== null) {
      ;(result as Record<string, unknown>)[k] = deepMerge(
        base[k] as Record<string, unknown> | undefined,
        value as Record<string, unknown>
      )
    }
    // Simple fields - replace
    else {
      ;(result as Record<string, unknown>)[k] = value
    }
  }

  return result
}

/**
 * Check if a config key is an array field.
 */
function isArrayField(key: keyof OhMyOpenCodeConfig): boolean {
  return [
    "disabled_mcps",
    "disabled_agents",
    "disabled_skills",
    "disabled_hooks",
    "disabled_commands",
  ].includes(key)
}

/**
 * Check if a config key is an object field that should be deep merged.
 */
function isObjectField(key: keyof OhMyOpenCodeConfig): boolean {
  return [
    "agents",
    "categories",
    "claude_code",
    "sisyphus_agent",
    "comment_checker",
    "experimental",
    "skills",
    "ralph_loop",
    "background_task",
    "notification",
    "git_master",
    "browser_automation_engine",
    "tmux",
    "webui",
    "usage_tracking",
    "budget",
  ].includes(key)
}
