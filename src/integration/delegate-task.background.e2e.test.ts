import { describe, expect, test } from "bun:test"
import { findNearestMessageWithFields } from "../features/hook-message-injector/injector"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

/**
 * Integration test: BackgroundManager notification context resolution
 * 
 * Tests the fixed async bug in manager.ts (lines 1091-1099):
 * - Previous bug: async getMessageDir().then() callback set variables non-blocking
 * - Issue: agent/model variables used at line 1108 before callback completed  
 * - Fix: Created getMessageDirSync() for error fallback path (sync fs in catch block)
 * 
 * This test verifies the context resolution logic works correctly.
 */
describe("BackgroundManager notification context resolution", () => {
  test("should resolve agent/model from message files synchronously in error path", () => {
    // #given - temporary message directory with stored message files
    const tempDir = mkdtempSync(join(tmpdir(), "test-messages-"))
    
    try {
      // Create message files with agent/model info (simulating hook-message-injector storage)
      const msg1 = {
        agent: "Sisyphus",
        model: { providerID: "anthropic", modelID: "claude-opus-4-5" },
        tools: {},
      }
      const msg2 = {
        agent: "Oracle",
        model: { providerID: "openai", modelID: "gpt-5.2" },
        tools: {},
      }
      
      writeFileSync(join(tempDir, "001-msg-old.json"), JSON.stringify(msg1))
      writeFileSync(join(tempDir, "002-msg-recent.json"), JSON.stringify(msg2))

      // #when - findNearestMessageWithFields searches synchronously (used in catch block)
      const result = findNearestMessageWithFields(tempDir)

      // #then - should find most recent message with all fields
      expect(result).toBeDefined()
      expect(result?.agent).toBe("Oracle") // Most recent file
      expect(result?.model?.providerID).toBe("openai")
      expect(result?.model?.modelID).toBe("gpt-5.2")
    } finally {
      // Cleanup
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("should fallback to message with partial fields when complete fields unavailable", () => {
    // #given - message directory with only partial agent info
    const tempDir = mkdtempSync(join(tmpdir(), "test-messages-"))
    
    try {
      const msg1 = {
        agent: "Sisyphus",
        // No model info
        tools: {},
      }
      
      writeFileSync(join(tempDir, "001-msg.json"), JSON.stringify(msg1))

      // #when - search for message fields
      const result = findNearestMessageWithFields(tempDir)

      // #then - should find message with partial fields (agent only)
      expect(result).toBeDefined()
      expect(result?.agent).toBe("Sisyphus")
      expect(result?.model?.providerID).toBeUndefined()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("should return null when no valid message files exist", () => {
    // #given - empty message directory
    const tempDir = mkdtempSync(join(tmpdir(), "test-messages-"))
    
    try {
      // #when - search for message fields
      const result = findNearestMessageWithFields(tempDir)

      // #then - should return null (will fallback to parentAgent)
      expect(result).toBeNull()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("should handle corrupted message files gracefully", () => {
    // #given - directory with corrupted and valid message files
    const tempDir = mkdtempSync(join(tmpdir(), "test-messages-"))
    
    try {
      // Corrupted JSON
      writeFileSync(join(tempDir, "001-corrupted.json"), "{ invalid json }")
      
      // Valid message
      const validMsg = {
        agent: "Sisyphus",
        model: { providerID: "anthropic", modelID: "claude-opus-4-5" },
      }
      writeFileSync(join(tempDir, "002-valid.json"), JSON.stringify(validMsg))

      // #when - search for message fields (should skip corrupted)
      const result = findNearestMessageWithFields(tempDir)

      // #then - should find valid message, skip corrupted
      expect(result).toBeDefined()
      expect(result?.agent).toBe("Sisyphus")
      expect(result?.model?.providerID).toBe("anthropic")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
