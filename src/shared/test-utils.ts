/**
 * Test utilities for oh-my-opencode
 *
 * Provides mock factories and helpers for unit testing.
 */

import type { ToolContext } from "@opencode-ai/plugin/tool"

/**
 * Creates a mock ToolContext for testing tool implementations.
 *
 * The mock includes all required properties with sensible defaults:
 * - sessionID, messageID, agent: test identifiers
 * - abort: fresh AbortController signal
 * - metadata: no-op function
 * - ask: no-op async function
 *
 * @param overrides - Optional partial overrides for any property
 * @returns A complete ToolContext suitable for testing
 *
 * @example
 * ```typescript
 * // Basic usage
 * const ctx = createMockToolContext()
 * await myTool.execute({ param: "value" }, ctx)
 *
 * // With overrides
 * const ctx = createMockToolContext({
 *   sessionID: "custom-session",
 *   agent: "oracle"
 * })
 * ```
 */
export function createMockToolContext(
  overrides?: Partial<ToolContext>
): ToolContext {
  return {
    sessionID: overrides?.sessionID ?? "test-session",
    messageID: overrides?.messageID ?? "test-message",
    agent: overrides?.agent ?? "test-agent",
    abort: overrides?.abort ?? new AbortController().signal,
    metadata: overrides?.metadata ?? (() => {}),
    ask: overrides?.ask ?? (async () => {}),
  }
}

/**
 * Creates a mock AbortSignal that is already aborted.
 * Useful for testing abort handling.
 */
export function createAbortedSignal(): AbortSignal {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

/**
 * Creates a mock AbortSignal that will abort after a delay.
 * Useful for testing timeout scenarios.
 *
 * @param delayMs - Milliseconds before abort
 */
export function createDelayedAbortSignal(delayMs: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), delayMs)
  return controller.signal
}
