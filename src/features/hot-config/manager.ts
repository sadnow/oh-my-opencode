/**
 * Hot Config Manager
 * Manages runtime configuration with support for hot-reload
 */

import { EventEmitter } from "events"
import * as fs from "fs"
import * as path from "path"
import type { OhMyOpenCodeConfig } from "../../config/schema"
import { loadPluginConfig, mergeConfigs } from "../../plugin-config"
import { log, getOpenCodeConfigDir } from "../../shared"
import { ConfigChangeQueue, type ConfigChange } from "./queue"

export interface HotConfigManagerOptions {
  /** Working directory for project-level config */
  directory: string
  /** Initial configuration */
  initialConfig: OhMyOpenCodeConfig
  /** Enable file watching for auto-reload */
  watchFiles?: boolean
  /** Plugin context for config loading */
  ctx?: unknown
}

export interface ConfigChangeEvent {
  /** The new configuration */
  config: OhMyOpenCodeConfig
  /** The previous configuration */
  previousConfig: OhMyOpenCodeConfig
  /** Source of the change */
  source: string
  /** Changes that were applied */
  changes: ConfigChange[]
}

export class HotConfigManager extends EventEmitter {
  private config: OhMyOpenCodeConfig
  private directory: string
  private ctx: unknown
  private queue: ConfigChangeQueue
  private watchers: fs.FSWatcher[] = []
  private reloadDebounceTimer?: ReturnType<typeof setTimeout>

  constructor(options: HotConfigManagerOptions) {
    super()
    this.config = options.initialConfig
    this.directory = options.directory
    this.ctx = options.ctx
    this.queue = new ConfigChangeQueue()

    if (options.watchFiles) {
      this.startFileWatching()
    }

    log("[hot-config] Manager initialized")
  }

  /**
   * Get the current configuration.
   */
  getConfig(): OhMyOpenCodeConfig {
    return this.config
  }

  /**
   * Reload configuration from disk.
   */
  reload(): OhMyOpenCodeConfig {
    const previousConfig = this.config
    this.config = loadPluginConfig(this.directory, this.ctx)

    log("[hot-config] Configuration reloaded from disk")

    this.emit("configChanged", {
      config: this.config,
      previousConfig,
      source: "file-reload",
      changes: [],
    } satisfies ConfigChangeEvent)

    return this.config
  }

  /**
   * Queue a configuration change.
   * Changes are not applied immediately - call applyPendingChanges() to apply.
   */
  queueChange(change: Partial<OhMyOpenCodeConfig>, source: string = "api"): ConfigChange {
    const configChange = this.queue.queue(change, source)
    log("[hot-config] Change queued:", { id: configChange.id, source })
    return configChange
  }

  /**
   * Check if there are pending changes.
   */
  hasPendingChanges(): boolean {
    return this.queue.hasPending()
  }

  /**
   * Get all pending changes.
   */
  getPendingChanges(): ConfigChange[] {
    return this.queue.getPending()
  }

  /**
   * Apply all pending changes.
   * Returns the new configuration.
   */
  applyPendingChanges(): OhMyOpenCodeConfig {
    if (!this.queue.hasPending()) {
      return this.config
    }

    const previousConfig = this.config
    const pendingChanges = this.queue.getPending()
    this.config = this.queue.applyPending(this.config)
    this.queue.clearApplied()

    log("[hot-config] Applied pending changes:", { count: pendingChanges.length })

    this.emit("configChanged", {
      config: this.config,
      previousConfig,
      source: "queue",
      changes: pendingChanges,
    } satisfies ConfigChangeEvent)

    return this.config
  }

  /**
   * Apply a configuration change immediately.
   * Use this for urgent changes that can't wait for the next idle period.
   */
  applyImmediate(change: Partial<OhMyOpenCodeConfig>, source: string = "immediate"): OhMyOpenCodeConfig {
    const previousConfig = this.config
    const configChange = this.queue.queue(change, source)
    this.config = this.queue.applyPending(this.config)
    this.queue.clearApplied()

    log("[hot-config] Applied immediate change:", { source })

    this.emit("configChanged", {
      config: this.config,
      previousConfig,
      source,
      changes: [configChange],
    } satisfies ConfigChangeEvent)

    return this.config
  }

  /**
   * Update a specific config section.
   */
  updateSection<K extends keyof OhMyOpenCodeConfig>(
    key: K,
    value: OhMyOpenCodeConfig[K],
    source: string = "section-update"
  ): void {
    this.queueChange({ [key]: value } as Partial<OhMyOpenCodeConfig>, source)
  }

  /**
   * Save the current configuration to disk.
   */
  saveConfig(): void {
    const configDir = getOpenCodeConfigDir({ binary: "opencode" })
    const configPath = path.join(configDir, "oh-my-opencode.json")

    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), "utf-8")
      log("[hot-config] Configuration saved to disk:", configPath)
    } catch (error) {
      log("[hot-config] Failed to save configuration:", error)
      throw error
    }
  }

  /**
   * Cancel a pending change by ID.
   */
  cancelChange(changeId: string): boolean {
    return this.queue.remove(changeId)
  }

  /**
   * Clear all pending changes.
   */
  clearPendingChanges(): void {
    this.queue.clearAll()
  }

  /**
   * Start watching config files for changes.
   */
  private startFileWatching(): void {
    const configDir = getOpenCodeConfigDir({ binary: "opencode" })
    const userConfigPath = path.join(configDir, "oh-my-opencode.json")
    const projectConfigPath = path.join(this.directory, ".opencode", "oh-my-opencode.json")

    const watchFile = (filePath: string) => {
      if (!fs.existsSync(filePath)) return

      try {
        const watcher = fs.watch(filePath, (eventType) => {
          if (eventType === "change") {
            this.handleFileChange(filePath)
          }
        })
        this.watchers.push(watcher)
        log("[hot-config] Watching file:", filePath)
      } catch (error) {
        log("[hot-config] Failed to watch file:", { filePath, error })
      }
    }

    watchFile(userConfigPath)
    watchFile(projectConfigPath)
  }

  /**
   * Handle a file change event.
   */
  private handleFileChange(filePath: string): void {
    // Debounce rapid changes
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer)
    }

    this.reloadDebounceTimer = setTimeout(() => {
      log("[hot-config] File changed, reloading:", filePath)
      this.reload()
    }, 500)
  }

  /**
   * Stop file watching and clean up resources.
   */
  shutdown(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []

    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer)
    }

    log("[hot-config] Manager shut down")
  }
}

// Singleton instance for global access
let globalManager: HotConfigManager | null = null

/**
 * Initialize the global hot config manager.
 */
export function initHotConfigManager(options: HotConfigManagerOptions): HotConfigManager {
  if (globalManager) {
    globalManager.shutdown()
  }
  globalManager = new HotConfigManager(options)
  return globalManager
}

/**
 * Get the global hot config manager.
 */
export function getHotConfigManager(): HotConfigManager | null {
  return globalManager
}
