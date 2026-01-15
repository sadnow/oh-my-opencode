/**
 * Auto-Router Hook Constants
 */

export const HOOK_NAME = "auto-router"

export const AUTO_ROUTER_TAG_OPEN = "<auto-router-decision>"
export const AUTO_ROUTER_TAG_CLOSE = "</auto-router-decision>"

/**
 * Matches /auto command with flexible task description capture.
 *
 * Supported formats:
 * 1. Quoted (single or double): /auto "fix the bug" or /auto 'fix the bug'
 * 2. Unquoted single-line: /auto fix the bug
 * 3. Multiline unquoted: /auto fix the bug\nand add tests
 * 4. With options: /auto "task" --budget=moderate
 *
 * The pattern captures EVERYTHING after /auto until:
 * - End of input, OR
 * - A line starting with -- (options)
 *
 * Quotes are optional and stripped if present.
 */
export const AUTO_COMMAND_PATTERN = /^\/auto\s+(?:["']([^"']+)["']|([^]*?))(?:\s+--[a-z]|$)/i

/**
 * Parse the /auto command and extract task description.
 * Handles quotes, multiline, and trailing options properly.
 *
 * @param text - The full message text
 * @returns Task description or null if not a valid /auto command
 */
export function parseAutoCommand(text: string): string | null {
  // Check if it starts with /auto
  const trimmed = text.trim()
  if (!trimmed.toLowerCase().startsWith("/auto ")) {
    return null
  }

  // Extract everything after "/auto "
  let content = trimmed.slice(6).trim()

  // Check for quoted content first (handles escaped quotes better)
  const doubleQuoteMatch = content.match(/^"([^"]*)"/)
  const singleQuoteMatch = content.match(/^'([^']*)'/)

  if (doubleQuoteMatch) {
    const task = doubleQuoteMatch[1].trim()
    return task || null  // Return null if empty
  }
  if (singleQuoteMatch) {
    const task = singleQuoteMatch[1].trim()
    return task || null  // Return null if empty
  }

  // Unquoted: capture until end or until --option
  // This allows multiline content
  const optionIndex = content.search(/\s+--[a-z]/i)
  if (optionIndex > 0) {
    content = content.slice(0, optionIndex)
  }

  return content.trim() || null
}

export const DEFAULT_STATE_FILE = ".opencode/auto-router-state.json"
