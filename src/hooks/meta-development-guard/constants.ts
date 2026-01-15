/**
 * Meta-Development Guard Constants
 *
 * Defines protected paths and configuration for meta-development guardrails.
 */

export const HOOK_NAME = "meta-development-guard"

/**
 * Default protected paths that require confirmation when editing
 * These are critical plugin paths that could affect behavior if modified
 */
export const DEFAULT_PROTECTED_PATHS = [
  "src/hooks/auto-router/",
  "src/hooks/ralph-loop/",
  "src/hooks/meta-development-guard/",
  "src/features/auto-router/",
  "src/index.ts",
  "src/plugin-config.ts",
  "package.json",
] as const

/**
 * Critical paths that should ALWAYS require confirmation
 * even if allow_self_modification is true
 */
export const CRITICAL_PATHS = [
  "src/index.ts",
  "package.json",
] as const

/**
 * File patterns that may contain sensitive configuration
 */
export const CONFIG_FILE_PATTERNS = [
  "oh-my-opencode.json",
  "oh-my-opencode.jsonc",
  ".opencode/",
] as const

/**
 * Toast messages for different scenarios
 */
export const TOAST_MESSAGES = {
  EDIT_WARNING: "Modifying plugin code - restart required for changes to take effect",
  EDIT_BLOCKED: "Meta-development disabled. Enable in config to modify plugin code.",
  CRITICAL_EDIT: "Editing critical plugin file - proceed with caution",
  CONFIG_CHANGE: "Configuration change detected - may affect running processes",
} as const
