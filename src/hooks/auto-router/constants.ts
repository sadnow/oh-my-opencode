/**
 * Auto-Router Hook Constants
 */

export const HOOK_NAME = "auto-router"

export const AUTO_ROUTER_TAG_OPEN = "<auto-router-decision>"
export const AUTO_ROUTER_TAG_CLOSE = "</auto-router-decision>"

// Matches /auto "task description" with optional trailing options
// Captures task description in group 1, allows options after
export const AUTO_COMMAND_PATTERN = /^\/auto\s+["']?([^"'\n]+?)["']?(?:\s+--|\s*$)/i

export const DEFAULT_STATE_FILE = ".opencode/auto-router-state.json"
