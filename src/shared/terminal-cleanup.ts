/**
 * Terminal cleanup utilities for restoring terminal state on exit.
 *
 * When OpenCode sessions exit (especially on crash/interrupt), the terminal
 * may be left in an abnormal state with mouse tracking enabled. This causes
 * PowerShell to display raw escape sequences like [555;102;13M when moving
 * the mouse.
 *
 * This module provides synchronous cleanup functions that must be called
 * before process.exit() to restore the terminal to a normal state.
 */

/**
 * Reset terminal to normal state.
 * Call this synchronously before process.exit() in signal handlers.
 *
 * This disables:
 * - SGR mouse tracking (cause of [555;x;yM codes)
 * - X11 mouse tracking
 * - Mouse button tracking
 * - All mouse tracking modes
 * - Bracketed paste mode
 * - Alternate screen buffer
 *
 * And restores:
 * - Normal text attributes
 * - Visible cursor
 */
export function resetTerminal(): void {
  // Only write if stdout is a TTY (not piped)
  if (!process.stdout.isTTY) return

  try {
    // Disable SGR mouse tracking (the cause of [555;102;13M codes)
    process.stdout.write("\x1b[?1006l")
    // Disable X11 mouse tracking
    process.stdout.write("\x1b[?1000l")
    // Disable mouse button tracking
    process.stdout.write("\x1b[?1002l")
    // Disable any mouse tracking
    process.stdout.write("\x1b[?1003l")
    // Reset all text attributes (colors, bold, etc.)
    process.stdout.write("\x1b[0m")
    // Exit alternate screen buffer
    process.stdout.write("\x1b[?1049l")
    // Disable bracketed paste mode
    process.stdout.write("\x1b[?2004l")
    // Show cursor (in case it was hidden)
    process.stdout.write("\x1b[?25h")
  } catch {
    // Ignore errors during terminal cleanup (stdout may be closed)
  }
}
