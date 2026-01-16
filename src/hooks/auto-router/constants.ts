/**
 * Auto-Router Hook Constants
 */

export const HOOK_NAME = "auto-router"

export const AUTO_ROUTER_TAG_OPEN = "<auto-router-decision>"
export const AUTO_ROUTER_TAG_CLOSE = "</auto-router-decision>"

/**
 * Matches /autocode or /auto command with flexible task description capture.
 *
 * v3.8.0: /autocode is the new command name. /auto is deprecated but still supported.
 *
 * Supported formats:
 * 1. Quoted (single or double): /autocode "fix the bug" or /autocode 'fix the bug'
 * 2. Unquoted single-line: /autocode fix the bug
 * 3. Multiline unquoted: /autocode fix the bug\nand add tests
 * 4. With options: /autocode "task" --budget=moderate
 * 5. Legacy: /auto "task" (deprecated, shows warning)
 *
 * The pattern captures EVERYTHING after /autocode (or /auto) until:
 * - End of input, OR
 * - A line starting with -- (options)
 *
 * Quotes are optional and stripped if present.
 */
export const AUTOCODE_COMMAND_PATTERN = /^\/autocode\s+(?:["']([^"']+)["']|([^]*?))(?:\s+--[a-z]|$)/i
/** @deprecated Use AUTOCODE_COMMAND_PATTERN instead */
export const AUTO_COMMAND_PATTERN = /^\/auto(?:code)?\s+(?:["']([^"']+)["']|([^]*?))(?:\s+--[a-z]|$)/i

/** Result of parsing /autocode or /auto command */
export interface AutoCommandParseResult {
  task: string
  isDeprecated: boolean  // true if user used /auto instead of /autocode
}

/**
 * Parse the /autocode (or deprecated /auto) command and extract task description.
 * Handles quotes, multiline, and trailing options properly.
 *
 * v3.8.0: Primary command is /autocode. /auto still works but is deprecated.
 *
 * @param text - The full message text
 * @returns Parse result with task description and deprecation flag, or null if not a valid command
 */
export function parseAutoCommand(text: string): AutoCommandParseResult | null {
  const trimmed = text.trim()
  const lowerTrimmed = trimmed.toLowerCase()

  // Check which command was used
  const isAutocode = lowerTrimmed.startsWith("/autocode ")
  const isAuto = !isAutocode && lowerTrimmed.startsWith("/auto ")

  if (!isAutocode && !isAuto) {
    return null
  }

  // Extract content after the command
  const commandLength = isAutocode ? 10 : 6  // "/autocode " = 10, "/auto " = 6
  let content = trimmed.slice(commandLength).trim()

  // Check for quoted content first (handles escaped quotes better)
  const doubleQuoteMatch = content.match(/^"([^"]*)"/)
  const singleQuoteMatch = content.match(/^'([^']*)'/)

  if (doubleQuoteMatch) {
    const task = doubleQuoteMatch[1].trim()
    return task ? { task, isDeprecated: isAuto } : null
  }
  if (singleQuoteMatch) {
    const task = singleQuoteMatch[1].trim()
    return task ? { task, isDeprecated: isAuto } : null
  }

  // Unquoted: capture until end or until --option
  // This allows multiline content
  const optionIndex = content.search(/\s+--[a-z]/i)
  if (optionIndex > 0) {
    content = content.slice(0, optionIndex)
  }

  const task = content.trim()
  return task ? { task, isDeprecated: isAuto } : null
}

/**
 * Show deprecation warning for /auto usage.
 * Call this when isDeprecated is true from parseAutoCommand.
 */
export function showAutoDeprecationWarning(): void {
  console.log(`
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
[DEPRECATION WARNING] /auto is deprecated
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
The /auto command is deprecated and will be removed in v4.0.

Please use /autocode instead:
  /autocode "your task description"

This session will continue to work, but please update your workflow.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`)
}

export const DEFAULT_STATE_FILE = ".opencode/auto-router-state.json"
