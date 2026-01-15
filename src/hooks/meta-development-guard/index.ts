/**
 * Meta-Development Guard Hook
 *
 * Provides guardrails for modifying the plugin's own source code.
 * When enabled, shows warnings before editing protected plugin paths
 * and logs all modifications for audit purposes.
 *
 * @module oh-my-autocode/hooks/meta-development-guard
 */

import type { PluginInput } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"
import * as os from "os"
import { log } from "../../shared/logger"
import { sanitizeForLogging } from "../../shared/sanitize"
import {
  HOOK_NAME,
  DEFAULT_PROTECTED_PATHS,
  CRITICAL_PATHS,
  TOAST_MESSAGES,
} from "./constants"

export * from "./constants"

// ============================================================================
// Types
// ============================================================================

export interface MetaDevelopmentGuardConfig {
  enabled: boolean
  allow_self_modification: boolean
  audit_logging: boolean
  protected_paths: string[]
}

export interface MetaDevelopmentGuardOptions {
  /** Plugin root directory (for relative path resolution) */
  pluginRoot: string
  /** Configuration options */
  config?: Partial<MetaDevelopmentGuardConfig>
}

export interface AuditEntry {
  timestamp: string
  action: "edit" | "write" | "delete" | "config_change"
  path: string
  sessionId?: string
  agent?: string
  blocked: boolean
  reason?: string
}

export interface MetaDevelopmentGuardHook {
  /**
   * Check if a path is protected and show warning if needed
   * Called before file operations
   */
  checkPath: (filePath: string, sessionId?: string, agent?: string) => Promise<{
    allowed: boolean
    isProtected: boolean
    requiresRestart: boolean
    message?: string
  }>
  /**
   * Log an audit entry for file modifications
   */
  logAudit: (entry: Omit<AuditEntry, "timestamp">) => void
  /**
   * Get the audit log file path
   */
  getAuditLogPath: () => string
  /**
   * Check if meta-development mode is enabled
   */
  isEnabled: () => boolean
}

// ============================================================================
// Audit Logging
// ============================================================================

const auditLogPath = path.join(os.homedir(), ".opencode", "oh-my-opencode-audit.log")

/**
 * Ensure audit log directory exists
 */
function ensureAuditLogDir(): void {
  const dir = path.dirname(auditLogPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Write an audit entry to the log file
 */
function writeAuditEntry(entry: AuditEntry): void {
  try {
    ensureAuditLogDir()
    const line = JSON.stringify(sanitizeForLogging(entry)) + "\n"
    fs.appendFileSync(auditLogPath, line)
  } catch (err) {
    log(`[${HOOK_NAME}] Failed to write audit log`, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================================
// Path Checking
// ============================================================================

/**
 * Check if a path is within the plugin directory
 */
function isPluginPath(filePath: string, pluginRoot: string): boolean {
  const resolvedPath = path.resolve(filePath)
  const resolvedRoot = path.resolve(pluginRoot)
  return resolvedPath.startsWith(resolvedRoot)
}

/**
 * Check if a path matches any protected patterns
 */
function isProtectedPath(
  filePath: string,
  pluginRoot: string,
  protectedPaths: string[]
): boolean {
  if (!isPluginPath(filePath, pluginRoot)) {
    return false
  }

  const relativePath = path.relative(pluginRoot, filePath).replace(/\\/g, "/")

  return protectedPaths.some(pattern => {
    // Normalize pattern
    const normalizedPattern = pattern.replace(/\\/g, "/")

    // Check if pattern ends with / (directory match)
    if (normalizedPattern.endsWith("/")) {
      return relativePath.startsWith(normalizedPattern) ||
             relativePath + "/" === normalizedPattern
    }

    // Exact file match
    return relativePath === normalizedPattern ||
           relativePath.endsWith("/" + normalizedPattern)
  })
}

/**
 * Check if a path is critically important (always requires confirmation)
 */
function isCriticalPath(filePath: string, pluginRoot: string): boolean {
  const relativePath = path.relative(pluginRoot, filePath).replace(/\\/g, "/")

  return CRITICAL_PATHS.some(pattern => {
    const normalizedPattern = pattern.replace(/\\/g, "/")
    return relativePath === normalizedPattern ||
           relativePath.endsWith("/" + normalizedPattern)
  })
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Create the meta-development guard hook
 */
export function createMetaDevelopmentGuardHook(
  ctx: PluginInput,
  options: MetaDevelopmentGuardOptions
): MetaDevelopmentGuardHook {
  const config: MetaDevelopmentGuardConfig = {
    enabled: options.config?.enabled ?? false,
    allow_self_modification: options.config?.allow_self_modification ?? false,
    audit_logging: options.config?.audit_logging ?? true,
    protected_paths: options.config?.protected_paths ?? [...DEFAULT_PROTECTED_PATHS],
  }

  const pluginRoot = options.pluginRoot

  log(`[${HOOK_NAME}] Initialized`, {
    enabled: config.enabled,
    allowSelfMod: config.allow_self_modification,
    auditLogging: config.audit_logging,
    protectedPaths: config.protected_paths.length,
  })

  /**
   * Check if a path is protected and determine appropriate action
   */
  const checkPath = async (
    filePath: string,
    sessionId?: string,
    agent?: string
  ): Promise<{
    allowed: boolean
    isProtected: boolean
    requiresRestart: boolean
    message?: string
  }> => {
    // Check if path is within plugin
    if (!isPluginPath(filePath, pluginRoot)) {
      return { allowed: true, isProtected: false, requiresRestart: false }
    }

    const isProtected = isProtectedPath(filePath, pluginRoot, config.protected_paths)
    const isCritical = isCriticalPath(filePath, pluginRoot)

    // Not protected - allow freely
    if (!isProtected) {
      return { allowed: true, isProtected: false, requiresRestart: false }
    }

    // Protected path detected
    const relativePath = path.relative(pluginRoot, filePath).replace(/\\/g, "/")

    // Meta-development disabled - block
    if (!config.enabled) {
      log(`[${HOOK_NAME}] Edit blocked (meta-dev disabled)`, { path: relativePath })

      if (config.audit_logging) {
        writeAuditEntry({
          timestamp: new Date().toISOString(),
          action: "edit",
          path: relativePath,
          sessionId,
          agent,
          blocked: true,
          reason: "meta-development disabled",
        })
      }

      // Show toast warning
      await ctx.client.tui
        .showToast({
          body: {
            title: "Meta-Development Blocked",
            message: TOAST_MESSAGES.EDIT_BLOCKED,
            variant: "error",
            duration: 5000,
          },
        })
        .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message }))

      return {
        allowed: false,
        isProtected: true,
        requiresRestart: true,
        message: TOAST_MESSAGES.EDIT_BLOCKED,
      }
    }

    // Meta-development enabled but critical path
    if (isCritical && !config.allow_self_modification) {
      log(`[${HOOK_NAME}] Critical path warning`, { path: relativePath })

      // Show warning toast but allow
      await ctx.client.tui
        .showToast({
          body: {
            title: "Critical File Edit",
            message: TOAST_MESSAGES.CRITICAL_EDIT,
            variant: "warning",
            duration: 5000,
          },
        })
        .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message }))
    }

    // Meta-development enabled - allow with warning
    log(`[${HOOK_NAME}] Protected path edit allowed`, { path: relativePath })

    if (config.audit_logging) {
      writeAuditEntry({
        timestamp: new Date().toISOString(),
        action: "edit",
        path: relativePath,
        sessionId,
        agent,
        blocked: false,
      })
    }

    // Show warning toast
    await ctx.client.tui
      .showToast({
        body: {
          title: "Plugin Code Modified",
          message: TOAST_MESSAGES.EDIT_WARNING,
          variant: "warning",
          duration: 5000,
        },
      })
      .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message }))

    return {
      allowed: true,
      isProtected: true,
      requiresRestart: true,
      message: TOAST_MESSAGES.EDIT_WARNING,
    }
  }

  /**
   * Log an audit entry
   */
  const logAudit = (entry: Omit<AuditEntry, "timestamp">): void => {
    if (!config.audit_logging) return

    writeAuditEntry({
      ...entry,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get the audit log file path
   */
  const getAuditLogPath = (): string => auditLogPath

  /**
   * Check if meta-development mode is enabled
   */
  const isEnabled = (): boolean => config.enabled

  return {
    checkPath,
    logAudit,
    getAuditLogPath,
    isEnabled,
  }
}
